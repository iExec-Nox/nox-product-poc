import { SUBGRAPH_URL } from "@/lib/config";

/**
 * Minimal GraphQL client for the Nox subgraph.
 *
 * The Delegated View and Activity Explorer read on-chain ACL/handle data from
 * the subgraph rather than `eth_getLogs`: the public RPC caps log ranges at
 * 50k blocks and cannot serve the full history (`fromBlock: 0`). The subgraph
 * indexes the NoxCompute handle and role events with timestamps and tx hashes.
 */
export async function querySubgraph<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Subgraph request failed (HTTP ${res.status})`);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "Subgraph query error");
  }
  if (!json.data) {
    throw new Error("Subgraph returned no data");
  }

  return json.data;
}

/** Roles in the Nox subgraph ACL. */
export type SubgraphRole = "ADMIN" | "VIEWER";

/** A `HandleRole` row as indexed by the subgraph. */
export interface HandleRoleRow {
  id: string;
  account: string;
  grantedBy: string;
  role: SubgraphRole;
  blockTimestamp: string;
  transactionHash: string;
  handle: { id: string; operator: string };
}
