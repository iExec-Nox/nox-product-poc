"use client";

import { useMemo } from "react";
import { useBalance, useReadContracts, useAccount, useChainId } from "wagmi";
import { erc20Abi } from "viem";
import { erc20Tokens, nativeToken } from "@/lib/tokens";
import { formatBalance } from "@/lib/format";
import { ZERO_ADDRESS } from "@/lib/contracts";

export interface TokenBalance {
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  balance: bigint;
  formatted: string;
}

export function useTokenBalances() {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const isReady = isConnected && !!address;
  const isReconnecting = status === "reconnecting" || status === "connecting";

  const {
    data: nativeBalance,
    isLoading: isNativeLoading,
  } = useBalance({
    address,
    chainId,
    query: { enabled: isReady },
  });

  const {
    data: erc20Results,
    isLoading: isErc20Loading,
  } = useReadContracts({
    contracts: erc20Tokens.map((token) => ({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address ?? ZERO_ADDRESS],
      chainId,
    })),
    query: { enabled: isReady },
  });

  const balances = useMemo(() => {
    const result: TokenBalance[] = [];

    if (nativeToken) {
      const raw = nativeBalance?.value ?? 0n;
      result.push({
        symbol: nativeToken.symbol,
        name: nativeToken.name,
        decimals: nativeToken.decimals,
        icon: nativeToken.icon,
        balance: raw,
        formatted: formatBalance(raw, nativeToken.decimals),
      });
    }

    erc20Tokens.forEach((token, i) => {
      const entry = erc20Results?.[i];
      const raw =
        entry?.status === "success" ? (entry.result as bigint) : 0n;
      result.push({
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        icon: token.icon,
        balance: raw,
        formatted: formatBalance(raw, token.decimals),
      });
    });

    return result;
  }, [nativeBalance, erc20Results]);

  const hasAnyBalance = balances.some((b) => b.balance > 0n);

  const isLoading = !isReady || isReconnecting || isNativeLoading || isErc20Loading;

  return { balances, hasAnyBalance, isLoading };
}
