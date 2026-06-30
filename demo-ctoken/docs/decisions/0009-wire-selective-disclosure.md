# ADR-0009: Wire Selective Disclosure (addViewer) with SDK

## Status

Accepted

## Context

The Selective Disclosure modal UI exists with mock data. We need to wire the "Grant Access" button to call `addViewer(bytes32, address)` on the NoxCompute contract. The `addViewer` function selector (`0x10ff39ca`) was confirmed on-chain by matching bytecode selectors of the NoxCompute implementation contract.

Current Viewers and Past Viewers sections remain with mock data — no subgraph available yet.

## Decision

### 1. NoxCompute ABI (`lib/nox-compute-abi.ts`)

Export ABI fragments for `addViewer` and `isViewer`, plus the NoxCompute contract address.

### 2. Hook (`hooks/use-add-viewer.ts`)

New hook following the `useConfidentialTransfer` pattern:
- Steps: `idle` > `reading-handle` > `granting` > `confirmed` > `error`
- Reads `confidentialBalanceOf` to get the current balance handle
- Calls `addViewer(handle, viewerAddress)` on NoxCompute for each selected token
- Returns `step`, `error`, `txHash`, `grant()`, `reset()`

### 3. Modal wiring (`components/selective-disclosure-modal.tsx`)

- Wire `useAddViewer` hook to "Grant Access" button
- Add progress tracker (Read Handle > Grant Access > Confirmed)
- Show confirmed state with Arbiscan link
- Update DevMode code snippet with real `addViewer` call

## Consequences

- Selective Disclosure is functional on-chain for cRLC (only deployed confidential token)
- ACL is per-handle: viewer access invalidated after any balance-changing tx
- No revoke capability (contract doesn't support `removeViewer`)
- Viewer lists remain mock until subgraph is available
