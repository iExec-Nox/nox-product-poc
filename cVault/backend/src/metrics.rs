//! Prometheus metrics wiring.
//!
//! The exporter is installed once at startup; a handle is kept in `AppState`
//! so that the `/metrics` route can render the current snapshot on demand.

use anyhow::{Context, Result};
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};

// ── Metric names ────────────────────────────────────────────────────────────

// Watcher
pub const INDEXER_LAST_BLOCK: &str = "indexer_last_block";
pub const INDEXER_LOGS_PROCESSED: &str = "indexer_logs_processed_total";
pub const INDEXER_GETLOGS_DURATION: &str = "indexer_getlogs_duration_seconds";
pub const INDEXER_RPC_ERRORS: &str = "indexer_rpc_errors_total";

// Processor
pub const PROCESSOR_APPROVE_TOTAL: &str = "processor_approve_total";
pub const PROCESSOR_CONFIRM_DURATION: &str = "processor_confirm_duration_seconds";
pub const PROCESSOR_RETRY_SCHEDULED: &str = "processor_retry_scheduled_total";
pub const PROCESSOR_PERMANENT_FAILURES: &str = "processor_permanent_failures_total";

/// Install the Prometheus recorder and return a handle for the `/metrics`
/// endpoint. Must be called exactly once, at startup.
pub fn install() -> Result<PrometheusHandle> {
    PrometheusBuilder::new()
        .install_recorder()
        .context("install Prometheus recorder")
}
