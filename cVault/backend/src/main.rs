mod abi;
mod config;
mod db;
mod gateway;
mod metrics;
mod processor;
mod routes;
mod server;
mod state;
mod types;
mod watcher;

use config::Config;
use tracing::error;
use tracing_subscriber::fmt::time::OffsetTime;

fn main() -> anyhow::Result<()> {
    // Capture the local UTC offset *before* tokio spawns worker threads —
    // `localtime_r` isn't safe to call concurrently with setenv on Unix.
    let timer = OffsetTime::local_rfc_3339()
        .map_err(|e| anyhow::anyhow!("could not determine local UTC offset: {e}"))?;

    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    tracing_subscriber::fmt()
        .with_timer(timer)
        .with_env_filter(env_filter)
        .init();

    let config = Config::load().inspect_err(|e| {
        error!("Failed to load configuration: {e}");
    })?;

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(server::run(config))
}
