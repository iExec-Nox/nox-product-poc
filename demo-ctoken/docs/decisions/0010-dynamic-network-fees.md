# ADR-0010: Dynamic Network Fees

**Date:** 2026-03-07
**Status:** Accepted

## Context

Network fees displayed in wrap and transfer modals are hardcoded (`~0.0001 ETH` and `~0.0004 ETH`). This can mislead users about actual transaction costs, especially when gas prices fluctuate on Arbitrum Sepolia.

## Decision

Create a `useEstimatedFee` hook that uses wagmi's `useGasPrice()` to fetch real-time gas prices, multiplied by operation-specific gas limits. Replace all hardcoded fee displays in modals.

## Approach

- **Hook:** `hooks/use-estimated-fee.ts` — `useGasPrice()` x `gasLimit` param, formatted via `formatEther`
- **Wrap modal:** ~150k gas (approve + wrap), ~300k gas (unwrap 3-step)
- **Transfer modal:** ~200k gas (encrypt + confidentialTransfer)
- Auto-refreshes with each new block (wagmi default behavior)

## Consequences

- Users see accurate fee estimates before confirming transactions
- Fees update in real-time as network conditions change
- No additional RPC calls beyond what wagmi already manages
