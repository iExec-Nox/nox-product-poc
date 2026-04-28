# Confidential Vault — Settler

Rust backend for the confidential vault system. Detects deposit/redeem requests emitted on-chain and automatically approves them by calling the vault contracts.

---

## Architecture

``` text
┌──────────────────────────────────────────────────────────┐
│                      settler                             │
│                                                          │
│  ┌──────────┐   eth_getLogs    ┌──────────────────┐      │
│  │  Watcher │ ──────────────►  │                  │      │
│  │          │                  │   SQLite (DB)    │      │
│  │ poll/5s  │ ◄──────────────  │                  │      │
│  └──────────┘   last_block     └────────┬─────────┘      │
│                                         │                │
│  ┌───────────┐  approve tx    ┌─────────▼─────────┐      │
│  │ Processor │ ──────────────►│  pending requests │      │
│  │           │                └───────────────────┘      │
│  │ poll/5s   │                                           │
│  └───────────┘                                           │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │  HTTP API  /health  /api/settler  /api/vaults     │   │
│  │            /api/snapshot/{address}                │   │
│  └──────────────────────┬────────────────────────────┘   │
│                         │ /api/snapshot                  │
│  ┌──────────────────────▼────────────────────────────┐   │
│  │  GatewayClient  GET /v0/secrets/{handle}          │   │
│  │  RSA key pair (once at startup)  ·  AES-GCM       │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
         │                      │                 │
         ▼                      ▼                 ▼
   Arbitrum RPC        Nox Handle Gateway     Frontend
```

Two independent tokio tasks run in parallel alongside the HTTP server:

- **Watcher** — indexes `VaultCreated`, `DepositRequest`, `RedeemRequest` events via `eth_getLogs`. Resumes from the last indexed block on restart. Exponential backoff (default 1s → 60s) on RPC errors.
- **Processor** — drains the `pending` queue and calls `approveDeposits` or `approveRedeems` on-chain using the settler's private key. The transaction hash is persisted on the row. Transient errors (RPC, confirmation timeout) are rescheduled with exponential backoff up to `max_attempts` (default 5); local validation errors (invalid address/handle) are immediately marked `failed`.

Both tasks share a `CancellationToken`: on `SIGINT`/`SIGTERM`, the HTTP server stops, the token is cancelled, and each loop exits cleanly (no in-flight transaction is lost — the confirmation `watch()` is interruptible).

---

## Technical choices

### Alloy (not ethers-rs)

Alloy is the modern rewrite of ethers-rs, maintained by the same team. The `sol!` macro generates event types and contract bindings at compile time — no JSON ABI file to maintain, and `SIGNATURE_HASH` constants are directly available.

### Topic-based indexing without address filter

The `eth_getLogs` filter uses only event signatures (topic0) without filtering by contract address. This enables dynamic vault discovery: a `VaultCreated` registers the address in the database, and subsequent `DepositRequest`/`RedeemRequest` events are validated against that list. A vault deployed after the settler starts is automatically picked up.

### `assets` and `shares` as `bytes32`

In the Nox protocol, amounts are encrypted handles (`euint256`), represented on-chain as `bytes32`. The settler treats them opaquely (hex storage, direct forwarding to `approveDeposits`/`approveRedeems`) and never decrypts them.

### SQLite

Sufficient for a PoC/demo: zero infrastructure, single file, ACID transactions. The pool is capped at 5 connections. The `indexer_state` table acts as a persistent cursor — the watcher resumes exactly where it stopped after a restart. `journal_mode=WAL`, `busy_timeout=5000`, and `synchronous=NORMAL` PRAGMAs are set at pool initialization to allow concurrent reads (HTTP server) during writes (watcher/processor) without blocking.

### Sequential log processing

`eth_getLogs` guarantees order `(block_number, tx_index, log_index)`. Processing is intentionally sequential (no `tokio::spawn` per log): if a `VaultCreated` and a `DepositRequest` are emitted in the same transaction, the vault is guaranteed to be in the database before its first request is processed.

### Sequential processor

One on-chain call at a time, no nonce management. Sufficient for the PoC. A production version would batch approvals and manage nonces explicitly.

### Retry and error classification

`ProcessError::Permanent` (local validation: malformed address, invalid handle) → immediate `status='failed'`. `ProcessError::Transient` (RPC, confirmation > `confirm_timeout_secs`) → `status='pending'` with `next_retry_at = now + backoff`, up to `max_attempts`. Backoff is exponential starting from `backoff_base_secs` (default 5s: 5, 10, 20, 40, 80). A `reset_stuck_processing` call at startup resets any rows stuck in `processing` state due to a crash back to `pending`.

