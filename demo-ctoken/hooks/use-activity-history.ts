"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { CONFIG } from "@/lib/config";
import { querySubgraph, type HandleRoleRow } from "@/lib/subgraph";
import type { ActivityEntry, ActivityType } from "@/lib/activity";

/**
 * Activity is read from the Nox subgraph rather than `eth_getLogs` — the public
 * RPC caps log ranges at 50k blocks and cannot serve full history. The subgraph
 * indexes handle operations and ACL roles.
 *
 * Limitation: the subgraph models low-level TEE operations on handles, not
 * token-level semantics. So wrap/unwrap public amounts and the specific cToken
 * (cRLC vs cUSDC) are not recoverable here — amounts read as "Encrypted" and the
 * asset is a generic label. Decrypted/public amounts would require an archive RPC.
 */

// Map the subgraph handle `operator` (TEE op) to a user-facing activity type.
// Internal FHE primitives (SafeAdd, Le, Select, …) are intentionally ignored.
const OPERATOR_TO_TYPE: Record<string, ActivityType> = {
  Mint: "wrap",
  Burn: "unwrap",
  Transfer: "transfer",
};

// Confidential operations the wallet performed (it holds an ADMIN role on the
// resulting handle), used to derive wrap/unwrap/transfer rows.
const MY_OPS_QUERY = `
  query myOps($me: Bytes!) {
    handleRoles(
      where: { account: $me, role: ADMIN }
      first: 1000
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      blockTimestamp
      transactionHash
      handle { id operator }
    }
  }
`;

// Viewer grants the wallet made — surfaced as "delegation" activity.
const MY_DELEGATIONS_QUERY = `
  query myDelegations($me: Bytes!) {
    handleRoles(
      where: { grantedBy: $me, role: VIEWER }
      first: 1000
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      account
      blockTimestamp
      transactionHash
    }
  }
`;

function formatTimestamp(seconds: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}

export interface UseActivityHistoryResult {
  entries: ActivityEntry[];
  isLoading: boolean;
  error: string | null;
}

export function useActivityHistory(): UseActivityHistoryResult {
  const { address } = useAccount();

  const query = useQuery({
    queryKey: ["activity-history", address],
    queryFn: async (): Promise<ActivityEntry[]> => {
      if (!address) return [];
      const me = address.toLowerCase();

      const [opsRes, delegationsRes] = await Promise.all([
        querySubgraph<{ handleRoles: HandleRoleRow[] }>(MY_OPS_QUERY, { me }),
        querySubgraph<{
          handleRoles: Pick<
            HandleRoleRow,
            "account" | "blockTimestamp" | "transactionHash"
          >[];
        }>(MY_DELEGATIONS_QUERY, { me }),
      ]);

      const entries: ActivityEntry[] = [];

      // A single user action (e.g. a transfer) produces several handles in one
      // tx (Transfer + SafeAdd/SafeSub). Collapse to one row per (tx, type) by
      // keeping only user-facing operators.
      const seen = new Set<string>();
      for (const role of opsRes.handleRoles) {
        const type = OPERATOR_TO_TYPE[role.handle.operator];
        if (!type) continue;
        const id = `${role.transactionHash}-${type}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const ts = Number(role.blockTimestamp);
        entries.push({
          id,
          type,
          asset: "Confidential",
          amount: "Encrypted",
          timestamp: formatTimestamp(ts),
          sortKey: ts,
          txHash: role.transactionHash,
        });
      }

      for (const role of delegationsRes.handleRoles) {
        const ts = Number(role.blockTimestamp);
        const viewer = role.account;
        entries.push({
          id: `${role.transactionHash}-delegation-${viewer}`,
          type: "delegation",
          asset: "ACL",
          amount: viewer
            ? `${viewer.slice(0, 6)}...${viewer.slice(-4)}`
            : "—",
          timestamp: formatTimestamp(ts),
          sortKey: ts,
          txHash: role.transactionHash,
        });
      }

      // Newest first
      entries.sort((a, b) => b.sortKey - a.sortKey || b.id.localeCompare(a.id));
      return entries;
    },
    enabled: !!address,
    refetchInterval: CONFIG.timing.activityPollMs,
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
