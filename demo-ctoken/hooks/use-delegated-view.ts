"use client";

import { useAccount, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { confidentialTokenAbi } from "@/lib/confidential-token-abi";
import { CONTRACTS, ZERO_HANDLE } from "@/lib/contracts";
import { querySubgraph, type HandleRoleRow } from "@/lib/subgraph";
import type { DelegatedViewEntry, TokenInfo } from "@/lib/delegated-view";
import type { PublicClient } from "viem";

const TOKEN_PAIRS = [
  { cToken: CONTRACTS.cRLC as `0x${string}`, symbol: "cRLC", decimals: 9 },
  { cToken: CONTRACTS.cUSDC as `0x${string}`, symbol: "cUSDC", decimals: 6 },
] as const;

// Viewer grants where the connected wallet is the viewer (shared with me).
const SHARED_WITH_ME_QUERY = `
  query sharedWithMe($me: Bytes!) {
    handleRoles(
      where: { account: $me, role: VIEWER }
      first: 1000
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      account
      grantedBy
      role
      blockTimestamp
      transactionHash
      handle { id operator }
    }
  }
`;

// Viewer grants the connected wallet has made to others (my grants).
const MY_GRANTS_QUERY = `
  query myGrants($me: Bytes!) {
    handleRoles(
      where: { grantedBy: $me, role: VIEWER }
      first: 1000
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      account
      grantedBy
      role
      blockTimestamp
      transactionHash
      handle { id operator }
    }
  }
`;

// ── Helpers ────────────────────────────────────────────────────────

/**
 * For each address × cToken, read `confidentialBalanceOf` to get the current
 * handle. This lets us: (1) identify which token a handle belongs to, and
 * (2) determine if the grant is still active (handle == current balance handle).
 *
 * This is a plain `eth_call` (not a log query), so it works on the public RPC.
 */
async function buildHandleTokenMap(
  publicClient: PublicClient,
  addresses: Set<`0x${string}`>,
): Promise<Map<string, TokenInfo>> {
  const map = new Map<string, TokenInfo>();
  await Promise.all(
    [...addresses].flatMap((addr) =>
      TOKEN_PAIRS.map(async (pair) => {
        try {
          const handle = await publicClient.readContract({
            address: pair.cToken,
            abi: confidentialTokenAbi,
            functionName: "confidentialBalanceOf",
            args: [addr],
          });
          if (handle && handle !== ZERO_HANDLE) {
            map.set((handle as string).toLowerCase(), {
              symbol: pair.symbol,
              decimals: pair.decimals,
            });
          }
        } catch {
          // Contract call failed — skip
        }
      }),
    ),
  );
  return map;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useDelegatedView() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ["delegated-view", address],
    queryFn: async () => {
      if (!address || !publicClient)
        return { sharedWithMe: [], myGrants: [] };

      const me = address.toLowerCase();

      // 1. Fetch viewer grants in both directions from the subgraph
      const [sharedRes, grantsRes] = await Promise.all([
        querySubgraph<{ handleRoles: HandleRoleRow[] }>(SHARED_WITH_ME_QUERY, {
          me,
        }),
        querySubgraph<{ handleRoles: HandleRoleRow[] }>(MY_GRANTS_QUERY, {
          me,
        }),
      ]);
      const sharedRoles = sharedRes.handleRoles;
      const grantRoles = grantsRes.handleRoles;

      // 2. Collect addresses for handle→token resolution. Handles shared with
      //    me belong to the grantor; my grants are on my own balance handles.
      const addressesToCheck = new Set<`0x${string}`>();
      addressesToCheck.add(address);
      for (const role of sharedRoles) {
        if (role.grantedBy) addressesToCheck.add(role.grantedBy as `0x${string}`);
      }

      // 3. Build handle → token mapping from current balances
      const handleTokenMap = await buildHandleTokenMap(
        publicClient,
        addressesToCheck,
      );

      // 4. Build entries
      const toEntry = (
        role: HandleRoleRow,
        counterparty: string,
      ): DelegatedViewEntry => {
        const token = handleTokenMap.get(role.handle.id.toLowerCase()) ?? null;
        return {
          id: role.id,
          handleId: role.handle.id,
          counterparty,
          token,
          isActive: token !== null,
          timestamp: Number(role.blockTimestamp),
          txHash: role.transactionHash,
        };
      };

      const sharedWithMe = sharedRoles.map((r) => toEntry(r, r.grantedBy));
      const myGrants = grantRoles.map((r) => toEntry(r, r.account));

      return { sharedWithMe, myGrants };
    },
    enabled: !!address && !!publicClient,
    refetchInterval: 30_000,
  });

  return {
    sharedWithMe: query.data?.sharedWithMe ?? [],
    myGrants: query.data?.myGrants ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
