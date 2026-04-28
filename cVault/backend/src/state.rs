use crate::config::Config;
use crate::gateway::GatewayClient;
use metrics_exporter_prometheus::PrometheusHandle;
use sqlx::SqlitePool;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

/// Liveness flags for the long-running background tasks.
/// Each flag is flipped to `false` when the corresponding task exits.
#[derive(Default)]
pub struct TaskHealth {
    pub watcher_alive: AtomicBool,
    pub processor_alive: AtomicBool,
}

impl TaskHealth {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            watcher_alive: AtomicBool::new(true),
            processor_alive: AtomicBool::new(true),
        })
    }
}

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub settler_address: String,
    pub db: SqlitePool,
    pub health: Arc<TaskHealth>,
    pub metrics: PrometheusHandle,
    pub gateway: Option<Arc<GatewayClient>>,
}

impl AppState {
    pub fn new(
        config: Config,
        settler_address: String,
        db: SqlitePool,
        health: Arc<TaskHealth>,
        metrics: PrometheusHandle,
        gateway: Option<Arc<GatewayClient>>,
    ) -> Self {
        Self {
            config: Arc::new(config),
            settler_address,
            db,
            health,
            metrics,
            gateway,
        }
    }
}