### Private key

Stored as a `SecretString` (crate `secrecy`), redacted in `Debug`. A single signer is constructed at startup and shared between the watcher and processor via the same `Provider`.

### Crate `config`

Configuration loaded via `config::Environment` with the prefix `SETTLER_` and separator `__` for nested fields (e.g. `SETTLER_CHAIN__RPC_URL`). Defaults are declared in code; no config file is required.

---

## Configuration

Loaded via the `config` crate: all keys are read from the environment with the prefix `SETTLER_` and the separator `__` for nested fields. Values marked `—` are required; others have a default.

### Chain

| Variable | Default | Description |
| --- | --- | --- |
| `SETTLER_CHAIN__RPC_URL` | — | Arbitrum RPC (Alchemy, Infura…) |
| `SETTLER_CHAIN__PRIVATE_KEY` | — | Settler wallet private key (whitelisted on vaults) |
| `SETTLER_CHAIN__FACTORY_ADDRESS` | — | Factory address that emits `VaultCreated` |
| `SETTLER_CHAIN__START_BLOCK` | `0` | Indexing start block (set to the factory deployment block) |
| `SETTLER_CHAIN__CONFIRMATION_DEPTH` | `1` | Confirmation depth before indexing a block |
| `SETTLER_CHAIN__MAX_FEE_PER_GAS` | auto | EIP-1559 max fee cap (wei). Leave empty to follow the RPC suggestion |
| `SETTLER_CHAIN__MAX_PRIORITY_FEE_PER_GAS` | auto | EIP-1559 priority fee cap (wei) |

### DB / Server

| Variable | Default | Description |
| --- | --- | --- |
| `SETTLER_DB__PATH` | `settler.db` | SQLite file path (WAL enabled automatically) |
| `SETTLER_SERVER__HOST` | `127.0.0.1` | HTTP listen interface |
| `SETTLER_SERVER__PORT` | `3001` | HTTP port |

### Indexer (watcher)

| Variable | Default | Description |
| --- | --- | --- |
| `SETTLER_INDEXER__POLL_INTERVAL_SECS` | `5` | Delay between polls when caught up to the tip |
| `SETTLER_INDEXER__CHUNK_SIZE` | `100` | Number of blocks per `eth_getLogs` call |
| `SETTLER_INDEXER__BACKOFF_INITIAL_SECS` | `1` | Initial backoff on RPC error |
| `SETTLER_INDEXER__BACKOFF_MAX_SECS` | `60` | Maximum backoff on RPC error |

### Processor

| Variable | Default | Description |
| --- | --- | --- |
| `SETTLER_PROCESSOR__POLL_INTERVAL_SECS` | `5` | Delay between scans of the `pending` queue |
| `SETTLER_PROCESSOR__MAX_ATTEMPTS` | `5` | Maximum attempts before marking `failed` |
| `SETTLER_PROCESSOR__CONFIRM_TIMEOUT_SECS` | `120` | Timeout waiting for transaction confirmation |
| `SETTLER_PROCESSOR__BACKOFF_BASE_SECS` | `5` | Base for exponential retry backoff |

### Gateway (optional decryption)

| Variable | Default | Description |
| --- | --- | --- |
| `SETTLER_GATEWAY__URL` | _(disabled)_ | Nox Handle Gateway base URL. If absent, `/api/snapshot` returns raw handles without decryption |
| `SETTLER_GATEWAY__CHAIN_ID` | `421614` | Chain ID used in the EIP-712 `DataAccessAuthorization` domain |
| `SETTLER_GATEWAY__NOX_COMPUTE_ADDRESS` | `0xd464B1…` | `NoxCompute` proxy address (EIP-712 domain verifying contract) |

### Misc

| Variable | Default | Description |
| --- | --- | --- |
| `RUST_LOG` | — | Log level (e.g. `settler=info,tower_http=debug`) |

Copy `.env.example` and fill in the required values.

---

## Running

```bash
cargo run --bin settler
```

```bash
# Service health (200 if watcher + processor are alive, 503 otherwise)
# → {"status":"ok","watcher":"alive","processor":"alive"}
curl http://localhost:3001/health

# Settler info (factory + wallet address)
curl http://localhost:3001/api/settler

# List indexed vaults
curl http://localhost:3001/api/vaults

# Vault snapshot (encrypted handles + decryption via gateway)
curl http://localhost:3001/api/snapshot/0xABCD…

# Prometheus metrics (indexer_*, processor_*)
curl http://localhost:3001/metrics
```

