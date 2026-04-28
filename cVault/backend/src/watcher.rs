use alloy::{
    primitives::Address,
    providers::Provider,
    rpc::types::{Filter, Log},
    sol_types::SolEvent,
};
use anyhow::{Context, Result};
use std::time::Duration;
use tokio_util::sync::CancellationToken;
use tracing::{debug, info, warn};

use crate::abi::{
    ConfidentialERC7540Created, DepositApproved, DepositClaimed, DepositRequest, RedeemApproved,
    RedeemClaimed, RedeemRequest,
};
use crate::config::IndexerConfig;
use crate::db::{self, RequestInput};
use crate::metrics as m;
use crate::types::RequestKind;

pub struct WatcherParams {
    pub factory: Address,
    pub start_block: u64,
    pub confirmation_depth: u64,
    pub indexer: IndexerConfig,
}

fn next_backoff(current: Duration, max: Duration) -> Duration {
    let doubled = current.saturating_mul(2);
    if doubled > max { max } else { doubled }
}

pub async fn run<P>(
    provider: P,
    db: sqlx::SqlitePool,
    params: WatcherParams,
    cancel: CancellationToken,
) -> Result<()>
where
    P: Provider + Clone,
{
    let WatcherParams {
        factory,
        start_block,
        confirmation_depth,
        indexer,
    } = params;
    let poll_interval = indexer.poll_interval();
    let backoff_initial = indexer.backoff_initial();
    let backoff_max = indexer.backoff_max();
    let chunk_size = indexer.chunk_size;
    let request_delay_secs = indexer.request_delay_secs;

    // Resume from the last indexed block, or start fresh.
    let last = db::get_last_block(&db).await?;
    let mut from_block = last.map_or(start_block, |b| b + 1);

    // Build the topic list once — we watch all vault lifecycle events in a
    // single filter. Request events drive processing; Approved/Claimed are
    // logged for observability only.
    let topics = vec![
        ConfidentialERC7540Created::SIGNATURE_HASH,
        DepositRequest::SIGNATURE_HASH,
        RedeemRequest::SIGNATURE_HASH,
        DepositApproved::SIGNATURE_HASH,
        RedeemApproved::SIGNATURE_HASH,
        DepositClaimed::SIGNATURE_HASH,
        RedeemClaimed::SIGNATURE_HASH,
    ];

    info!(from_block, factory = %factory, "Watcher starting");

    let mut backoff = backoff_initial;

    loop {
        if cancel.is_cancelled() {
            info!("Watcher stopping on cancel");
            return Ok(());
        }

        let latest = tokio::select! {
            biased;
            () = cancel.cancelled() => return Ok(()),
            res = provider.get_block_number() => match res {
                Ok(n) => n,
                Err(e) => {
                    metrics::counter!(m::INDEXER_RPC_ERRORS, "source" => "get_block_number")
                        .increment(1);
                    warn!(backoff_secs = backoff.as_secs(), "get_block_number: {e}");
                    sleep_or_cancel(backoff, &cancel).await;
                    backoff = next_backoff(backoff, backoff_max);
                    continue;
                }
            },
        };

        let safe_tip = latest.saturating_sub(confirmation_depth);

        if from_block > safe_tip {
            backoff = backoff_initial;
            sleep_or_cancel(poll_interval, &cancel).await;
            continue;
        }

        let to_block = (from_block + chunk_size - 1).min(safe_tip);

        let filter = Filter::new()
            .event_signature(topics.clone())
            .from_block(from_block)
            .to_block(to_block);

        let getlogs_start = std::time::Instant::now();
        let logs = tokio::select! {
            biased;
            () = cancel.cancelled() => return Ok(()),
            res = provider.get_logs(&filter) => match res {
                Ok(l) => l,
                Err(e) => {
                    metrics::counter!(m::INDEXER_RPC_ERRORS, "source" => "get_logs").increment(1);
                    warn!(
                        backoff_secs = backoff.as_secs(),
                        "get_logs [{from_block}..{to_block}]: {e}"
                    );
                    sleep_or_cancel(backoff, &cancel).await;
                    backoff = next_backoff(backoff, backoff_max);
                    continue;
                }
            },
        };
        metrics::histogram!(m::INDEXER_GETLOGS_DURATION)
            .record(getlogs_start.elapsed().as_secs_f64());

        // Successful RPC call — reset backoff.
        backoff = backoff_initial;

        if !logs.is_empty() {
            debug!(
                from = from_block,
                to = to_block,
                count = logs.len(),
                "Processing logs"
            );
        }

        // IMPORTANT: process logs sequentially, in the order returned by eth_getLogs.
        // eth_getLogs guarantees ordering by (block_number, tx_index, log_index).
        for log in &logs {
            if cancel.is_cancelled() {
                return Ok(());
            }
            process_log(log, &db, factory, request_delay_secs).await?;
        }

        db::set_last_block(&db, to_block).await?;
        // Block numbers in practice stay well below 2^52 — f64 precision is fine.
        #[allow(clippy::cast_precision_loss)]
        metrics::gauge!(m::INDEXER_LAST_BLOCK).set(to_block as f64);
        from_block = to_block + 1;

        if from_block > safe_tip {
            sleep_or_cancel(poll_interval, &cancel).await;
        }
    }
}

