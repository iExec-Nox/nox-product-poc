import type { PublicClient } from "viem";

/**
 * Arbitrum Sepolia's base fee can tick up between the moment viem pre-estimates fees and the
 * moment the RPC accepts the tx — producing "maxFeePerGas less than block base fee" reverts.
 * Fetch the current base fee and pad `maxFeePerGas` generously so the tx doesn't get rejected
 * by a small basefee jump.
 */
export async function bumpFees(publicClient: PublicClient): Promise<{
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}> {
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const base = block.baseFeePerGas ?? 0n;
  const priority = 100_000_000n; // 0.1 gwei tip
  // 3× headroom + priority — safe for Arbitrum where basefees are tiny.
  return {
    maxFeePerGas: base * 3n + priority,
    maxPriorityFeePerGas: priority,
  };
}