### `GET /api/snapshot/{address}`

Returns a financial snapshot of a confidential vault at the given address.

**Step 1 — on-chain read**: calls `confidentialTotalAssets()` and `confidentialTotalSupply()` view functions on the contract, which return `bytes32` handles (encrypted values).

**Step 2 — gateway decryption** (if `SETTLER_GATEWAY__URL` is configured and handles are non-zero): the settler signs a `DataAccessAuthorization` EIP-712 token with its own private key, sends the request to `GET /v0/secrets/{handle}`, retrieves the crypto material encrypted for its RSA key (generated once at startup), and decrypts locally via RSA-OAEP + HKDF-SHA256 + AES-256-GCM.

**Edge cases**: if a handle equals `bytes32(0)` (empty vault, no deposit yet), decrypted values and NAV are set to `"0"` without calling the gateway.

**Response**:

```json
{
  "address": "0xABCD…",
  "confidential_total_assets": "0x1a2b…",
  "confidential_total_supply": "0x3c4d…",
  "decrypted_total_assets": "1000000000000000000",
  "decrypted_total_supply": "500000000000000000",
  "nav": "2.000000000",
  "apy": 0.05
}
```

| Field | Type | Description |
| --- | --- | --- |
| `confidential_total_assets` | `string` (hex) | Raw `bytes32` handle returned by the contract |
| `confidential_total_supply` | `string` (hex) | Raw `bytes32` handle returned by the contract |
| `decrypted_total_assets` | `string` \| `null` | Decrypted amount in wei (decimal). `null` if gateway not configured or ACL missing |
| `decrypted_total_supply` | `string` \| `null` | Decrypted amount in wei (decimal). `null` if gateway not configured or ACL missing |
| `nav` | `string` \| `null` | `assets / supply` with 9 decimal places. `"0"` if supply is zero |
| `apy` | `number` | Simulated target APY (5%) |

> **ACL required**: the settler wallet must be authorized as a viewer (`isViewer`) on the vault's `confidentialTotalAssets` and `confidentialTotalSupply` handles. Without ACL, the gateway returns 403 and decrypted fields are `null`.

### Exposed metrics

| Name | Type | Labels | Description |
| --- | --- | --- | --- |
| `indexer_last_block` | gauge | — | Last confirmed block indexed |
| `indexer_logs_processed_total` | counter | `kind` | Number of `DepositRequest`/`RedeemRequest` events indexed |
| `indexer_getlogs_duration_seconds` | histogram | — | `eth_getLogs` latency |
| `indexer_rpc_errors_total` | counter | `source` | RPC errors (`get_block_number`, `get_logs`) |
| `processor_approve_total` | counter | `kind`, `status` | On-chain confirmed approvals |
| `processor_confirm_duration_seconds` | histogram | `kind` | `send → confirm` latency |
| `processor_retry_scheduled_total` | counter | `kind` | Retries rescheduled after transient error |
| `processor_permanent_failures_total` | counter | `kind`, `reason` | Permanent failures (`permanent` or `max_attempts` reached) |

---

## Structure

``` text
src/
├── main.rs        # Tracing init, config loading, calls server::run()
├── server.rs      # server::run() — single signing provider, spawn watcher/processor,
│                  # HTTP + cooperative shutdown via CancellationToken
├── config.rs      # Config (ChainConfig, DbConfig, ServerConfig, IndexerConfig,
│                  # ProcessorConfig) via config crate; ChainConfig::Debug redacted
├── state.rs       # AppState + TaskHealth (watcher/processor liveness flags)
├── abi.rs         # Solidity definitions via sol! (events + IVault)
├── types.rs       # RequestKind / RequestStatus enums (sqlx::Type, Display)
├── db.rs          # SQLite pool (WAL), schema, indexes, all queries
├── gateway.rs     # GatewayClient — EIP-712 auth, RSA key pair (generated once at startup),
│                  # /v0/secrets/{handle} call, RSA-OAEP + HKDF + AES-GCM decryption
├── watcher.rs     # On-chain event indexing (exponential RPC backoff)
├── processor.rs   # Pending queue drain, Permanent/Transient classification, retry + timeout
├── metrics.rs     # Prometheus recorder setup + metric constants
└── routes/
    └── vault.rs   # GET /health, /metrics, /api/settler, /api/vaults, /api/snapshot/{address}
```
