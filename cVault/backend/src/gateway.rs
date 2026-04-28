use std::time::{SystemTime, UNIX_EPOCH};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use alloy::primitives::{Address, U256, hex};
use alloy::signers::SignerSync;
use alloy::signers::local::PrivateKeySigner;
use alloy::sol;
use alloy::sol_types::{SolStruct, eip712_domain};
use anyhow::{Context, Result, bail};
use base64::{Engine, engine::general_purpose::STANDARD};
use hkdf::Hkdf;
use rand::rngs::OsRng;
use reqwest::Client;
use rsa::pkcs8::EncodePublicKey;
use rsa::{Oaep, RsaPrivateKey, RsaPublicKey};
use serde::Deserialize;
use sha2::Sha256;
use tracing::{debug, info};

const ECIES_CONTEXT: &[u8] = b"ECIES:AES_GCM:v1";

sol! {
    struct DataAccessAuthorization {
        address userAddress;
        string encryptionPubKey;
        uint256 notBefore;
        uint256 expiresAt;
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CryptoPayload {
    ciphertext: String,
    encrypted_shared_secret: String,
    iv: String,
}

#[derive(Deserialize)]
struct SecretsResponse {
    payload: CryptoPayload,
}

pub struct GatewayClient {
    base_url: String,
    http: Client,
    signer: PrivateKeySigner,
    chain_id: u64,
    nox_compute: Address,
    rsa_priv: RsaPrivateKey,
    enc_pub_key: String,
}

impl GatewayClient {
    pub fn new(
        base_url: String,
        signer: PrivateKeySigner,
        chain_id: u64,
        nox_compute: Address,
    ) -> anyhow::Result<Self> {
        let rsa_priv = RsaPrivateKey::new(&mut OsRng, 2048).context("RSA keygen")?;
        let spki_der = RsaPublicKey::from(&rsa_priv)
            .to_public_key_der()
            .context("SPKI DER export")?;
        let enc_pub_key = hex::encode_prefixed(spki_der.as_bytes());
        info!("Gateway RSA key pair generated");
        Ok(Self {
            base_url,
            http: Client::new(),
            signer,
            chain_id,
            nox_compute,
            rsa_priv,
            enc_pub_key,
        })
    }

    /// Fetches the encrypted crypto material for `handle` from the gateway and
    /// decrypts the plaintext using the settler's long-lived RSA key pair.
    ///
    /// The settler's private key is used to sign the `DataAccessAuthorization`
    /// EIP-712 token, so the on-chain ACL must grant view access to the settler address.
    pub async fn decrypt(&self, handle: &str) -> Result<Vec<u8>> {

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .context("system time")?
            .as_secs();

        let auth_struct = DataAccessAuthorization {
            userAddress: self.signer.address(),
            encryptionPubKey: self.enc_pub_key.clone(),
            notBefore: U256::from(now),
            expiresAt: U256::from(now + 3600),
        };

        let domain = eip712_domain! {
            name: "Handle Gateway",
            version: "1",
            chain_id: self.chain_id,
            verifying_contract: self.nox_compute,
        };

        let hash = auth_struct.eip712_signing_hash(&domain);
        let sig = self
            .signer
            .sign_hash_sync(&hash)
            .context("EIP-712 sign")?;

        let token = STANDARD.encode(
            serde_json::json!({
                "payload": {
                    "userAddress": self.signer.address().to_string(),
                    "encryptionPubKey": self.enc_pub_key,
                    "notBefore": now,
                    "expiresAt": now + 3600u64,
                },
                "signature": sig.to_string(),
            })
            .to_string(),
        );

        let url = format!("{}/v0/secrets/{handle}", self.base_url);
        debug!(handle, "calling gateway decrypt");

        let resp = self
            .http
            .get(&url)
            .header("Authorization", format!("EIP712 {token}"))
            .send()
            .await
            .context("gateway request")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            bail!("gateway returned {status} for handle {handle}: {body}");
        }

        let data: SecretsResponse = resp.json().await.context("parse gateway response")?;

        // RSA-OAEP decrypt the shared secret.
        let enc_shared_secret =
            decode_hex(&data.payload.encrypted_shared_secret).context("decode encryptedSharedSecret")?;
        let shared_secret = self
            .rsa_priv
            .decrypt(Oaep::new::<Sha256>(), &enc_shared_secret)
            .context("RSA decrypt shared secret")?;

        // HKDF-SHA256 → 32-byte AES-256-GCM key.
        let hkdf = Hkdf::<Sha256>::new(None, &shared_secret);
        let mut aes_key = [0u8; 32];
        hkdf.expand(ECIES_CONTEXT, &mut aes_key)
            .map_err(|e| anyhow::anyhow!("HKDF expand: {e}"))?;

        // AES-256-GCM decrypt.
        let iv_bytes = decode_hex(&data.payload.iv).context("decode iv")?;
        let ciphertext_bytes = decode_hex(&data.payload.ciphertext).context("decode ciphertext")?;

        let cipher = Aes256Gcm::new(&aes_key.into());
        cipher
            .decrypt(Nonce::from_slice(&iv_bytes), ciphertext_bytes.as_slice())
            .map_err(|_| anyhow::anyhow!("AES-GCM decryption failed for handle {handle}"))
    }
}

fn decode_hex(s: &str) -> Result<Vec<u8>> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    hex::decode(s).context("invalid hex")
}