/// Sleep up to `duration`, returning early if `cancel` fires.
async fn sleep_or_cancel(duration: Duration, cancel: &CancellationToken) {
    tokio::select! {
        () = tokio::time::sleep(duration) => {}
        () = cancel.cancelled() => {}
    }
}

/// Common fields shared by `DepositRequest` and `RedeemRequest`.
/// The only meaningful difference between the two events is the label of the
/// amount field (`assets` vs `shares`) — both carry a `bytes32` encrypted handle.
struct RequestFields {
    controller: String,
    owner: String,
    request_id: String,
    sender: String,
    amount: String,
}

async fn process_log(log: &Log, db: &sqlx::SqlitePool, factory: Address, request_delay_secs: u64) -> Result<()> {
    let Some(topic0) = log.topic0() else {
        return Ok(());
    };
    let block = log.block_number.context("log without block number")?;

    match *topic0 {
        t if t == ConfidentialERC7540Created::SIGNATURE_HASH => {
            // Validate the emitter is our factory — reject any contract
            // that happens to emit an event with the same signature.
            if log.address() != factory {
                return Ok(());
            }
            let event = match ConfidentialERC7540Created::decode_log(log.as_ref()) {
                Ok(e) => e,
                Err(e) => {
                    warn!("ConfidentialERC7540Created decode: {e}");
                    return Ok(());
                }
            };
            let vault = event.vault.to_string();
            let asset = event.asset.to_string();
            let owner = event.initialOwner.to_string();
            info!(
                vault  = %vault,
                asset  = %asset,
                owner  = %owner,
                name   = %event.name,
                symbol = %event.symbol,
                block,

                "ConfidentialERC7540Created"
            );
            db::upsert_vault(
                db,
                &vault,
                &asset,
                &owner,
                &event.name,
                &event.symbol,
                block,
            )
            .await?;
        }

        t if t == DepositRequest::SIGNATURE_HASH => {
            let Some(fields) =
                decode_request::<DepositRequest>(log, db, "DepositRequest", |e| RequestFields {
                    controller: e.controller.to_string(),
                    owner: e.owner.to_string(),
                    request_id: e.requestId.to_string(),
                    sender: e.sender.to_string(),
                    amount: e.assets.to_string(),
                })
                .await?
            else {
                return Ok(());
            };
            insert_request(log, db, RequestKind::Deposit, &fields, block, request_delay_secs).await?;
        }

        t if t == RedeemRequest::SIGNATURE_HASH => {
            let Some(fields) =
                decode_request::<RedeemRequest>(log, db, "RedeemRequest", |e| RequestFields {
                    controller: e.controller.to_string(),
                    owner: e.owner.to_string(),
                    request_id: e.requestId.to_string(),
                    sender: e.sender.to_string(),
                    amount: e.shares.to_string(),
                })
                .await?
            else {
                return Ok(());
            };
            insert_request(log, db, RequestKind::Redeem, &fields, block, request_delay_secs).await?;
        }

        // Approved / Claimed — observability only, no DB writes.
        _ => log_lifecycle_event(log, db, *topic0, block).await?,
    }

    Ok(())
}

