use alloy::network::EthereumWallet;
use alloy::providers::ProviderBuilder;
use alloy::signers::local::PrivateKeySigner;
use anyhow::{Context, Result};
use axum::Router;
use secrecy::{ExposeSecret, SecretString};
use std::sync::Arc;
use tokio::signal;
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

use crate::config::Config;
use crate::gateway::GatewayClient;
use crate::state::{AppState, TaskHealth};
use crate::{db, metrics, processor, routes, watcher};

use std::sync::atomic::Ordering;

pub async fn run(cfg: Config) -> Result<()> {
    // Install the Prometheus recorder before any metric is emitted.
    let metrics_handle = metrics::install()?;

    let settler_address = derive_settler_address(&cfg.chain.private_key)?;
    info!(settler = %settler_address, "Settler wallet ready");

    let pool = db::create_pool(&cfg.db.path).await?;
    db::migrate(&pool).await?;
    info!(db = %cfg.db.path, "Database ready");

    // Single signing provider shared between watcher and processor.
    // The watcher doesn't need signing, but carrying the wallet through is cheap.
    let signer: PrivateKeySigner = cfg
        .chain
        .private_key
        .expose_secret()
        .parse()
        .context("invalid PRIVATE_KEY")?;
    let wallet = EthereumWallet::from(signer.clone());
    let provider = ProviderBuilder::new()
        .wallet(wallet)
        .connect_http(cfg.chain.rpc_url.parse().context("invalid RPC_URL")?);

    let health = TaskHealth::new();
    let cancel = CancellationToken::new();

    let watcher_params = watcher::WatcherParams {
        factory: cfg.chain.factory_address,
        start_block: cfg.chain.start_block,
        confirmation_depth: cfg.chain.confirmation_depth,
        indexer: cfg.indexer.clone(),
    };
    let processor_params = processor::ProcessorParams {
        cfg: cfg.processor.clone(),
        max_fee_per_gas: cfg.chain.max_fee_per_gas,
        max_priority_fee_per_gas: cfg.chain.max_priority_fee_per_gas,
    };

    let mut tasks: JoinSet<()> = JoinSet::new();

    tasks.spawn({
        let pool = pool.clone();
        let provider = provider.clone();
        let health = health.clone();
        let cancel = cancel.clone();
        async move {
            if let Err(e) = watcher::run(provider, pool, watcher_params, cancel).await {
                tracing::error!(error = %e, "Watcher exited");
            }
            health.watcher_alive.store(false, Ordering::Relaxed);
        }
    });

    tasks.spawn({
        let pool = pool.clone();
        let provider = provider.clone();
        let health = health.clone();
        let cancel = cancel.clone();
        async move {
            if let Err(e) = processor::run(provider, pool, processor_params, cancel).await {
                tracing::error!(error = %e, "Processor exited");
            }
            health.processor_alive.store(false, Ordering::Relaxed);
        }
    });

    let gateway = cfg.gateway.url.as_ref().map(|url| {
        info!(url, "Gateway decryption enabled");
        GatewayClient::new(
            url.clone(),
            signer.clone(),
            cfg.gateway.chain_id,
            cfg.gateway.nox_compute_address,
        )
        .map(Arc::new)
    }).transpose().context("gateway RSA key generation failed")?;

    let addr = cfg.binding_address();
    let app_state = AppState::new(cfg, settler_address, pool, health, metrics_handle, gateway);
    let app = Router::new()
        .merge(routes::router())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    info!("Settler listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("Failed to bind to {addr}"))?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(cancel.clone()))
        .await
        .context("Server error")?;

    // HTTP server has stopped — shutdown_signal has already triggered cancel.
    // Make sure the token is set (defensive: covers the case where the HTTP
    // server exited for another reason), then wait for background tasks.
    cancel.cancel();
    info!("Waiting for background tasks to finish");
    while let Some(res) = tasks.join_next().await {
        if let Err(e) = res {
            warn!("Background task join error: {e}");
        }
    }

    info!("Server shutdown complete");
    Ok(())
}

fn derive_settler_address(private_key: &SecretString) -> Result<String> {
    let signer: PrivateKeySigner = private_key
        .expose_secret()
        .parse()
        .context("invalid PRIVATE_KEY")?;
    Ok(signer.address().to_string())
}

async fn shutdown_signal(cancel: CancellationToken) {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {
            info!("Received Ctrl+C, shutting down gracefully");
        },
        () = terminate => {
            info!("Received SIGTERM, shutting down gracefully");
        },
    }

    warn!("Shutdown signal received, cancelling background tasks");
    cancel.cancel();
}
