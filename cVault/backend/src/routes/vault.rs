use crate::abi::IVault;
use crate::db::{self, Vault};
use crate::state::AppState;
use alloy::primitives::{Address, U256, hex};
use alloy::providers::ProviderBuilder;
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};
use chrono::Utc;
use serde::Serialize;
use serde_json::{Value, json};
use std::str::FromStr;
use std::sync::atomic::Ordering;
use tracing::{error, warn};

#[derive(Serialize)]
pub struct SettlerInfo {
    pub factory_address: String,
    pub settler_address: String,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub watcher: &'static str,
    pub processor: &'static str,
}

async fn get_info(State(state): State<AppState>) -> Json<SettlerInfo> {
    Json(SettlerInfo {
        factory_address: state.config.chain.factory_address.to_string(),
        settler_address: state.settler_address.clone(),
    })
}

async fn get_vaults(State(state): State<AppState>) -> Result<Json<Vec<Vault>>, StatusCode> {
    db::get_vaults(&state.db).await.map(Json).map_err(|e| {
        error!("DB error fetching vaults: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })
}

pub async fn root() -> Json<Value> {
    Json(json!({
        "service": "settler",
        "timestamp": Utc::now().to_rfc3339()
    }))
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    let watcher = state.health.watcher_alive.load(Ordering::Relaxed);
    let processor = state.health.processor_alive.load(Ordering::Relaxed);
    let ok = watcher && processor;

    let body = Json(HealthResponse {
        status: if ok { "ok" } else { "degraded" },
        watcher: if watcher { "alive" } else { "down" },
        processor: if processor { "alive" } else { "down" },
    });

    let code = if ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (code, body)
}

async fn metrics(State(state): State<AppState>) -> impl IntoResponse {
    let body = state.metrics.render();
    (
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4",
        )],
        body,
    )
}

type SnapshotResult = Result<Json<Value>, (StatusCode, Json<Value>)>;

async fn get_snapshot(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> SnapshotResult {
    let addr = Address::from_str(&address).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("invalid address: {address}") })),
        )
    })?;

    let rpc_url = state.config.chain.rpc_url.parse().map_err(|e| {
        error!("RPC URL parse error: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "server misconfiguration" })),
        )
    })?;

    let provider = ProviderBuilder::new().connect_http(rpc_url);
    let vault = IVault::new(addr, provider);

    let rpc_err = |e: alloy::contract::Error| {
        error!("RPC error reading snapshot for {addr}: {e:#}");
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("{e:#}") })),
        )
    };
    let assets = vault
        .confidentialTotalAssets()
        .call()
        .await
        .map_err(rpc_err)?;
    let supply = vault
        .confidentialTotalSupply()
        .call()
        .await
        .map_err(rpc_err)?;

    let assets_hex = hex::encode_prefixed(assets.as_slice());
    let supply_hex = hex::encode_prefixed(supply.as_slice());

    let zero_handle = assets.is_zero() || supply.is_zero();

    let (decrypted_assets, decrypted_supply) = if zero_handle {
        (Some("0".to_string()), Some("0".to_string()))
    } else {
        match &state.gateway {
            None => (None, None),
            Some(gw) => {
                let da = decrypt_handle(gw, &assets_hex).await;
                let ds = decrypt_handle(gw, &supply_hex).await;
                (da, ds)
            }
        }
    };

    let nav = if zero_handle {
        Some("0".to_string())
    } else {
        compute_nav(decrypted_assets.as_deref(), decrypted_supply.as_deref())
    };

    Ok(Json(json!({
        "address": address,
        "confidential_total_assets": assets_hex,
        "confidential_total_supply": supply_hex,
        "decrypted_total_assets": decrypted_assets,
        "decrypted_total_supply": decrypted_supply,
        "nav": nav,
        "apy":0.05
    })))
}

/// Calls the gateway and returns the decrypted uint256 as a decimal string.
/// Returns `None` on any error so the snapshot endpoint never fails due to decryption issues.
async fn decrypt_handle(gw: &crate::gateway::GatewayClient, handle: &str) -> Option<String> {
    match gw.decrypt(handle).await {
        Ok(bytes) if bytes.len() == 32 => Some(U256::from_be_slice(&bytes).to_string()),
        Ok(bytes) => {
            warn!(
                handle,
                len = bytes.len(),
                "unexpected plaintext length from gateway"
            );
            Some(hex::encode_prefixed(&bytes))
        }
        Err(e) => {
            warn!(handle, "gateway decryption failed: {e:#}");
            None
        }
    }
}

/// Computes NAV = total_assets / total_supply with 9 decimal places of precision.
/// Returns `"0"` when supply is zero, `null` when either value is unavailable.
fn compute_nav(assets: Option<&str>, supply: Option<&str>) -> Option<String> {
    let a = assets?.parse::<U256>().ok()?;
    let s = supply?.parse::<U256>().ok()?;
    if s.is_zero() {
        return Some("0".to_string());
    }
    let precision = U256::from(1_000_000_000u64); // 10^9
    let scaled = (a * precision) / s;
    let integer = scaled / precision;
    let frac: u64 = (scaled % precision).try_into().unwrap_or(0);
    Some(format!("{integer}.{frac:09}"))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route("/metrics", get(metrics))
        .route("/api/settler", get(get_info))
        .route("/api/vaults", get(get_vaults))
        .route("/api/snapshot/{address}", get(get_snapshot))
}
