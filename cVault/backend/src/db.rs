use anyhow::{Context, Result};
use sqlx::{Row, SqlitePool, sqlite::SqlitePoolOptions};

use crate::types::{RequestKind, RequestStatus};

// ── Pool ─────────────────────────────────────────────────────────────────────

pub async fn create_pool(db_path: &str) -> Result<SqlitePool> {
    let url = format!("sqlite:{db_path}?mode=rwc");
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    // Prod-friendly SQLite settings applied once at startup.
    // WAL: concurrent readers during a writer; survives the same way across crashes.
    // busy_timeout: block instead of failing on SQLITE_BUSY for up to 5 s.
    // synchronous=NORMAL: safe with WAL, ~2x faster than FULL.
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA busy_timeout=5000")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA synchronous=NORMAL")
        .execute(&pool)
        .await?;

    Ok(pool)
}

pub async fn migrate(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS vaults (
            address TEXT PRIMARY KEY,
            asset   TEXT NOT NULL,
            owner   TEXT NOT NULL,
            name    TEXT NOT NULL,
            symbol  TEXT NOT NULL,
            block   INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS requests (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            vault         TEXT    NOT NULL,
            request_id    TEXT    NOT NULL,
            kind          TEXT    NOT NULL CHECK(kind IN ('deposit', 'redeem')),
            controller    TEXT    NOT NULL,
            owner         TEXT    NOT NULL,
            sender        TEXT    NOT NULL,
            amount        TEXT    NOT NULL,
            block         INTEGER NOT NULL,
            status        TEXT    NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending', 'processing', 'done', 'failed')),
            failed_reason TEXT,
            tx_hash       TEXT,
            attempts      INTEGER NOT NULL DEFAULT 0,
            next_retry_at INTEGER NOT NULL DEFAULT 0,
            UNIQUE(vault, request_id, kind, block)
        )",
    )
    .execute(pool)
    .await?;

    // Indices: pending scan (status + next_retry_at + block), vault lookups.
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_requests_pending
         ON requests(status, next_retry_at, block)",
    )
    .execute(pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_requests_vault ON requests(vault)")
        .execute(pool)
        .await?;

    // Persistent cursor so the watcher survives restarts
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS indexer_state (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

// ── Vaults ───────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow, serde::Serialize)]
pub struct Vault {
    pub address: String,
    pub asset: String,
    pub owner: String,
    pub name: String,
    pub symbol: String,
    pub block: i64,
}

pub async fn get_vaults(pool: &SqlitePool) -> Result<Vec<Vault>> {
    let rows = sqlx::query_as::<_, Vault>(
        "SELECT address, asset, owner, name, symbol, block FROM vaults ORDER BY block ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn upsert_vault(
    pool: &SqlitePool,
    address: &str,
    asset: &str,
    owner: &str,
    name: &str,
    symbol: &str,
    block: u64,
) -> Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO vaults (address, asset, owner, name, symbol, block)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(address)
    .bind(asset)
    .bind(owner)
    .bind(name)
    .bind(symbol)
    .bind(block.cast_signed())
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn vault_exists(pool: &SqlitePool, address: &str) -> Result<bool> {
    let row = sqlx::query("SELECT 1 FROM vaults WHERE address = ?1")
        .bind(address)
        .fetch_optional(pool)
        .await?;
    Ok(row.is_some())
}

// ── Requests ─────────────────────────────────────────────────────────────────

// `request_id` here refers to the ERC-7540 on-chain request identifier, not the
// row id — the name is meaningful and intentionally distinct from `id`.
#[allow(clippy::struct_field_names)]
#[derive(sqlx::FromRow)]
pub struct Request {
    pub id: i64,
    pub vault: String,
    pub request_id: String,
    pub kind: RequestKind,
    pub controller: String,
    pub amount: String,
    pub attempts: i64,
}

pub struct RequestInput<'a> {
    pub vault: &'a str,
    pub request_id: &'a str,
    pub kind: RequestKind,
    pub controller: &'a str,
    pub owner: &'a str,
    pub sender: &'a str,
    pub amount: &'a str,
    pub block: u64,
    pub process_after: i64,
}

/// Returns the number of rows inserted (0 = already known, 1 = new request).
pub async fn upsert_request(pool: &SqlitePool, req: &RequestInput<'_>) -> Result<u64> {
    let result = sqlx::query(
        "INSERT OR IGNORE INTO requests
            (vault, request_id, kind, controller, owner, sender, amount, block, next_retry_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )
    .bind(req.vault)
    .bind(req.request_id)
    .bind(req.kind.as_str())
    .bind(req.controller)
    .bind(req.owner)
    .bind(req.sender)
    .bind(req.amount)
    .bind(req.block.cast_signed())
    .bind(req.process_after)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

pub async fn get_pending_requests(pool: &SqlitePool) -> Result<Vec<Request>> {
    let now = now_epoch_secs();
    let rows = sqlx::query_as::<_, Request>(
        "SELECT id, vault, request_id, kind, controller, amount, attempts
         FROM requests
         WHERE status = ?1 AND next_retry_at <= ?2
         ORDER BY block ASC, id ASC",
    )
    .bind(RequestStatus::Pending.as_str())
    .bind(now)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

fn now_epoch_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().cast_signed())
        .unwrap_or(0)
}

pub async fn reset_stuck_processing(pool: &SqlitePool) -> Result<()> {
    sqlx::query("UPDATE requests SET status = ?1 WHERE status = ?2")
        .bind(RequestStatus::Pending.as_str())
        .bind(RequestStatus::Processing.as_str())
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_processing(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query("UPDATE requests SET status = ?2, attempts = attempts + 1 WHERE id = ?1")
        .bind(id)
        .bind(RequestStatus::Processing.as_str())
        .execute(pool)
        .await?;
    Ok(())
}

/// Reschedule a transient failure: back to pending, with an exponential backoff.
pub async fn mark_retry(pool: &SqlitePool, id: i64, delay_secs: i64, reason: &str) -> Result<()> {
    let next = now_epoch_secs() + delay_secs;
    sqlx::query(
        "UPDATE requests
         SET status = ?2, next_retry_at = ?3, failed_reason = ?4
         WHERE id = ?1",
    )
    .bind(id)
    .bind(RequestStatus::Pending.as_str())
    .bind(next)
    .bind(reason)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_done(pool: &SqlitePool, id: i64, tx_hash: &str) -> Result<()> {
    sqlx::query("UPDATE requests SET status = ?2, tx_hash = ?3 WHERE id = ?1")
        .bind(id)
        .bind(RequestStatus::Done.as_str())
        .bind(tx_hash)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_failed(pool: &SqlitePool, id: i64, reason: &str) -> Result<()> {
    sqlx::query("UPDATE requests SET status = ?2, failed_reason = ?3 WHERE id = ?1")
        .bind(id)
        .bind(RequestStatus::Failed.as_str())
        .bind(reason)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Indexer cursor ───────────────────────────────────────────────────────────

pub async fn get_last_block(pool: &SqlitePool) -> Result<Option<u64>> {
    let row = sqlx::query("SELECT value FROM indexer_state WHERE key = 'last_block'")
        .fetch_optional(pool)
        .await?;
    row.map(|r| {
        let v: String = r.get("value");
        v.parse::<u64>()
            .context("parse last_block from indexer_state")
    })
    .transpose()
}

pub async fn set_last_block(pool: &SqlitePool, block: u64) -> Result<()> {
    sqlx::query(
        "INSERT INTO indexer_state (key, value) VALUES ('last_block', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(block.to_string())
    .execute(pool)
    .await?;
    Ok(())
}
