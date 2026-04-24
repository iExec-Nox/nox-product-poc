"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

/**
 * Response from the vault-settler public snapshot endpoint. The decrypted totals are provided
 * because the settler holds the admin's Nox ACL grant on the vault's totalAssets / totalSupply
 * handles — the API is effectively a publicly-cached mirror of what the admin sees off-chain.
 *
 * `nav` is the raw atomic ratio `decrypted_total_assets / decrypted_total_supply`. When the
 * vault declares a `_decimalsOffset` (virtual-share inflation defense), that ratio is smaller
 * than the "display" NAV by a factor of `10^offset`. Multiply by `10^offset` before rendering.
 */
export type VaultSnapshot = {
  address: Address;
  apy: number;
  confidential_total_assets: `0x${string}`;
  confidential_total_supply: `0x${string}`;
  decrypted_total_assets: string;
  decrypted_total_supply: string;
  nav: string;
};

const SETTLER_BASE_URL =
  "https://vault-settler.arbitrum-sepolia-testnet.iex.ec/api/snapshot";

export function useVaultSnapshot(vaultAddress: Address | undefined) {
  return useQuery<VaultSnapshot>({
    queryKey: ["vault-snapshot", vaultAddress?.toLowerCase()],
    enabled: !!vaultAddress,
    // Settler cache refreshes on-chain state every ~30s; avoid hammering it from every tile.
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await fetch(`${SETTLER_BASE_URL}/${vaultAddress}`);
      if (!res.ok) throw new Error(`snapshot HTTP ${res.status}`);
      return (await res.json()) as VaultSnapshot;
    },
  });
}
