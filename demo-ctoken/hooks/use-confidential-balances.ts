"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { isAddress } from "viem";
import { confidentialTokenAbi } from "@/lib/confidential-token-abi";
import { confidentialTokens } from "@/lib/tokens";
import { ZERO_ADDRESS, ZERO_HANDLE } from "@/lib/contracts";

export interface ConfidentialBalance {
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  /** The raw handle (bytes32). Zero if no balance or not yet loaded. */
  handle: `0x${string}`;
  /** Address of the confidential token contract. */
  contractAddress: string;
  /** Whether the handle is non-zero (i.e. user has interacted with this token). */
  isInitialized: boolean;
}

export function useConfidentialBalances() {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const isReady = isConnected && !!address;
  const isReconnecting = status === "reconnecting" || status === "connecting";

  // Filter tokens that have a real confidential address (not placeholder "0x...")
  const activeTokens = useMemo(
    () => confidentialTokens.filter((t) => t.address && isAddress(t.address)),
    [],
  );

  const { data: results, isLoading: isContractLoading } = useReadContracts({
    contracts: activeTokens.map((token) => ({
      address: token.address as `0x${string}`,
      abi: confidentialTokenAbi,
      functionName: "confidentialBalanceOf" as const,
      args: [address ?? ZERO_ADDRESS],
      chainId,
    })),
    query: { enabled: isReady && activeTokens.length > 0 },
  });

  const balances = useMemo(() => {
    return activeTokens.map((token, i): ConfidentialBalance => {
      const entry = results?.[i];
      const handle =
        entry?.status === "success"
          ? (entry.result as `0x${string}`)
          : ZERO_HANDLE;

      return {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        icon: token.icon,
        handle,
        contractAddress: token.address!,
        isInitialized: handle !== ZERO_HANDLE,
      };
    });
  }, [activeTokens, results]);

  const hasAnyConfidentialBalance = balances.some((b) => b.isInitialized);

  const isLoading = !isReady || isReconnecting || isContractLoading;

  return { balances, hasAnyConfidentialBalance, isLoading };
}
