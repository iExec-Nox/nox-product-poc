use alloy::{
    primitives::{Address, FixedBytes},
    providers::Provider,
};
use anyhow::{Context, Result};
use std::str::FromStr;
use std::time::Duration;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};

use crate::abi::IVault;
use crate::config::ProcessorConfig;
use crate::db::{self, Request};
use crate::metrics as m;
use crate::types::RequestKind;

pub struct ProcessorParams {
    pub cfg: ProcessorConfig,
    pub max_fee_per_gas: Option<u128>,
    pub max_priority_fee_per_gas: Option<u128>,
}

/// Classification of an error encountered while processing a request.
enum ProcessError {
    /// Local validation failed — retrying won't help (bad address, bad handle, unknown kind).
    Permanent(anyhow::Error),
    /// RPC / chain error — may succeed on a later attempt.
    Transient(anyhow::Error),
}

impl ProcessError {
    fn inner(&self) -> &anyhow::Error {
        match self {
            Self::Permanent(e) | Self::Transient(e) => e,
        }
    }
}

pub async fn run<P>(
    provider: P,
    db: sqlx::SqlitePool,
    params: ProcessorParams,
    cancel: CancellationToken,
) -> Result<()>
where
    P: Provider + Clone,
{
    let ProcessorParams {
        cfg,
        max_fee_per_gas,
        max_priority_fee_per_gas,
    } = params;
    let poll_interval = cfg.poll_interval();

    // Reset any requests stuck in 'processing' from a previous crashed run.
    db::reset_stuck_processing(&db).await?;
    info!("Processor starting");

    loop {
        if cancel.is_cancelled() {
            info!("Processor stopping on cancel");
            return Ok(());
        }

        let pending = match db::get_pending_requests(&db).await {
            Ok(p) => p,
            Err(e) => {
                warn!("DB error fetching pending requests: {e}");
                sleep_or_cancel(poll_interval, &cancel).await;
                continue;
            }
        };

        for req in pending {
            if cancel.is_cancelled() {
                info!("Processor stopping mid-batch on cancel");
                return Ok(());
            }
            if let Err(err) = process_one(
                &provider,
                &db,
                &req,
                &cfg,
                max_fee_per_gas,
                max_priority_fee_per_gas,
                &cancel,
            )
            .await
            {
                handle_failure(&db, &req, err, &cfg).await;
            }
        }

        sleep_or_cancel(poll_interval, &cancel).await;
    }
}

async fn sleep_or_cancel(duration: Duration, cancel: &CancellationToken) {
    tokio::select! {
        () = tokio::time::sleep(duration) => {}
        () = cancel.cancelled() => {}
    }
}

async fn handle_failure(
    db: &sqlx::SqlitePool,
    req: &Request,
    err: ProcessError,
    cfg: &ProcessorConfig,
) {
    let message = format!("{:#}", err.inner());
    match err {
        ProcessError::Permanent(_) => {
            warn!(id = req.id, kind = %req.kind, vault = %req.vault, "Permanent failure: {message}");
            metrics::counter!(
                m::PROCESSOR_PERMANENT_FAILURES,
                "kind" => req.kind.as_str(),
                "reason" => "permanent",
            )
            .increment(1);
            if let Err(db_err) = db::mark_failed(db, req.id, &message).await {
                warn!(id = req.id, "DB error while marking failed: {db_err}");
            }
        }
        ProcessError::Transient(_) => {
            // attempts has been incremented by mark_processing before the failure.
            if req.attempts + 1 >= cfg.max_attempts {
                warn!(
                    id = req.id,
                    kind = %req.kind,
                    vault = %req.vault,
                    attempts = req.attempts + 1,
                    "Giving up after max attempts: {message}"
                );
                metrics::counter!(
                    m::PROCESSOR_PERMANENT_FAILURES,
                    "kind" => req.kind.as_str(),
                    "reason" => "max_attempts",
                )
                .increment(1);
                if let Err(db_err) = db::mark_failed(db, req.id, &message).await {
                    warn!(id = req.id, "DB error while marking failed: {db_err}");
                }
            } else {
                let delay = backoff_secs(req.attempts + 1, cfg.backoff_base_secs);
                warn!(
                    id = req.id,
                    kind = %req.kind,
                    vault = %req.vault,
                    attempts = req.attempts + 1,
                    retry_in_secs = delay,
                    "Transient failure, will retry: {message}"
                );
                metrics::counter!(m::PROCESSOR_RETRY_SCHEDULED, "kind" => req.kind.as_str())
                    .increment(1);
                if let Err(db_err) = db::mark_retry(db, req.id, delay, &message).await {
                    warn!(id = req.id, "DB error while scheduling retry: {db_err}");
                }
            }
        }
    }
}