/// Log observability events (Approved / Claimed) emitted by a known vault.
/// Unknown emitters and unknown topics are silently ignored.
async fn log_lifecycle_event(
    log: &Log,
    db: &sqlx::SqlitePool,
    topic0: alloy::primitives::B256,
    block: u64,
) -> Result<()> {
    // Resolve the topic first so that we skip the vault existence check on
    // events we don't care about (any contract can emit anything).
    let is_lifecycle = topic0 == DepositApproved::SIGNATURE_HASH
        || topic0 == RedeemApproved::SIGNATURE_HASH
        || topic0 == DepositClaimed::SIGNATURE_HASH
        || topic0 == RedeemClaimed::SIGNATURE_HASH;
    if !is_lifecycle {
        return Ok(());
    }
    if !db::vault_exists(db, &log.address().to_string()).await? {
        return Ok(());
    }

    let vault = log.address();
    match topic0 {
        t if t == DepositApproved::SIGNATURE_HASH => {
            match DepositApproved::decode_log(log.as_ref()) {
                Ok(e) => {
                    info!(%vault, owner = %e.owner, assets = %e.assets, block, "DepositApproved")
                }
                Err(e) => warn!("DepositApproved decode: {e}"),
            }
        }
        t if t == RedeemApproved::SIGNATURE_HASH => {
            match RedeemApproved::decode_log(log.as_ref()) {
                Ok(e) => {
                    info!(%vault, owner = %e.owner, shares = %e.shares, block, "RedeemApproved")
                }
                Err(e) => warn!("RedeemApproved decode: {e}"),
            }
        }
        t if t == DepositClaimed::SIGNATURE_HASH => {
            match DepositClaimed::decode_log(log.as_ref()) {
                Ok(e) => info!(
                    %vault, controller = %e.controller, receiver = %e.receiver,
                    shares = %e.shares, block, "DepositClaimed"
                ),
                Err(e) => warn!("DepositClaimed decode: {e}"),
            }
        }
        t if t == RedeemClaimed::SIGNATURE_HASH => match RedeemClaimed::decode_log(log.as_ref()) {
            Ok(e) => info!(
                %vault, controller = %e.controller, receiver = %e.receiver,
                assets = %e.assets, block, "RedeemClaimed"
            ),
            Err(e) => warn!("RedeemClaimed decode: {e}"),
        },
        _ => {}
    }
    Ok(())
}

/// Validate emitter, decode the event, and extract the common fields.
/// Returns `Ok(None)` when the log must be skipped (unknown vault, decode error).
async fn decode_request<E: SolEvent>(
    log: &Log,
    db: &sqlx::SqlitePool,
    event_name: &'static str,
    extract: impl FnOnce(&E) -> RequestFields,
) -> Result<Option<RequestFields>> {
    let vault = log.address().to_string();
    if !db::vault_exists(db, &vault).await? {
        // Unknown emitter — not one of our vaults.
        return Ok(None);
    }
    match E::decode_log(log.as_ref()) {
        Ok(decoded) => Ok(Some(extract(&decoded.data))),
        Err(e) => {
            warn!("{event_name} decode: {e}");
            Ok(None)
        }
    }
}

async fn insert_request(
    log: &Log,
    db: &sqlx::SqlitePool,
    kind: RequestKind,
    fields: &RequestFields,
    block: u64,
    request_delay_secs: u64,
) -> Result<()> {
    let vault = log.address().to_string();
    let process_after = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64 + request_delay_secs as i64)
        .unwrap_or(0);
    let rows = db::upsert_request(
        db,
        &RequestInput {
            vault: &vault,
            request_id: &fields.request_id,
            kind,
            controller: &fields.controller,
            owner: &fields.owner,
            sender: &fields.sender,
            amount: &fields.amount,
            block,
            process_after,
        },
    )
    .await?;
    if rows > 0 {
        info!(
            vault      = %vault,
            request_id = %fields.request_id,
            owner      = %fields.owner,
            controller =  &fields.controller,
            amount     = %fields.amount,
            block,
            kind       = %kind,
            "Request indexed"
        );
        metrics::counter!(m::INDEXER_LOGS_PROCESSED, "kind" => kind.as_str()).increment(1);
    }
    Ok(())
}
