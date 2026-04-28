use alloy::primitives::Address;
use config::{Config as ConfigBuilder, ConfigError, Environment};
use secrecy::SecretString;
use serde::Deserialize;
use std::fmt;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub chain: ChainConfig,
    pub db: DbConfig,
    pub server: ServerConfig,
    pub indexer: IndexerConfig,
    pub processor: ProcessorConfig,
    pub gateway: GatewayConfig,
}

/// Optional gateway integration for on-the-fly decryption of confidential handles.
///
/// Set `SETTLER_GATEWAY__URL` to enable; the settler address must hold on-chain ACL
/// for the handles it wants to decrypt.
#[derive(Debug, Clone, Deserialize)]
pub struct GatewayConfig {
    /// Base URL of the Nox Handle Gateway (e.g. `https://gateway.example.com`).
    /// When absent, decryption is skipped and the snapshot returns handles only.
    pub url: Option<String>,
    /// EIP-712 chain ID used in the `DataAccessAuthorization` domain.
    pub chain_id: u64,
    /// Address of the `NoxCompute` proxy contract (verifying contract in the domain).
    pub nox_compute_address: Address,
}

#[derive(Deserialize)]
pub struct ChainConfig {
    pub rpc_url: String,
    pub private_key: SecretString,
    /// Factory contract that emits `VaultCreated`.
    pub factory_address: Address,
    /// Block to start indexing from (set to factory deployment block).
    pub start_block: u64,
    /// Number of confirmations to wait before indexing a block.
    pub confirmation_depth: u64,
    /// EIP-1559 max fee per gas (wei). When unset, alloy uses the RPC's suggestion.
    #[serde(default)]
    pub max_fee_per_gas: Option<u128>,
    /// EIP-1559 max priority fee per gas (wei).
    #[serde(default)]
    pub max_priority_fee_per_gas: Option<u128>,
}

impl fmt::Debug for ChainConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ChainConfig")
            .field("rpc_url", &self.rpc_url)
            .field("private_key", &"<redacted>")
            .field("factory_address", &self.factory_address)
            .field("start_block", &self.start_block)
            .field("confirmation_depth", &self.confirmation_depth)
            .field("max_fee_per_gas", &self.max_fee_per_gas)
            .field("max_priority_fee_per_gas", &self.max_priority_fee_per_gas)
            .finish()
    }
}

#[derive(Debug, Deserialize)]
pub struct DbConfig {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct IndexerConfig {
    /// Delay between polls when caught up to the chain tip, in seconds.
    pub poll_interval_secs: u64,
    /// Number of blocks fetched per `eth_getLogs` call.
    pub chunk_size: u64,
    /// Initial backoff between retries on RPC error, in seconds.
    pub backoff_initial_secs: u64,
    /// Maximum backoff between retries on RPC error, in seconds.
    pub backoff_max_secs: u64,
    /// Delay before the processor picks up a newly indexed request, in seconds.
    pub request_delay_secs: u64,
}

impl IndexerConfig {
    pub fn poll_interval(&self) -> Duration {
        Duration::from_secs(self.poll_interval_secs)
    }
    pub fn backoff_initial(&self) -> Duration {
        Duration::from_secs(self.backoff_initial_secs)
    }
    pub fn backoff_max(&self) -> Duration {
        Duration::from_secs(self.backoff_max_secs)
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProcessorConfig {
    /// Delay between scans of the pending queue, in seconds.
    pub poll_interval_secs: u64,
    /// Maximum number of attempts before a request is marked as permanently failed.
    pub max_attempts: i64,
    /// Upper bound on how long we wait for an approve tx to confirm, in seconds.
    pub confirm_timeout_secs: u64,
    /// Base delay for retry backoff (doubles each attempt), in seconds.
    pub backoff_base_secs: i64,
}

impl ProcessorConfig {
    pub fn poll_interval(&self) -> Duration {
        Duration::from_secs(self.poll_interval_secs)
    }
    pub fn confirm_timeout(&self) -> Duration {
        Duration::from_secs(self.confirm_timeout_secs)
    }
}

impl Config {
    pub fn load() -> Result<Self, ConfigError> {
        ConfigBuilder::builder()
            // Server
            .set_default("server.host", "0.0.0.0")?
            .set_default("server.port", 3001)?
            // DB
            .set_default("db.path", "settler.db")?
            // Chain
            .set_default("chain.start_block", 262_514_780)?
            .set_default("chain.confirmation_depth", 1)?
            .set_default(
                "chain.factory_address",
                "0xB9390D62E3272ef88b812B28bD0A57a4580937EE",
            )?
            .set_default("chain.private_key", "")?
            .set_default("chain.rpc_url", "https://sepolia-rollup.arbitrum.io/rpc")?
            // Indexer
            .set_default("indexer.poll_interval_secs", 5)?
            .set_default("indexer.chunk_size", 100)?
            .set_default("indexer.backoff_initial_secs", 1)?
            .set_default("indexer.backoff_max_secs", 60)?
            .set_default("indexer.request_delay_secs", 30)?
            // Processor
            .set_default("processor.poll_interval_secs", 10)?
            .set_default("processor.max_attempts", 3)?
            .set_default("processor.confirm_timeout_secs", 120)?
            .set_default("processor.backoff_base_secs", 5)?
            // Gateway (decryption optional — set SETTLER_GATEWAY__URL to enable)
            .set_default("gateway.chain_id", 421614u64)?
            .set_default("gateway.url", "")?
            .set_default(
                "gateway.nox_compute_address",
                "0xd464B198f06756a1d00be223634b85E0a731c229",
            )?
            .add_source(
                Environment::with_prefix("SETTLER")
                    .prefix_separator("_")
                    .separator("__"),
            )
            .build()?
            .try_deserialize()
    }

    pub fn binding_address(&self) -> String {
        format!("{}:{}", self.server.host, self.server.port)
    }
}