/// Exponential backoff: base, 2·base, 4·base, ...
fn backoff_secs(attempt: i64, base: i64) -> i64 {
    let exp = u32::try_from(attempt).unwrap_or(u32::MAX).saturating_sub(1);
    base.saturating_mul(2_i64.saturating_pow(exp))
}

async fn process_one<P: Provider + Clone>(
    provider: &P,
    db: &sqlx::SqlitePool,
    req: &Request,
    cfg: &ProcessorConfig,
    max_fee_per_gas: Option<u128>,
    max_priority_fee_per_gas: Option<u128>,
    cancel: &CancellationToken,
) -> std::result::Result<(), ProcessError> {
    // Local validation first — any failure here is permanent.
    let vault_addr = Address::from_str(&req.vault)
        .with_context(|| format!("invalid vault address: {}", req.vault))
        .map_err(ProcessError::Permanent)?;
    let controller_addr = Address::from_str(&req.controller)
        .with_context(|| format!("invalid controller address: {}", req.controller))
        .map_err(ProcessError::Permanent)?;
    let amount = req
        .amount
        .parse::<FixedBytes<32>>()
        .with_context(|| format!("invalid handle: {}", req.amount))
        .map_err(ProcessError::Permanent)?;

    db::mark_processing(db, req.id)
        .await
        .context("mark_processing")
        .map_err(ProcessError::Transient)?;

    let vault = IVault::new(vault_addr, provider);

    info!(
        id         = req.id,
        request_id = %req.request_id,
        kind       = %req.kind,
        vault      = %req.vault,
        controller = %req.controller,
        amount     = %amount,
        attempt    = req.attempts + 1,
        "Sending approve tx"
    );

    let pending_tx = match req.kind {
        RequestKind::Deposit => {
            let mut call = vault.approveDeposit(amount, controller_addr);
            if let Some(max_fee) = max_fee_per_gas {
                call = call.max_fee_per_gas(max_fee);
            }
            if let Some(max_priority) = max_priority_fee_per_gas {
                call = call.max_priority_fee_per_gas(max_priority);
            }
            call.send()
                .await
                .context("approveDeposit send")
                .map_err(ProcessError::Transient)?
        }
        RequestKind::Redeem => {
            let mut call = vault.approveRedeem(amount, controller_addr);
            if let Some(max_fee) = max_fee_per_gas {
                call = call.max_fee_per_gas(max_fee);
            }
            if let Some(max_priority) = max_priority_fee_per_gas {
                call = call.max_priority_fee_per_gas(max_priority);
            }
            call.send()
                .await
                .context("approveRedeem send")
                .map_err(ProcessError::Transient)?
        }
    };

    let confirm_timeout = cfg.confirm_timeout();
    let confirm_start = std::time::Instant::now();
    let tx_hash = tokio::select! {
        biased;
        () = cancel.cancelled() => {
            return Err(ProcessError::Transient(anyhow::anyhow!(
                "confirm interrupted by shutdown"
            )));
        }
        res = tokio::time::timeout(confirm_timeout, pending_tx.watch()) => res
            .map_err(|_| {
                ProcessError::Transient(anyhow::anyhow!(
                    "tx did not confirm within {}s",
                    confirm_timeout.as_secs()
                ))
            })?
            .context("approve confirm")
            .map_err(ProcessError::Transient)?,
    };
    metrics::histogram!(m::PROCESSOR_CONFIRM_DURATION, "kind" => req.kind.as_str())
        .record(confirm_start.elapsed().as_secs_f64());

    let tx_hash_str = tx_hash.to_string();
    db::mark_done(db, req.id, &tx_hash_str)
        .await
        .context("mark_done")
        .map_err(ProcessError::Transient)?;
    metrics::counter!(
        m::PROCESSOR_APPROVE_TOTAL,
        "kind" => req.kind.as_str(),
        "status" => "success",
    )
    .increment(1);
    info!(id = req.id, tx_hash = %tx_hash_str, "Request approved on-chain");

    Ok(())
}
