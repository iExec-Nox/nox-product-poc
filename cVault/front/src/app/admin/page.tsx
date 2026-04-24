"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount, usePublicClient, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getAbiItem, type AbiEvent, type Address } from "viem";

import { Shell } from "@/components/Shell";
import { Badge, Card, MI } from "@/components/ui";
import { FACTORY_ADDRESS } from "@/config/contracts";
import { factoryAbi } from "@/abi/factory";
import { vaultAbi } from "@/abi/vault";

type FactoryVault = {
  address: Address;
  asset: Address;
  owner: Address;
  name: string;
  symbol: string;
};

const createdEvent = getAbiItem({ abi: factoryAbi, name: "ConfidentialERC7540Created" }) as AbiEvent;

export default function AdminPickerPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const { data: vaults, isLoading } = useQuery<FactoryVault[]>({
    queryKey: ["admin-factory-vaults", FACTORY_ADDRESS, publicClient?.chain?.id],
    enabled: !!publicClient,
    staleTime: 30_000,
    queryFn: async () => {
      if (!publicClient) return [];
      const logs = await publicClient.getLogs({
        address: FACTORY_ADDRESS,
        event: createdEvent,
        fromBlock: 0n,
        toBlock: "latest",
      });
      const byAddress = new Map<Address, FactoryVault>();
      for (const log of logs) {
        const args = log.args as {
          vault?: Address;
          asset?: Address;
          initialOwner?: Address;
          name?: string;
          symbol?: string;
        };
        if (!args.vault || !args.asset) continue;
        byAddress.set(args.vault, {
          address: args.vault,
          asset: args.asset,
          owner: args.initialOwner ?? ("0x" as Address),
          name: args.name ?? "Confidential Vault",
          symbol: args.symbol ?? "cvTOKEN",
        });
      }
      return Array.from(byAddress.values());
    },
  });

  // Re-read owner() on-chain for each vault: the event arg is `initialOwner` which may be stale
  // if ownership has since been transferred.
  const ownerReads = useReadContracts({
    contracts: (vaults ?? []).map((v) => ({
      address: v.address,
      abi: vaultAbi as typeof vaultAbi,
      functionName: "owner" as const,
    })),
    query: { enabled: !!vaults && vaults.length > 0 },
  });

  const ownedVaults = useMemo(() => {
    if (!vaults || !address) return [];
    const me = address.toLowerCase();
    return vaults.filter((v, i) => {
      const liveOwner = ownerReads.data?.[i]?.result as Address | undefined;
      const effectiveOwner = (liveOwner ?? v.owner) as Address;
      return effectiveOwner?.toLowerCase() === me;
    });
  }, [vaults, ownerReads.data, address]);

  if (!isConnected) {
    return (
      <Shell>
        <Card title="Connect wallet">Please connect to access admin actions.</Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div
            style={{
              font: "700 12px/16px var(--ct-font-ui)",
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "var(--ct-fg-5)",
            }}
          >
            Admin
          </div>
          <h1
            style={{
              margin: "8px 0 0",
              font: "800 32px/40px var(--ct-font-display)",
              letterSpacing: "-0.9px",
              color: "var(--ct-fg-1)",
            }}
          >
            Your vaults
          </h1>
          <div style={{ font: "400 15px/22px var(--ct-font-body)", color: "var(--ct-fg-4)", marginTop: 8 }}>
            Pick a vault to approve pending deposit and redeem requests.
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ font: "500 13px/18px var(--ct-font-ui)", color: "var(--ct-fg-4)" }}>Loading…</div>
      ) : ownedVaults.length === 0 ? (
        <div
          style={{
            padding: 24,
            borderRadius: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed rgba(255,255,255,0.14)",
            color: "var(--ct-fg-4)",
            font: "500 14px/20px var(--ct-font-body)",
            textAlign: "center",
          }}
        >
          No vaults to administer
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {ownedVaults.map((v) => (
            <Link key={v.address} href={`/admin/${v.address}`} style={{ textDecoration: "none" }}>
              <div
                style={{
                  padding: 22,
                  borderRadius: 20,
                  background: "var(--ct-surface-1)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "var(--ct-shadow-glow-soft)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "rgba(116,142,255,0.14)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--ct-brand-border)",
                      flexShrink: 0,
                    }}
                  >
                    <MI name="account_balance" size={22} color="var(--ct-brand)" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        font: "800 18px/22px var(--ct-font-display)",
                        color: "var(--ct-fg-1)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={v.name}
                    >
                      {v.name}
                    </div>
                    <div style={{ font: "500 13px/18px var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>
                      ${v.symbol}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge tone="success" icon="verified">
                    You own this
                  </Badge>
                  <Badge tone="neutral">cERC-7540</Badge>
                </div>

                <div
                  style={{
                    font: "500 11px/16px ui-monospace, Menlo, monospace",
                    color: "var(--ct-fg-5)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={v.address}
                >
                  {v.address}
                </div>

                <button
                  style={{
                    height: 42,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    font: "700 14px/20px var(--ct-font-display)",
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  Administer <MI name="arrow_forward" size={14} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
