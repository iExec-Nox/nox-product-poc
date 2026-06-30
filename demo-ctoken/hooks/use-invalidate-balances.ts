"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Returns a function that invalidates all wagmi balance queries
 * (native ETH, ERC-20, and confidential balances).
 * Call after a successful wrap/unwrap/transfer to auto-refresh the dashboard.
 */
export function useInvalidateBalances() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["balance"] });
    queryClient.invalidateQueries({ queryKey: ["readContracts"] });
  }, [queryClient]);
}
