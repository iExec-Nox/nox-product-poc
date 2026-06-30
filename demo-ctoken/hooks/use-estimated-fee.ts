"use client";

import { useMemo } from "react";
import { useGasPrice } from "wagmi";
import { formatEther } from "viem";

interface UseEstimatedFeeResult {
  /** Formatted fee string (e.g. "0.0003") or null if not yet available */
  fee: string | null;
  isLoading: boolean;
}

/**
 * Estimates the network fee for a transaction based on current gas price.
 * @param gasLimit - Estimated gas units for the operation
 */
export function useEstimatedFee(gasLimit: bigint): UseEstimatedFeeResult {
  const { data: gasPrice, isLoading } = useGasPrice();

  const fee = useMemo(() => {
    if (!gasPrice) return null;
    const raw = formatEther(gasPrice * gasLimit);
    // Show up to 6 significant decimals, trim trailing zeros
    const trimmed = parseFloat(raw);
    if (trimmed === 0) return "< 0.000001";
    return `~${trimmed.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
  }, [gasPrice, gasLimit]);

  return { fee, isLoading };
}
