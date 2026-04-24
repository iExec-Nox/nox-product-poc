"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getAbiItem, type AbiEvent, type Address } from "viem";

import { Shell } from "@/components/Shell";
import { Badge, MI } from "@/components/ui";
import { FACTORY_ADDRESS, getTokenByConfidential } from "@/config/contracts";
import { factoryAbi } from "@/abi/factory";

type OnChainVault = {
  address: Address;
  asset: Address;
  owner: Address;
  name: string;
  symbol: string;
  createdAt: number | null; // unix seconds (null if block timestamp couldn't be fetched)
};

type VaultCardProps = {
  name: string;
  symbol: string;
  chain: string;
  asset: string;
  createdAt: number | null;
  href: string;
};

function formatCreatedAt(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function VaultCard({ name, symbol, chain, asset, createdAt, href }: VaultCardProps) {
  const [hover, setHover] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          padding: 22,
          borderRadius: 20,
          background: "var(--ct-surface-1)",
          border: `1px solid ${hover ? "var(--ct-brand)" : "rgba(255,255,255,0.08)"}`,
          boxShadow: hover
            ? "0 0 0 1px var(--ct-brand), 0 10px 32px rgba(71,37,244,0.22)"
            : "var(--ct-shadow-glow-soft)",
          transform: hover ? "translateY(-2px)" : "none",
          transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
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
              title={name}
            >
              {name}
            </div>
            <div style={{ font: "500 13px/18px var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>
              ${symbol} · {chain}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone="brand" icon="lock">
            Confidential
          </Badge>
          <Badge tone="neutral">ERC-7540</Badge>
          <Badge tone="neutral">{asset}</Badge>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            font: "500 12px/16px var(--ct-font-ui)",
            color: "var(--ct-fg-5)",
          }}
        >
          <MI name="calendar_today" size={12} color="var(--ct-fg-5)" />
          Created {formatCreatedAt(createdAt)}
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
          View vault <MI name="arrow_forward" size={14} />
        </button>
      </div>
    </Link>
  );
}

const createdEvent = getAbiItem({ abi: factoryAbi, name: "ConfidentialERC7540Created" }) as AbiEvent;

function assetSymbol(asset: Address): string {
  // Recognize every cToken we know about (cUSDC, cRLC, …). Unknown cTokens fall back to the
  // generic ERC-7984 label.
  return getTokenByConfidential(asset)?.confidentialSymbol ?? "ERC-7984";
}

export default function DiscoverPage() {
  const publicClient = usePublicClient();

  const { data: vaults, isLoading, error } = useQuery<OnChainVault[]>({
    queryKey: ["factory-vaults", FACTORY_ADDRESS, publicClient?.chain?.id],
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
      // Deduplicate by vault address (latest wins) in case the same salt was reused.
      // Fetch unique block timestamps in parallel (one `getBlock` per unique blockNumber).
      const uniqueBlocks = Array.from(new Set(logs.map((l) => l.blockNumber).filter((b): b is bigint => b != null)));
      const blockTs = new Map<bigint, number>();
      await Promise.all(
        uniqueBlocks.map(async (bn) => {
          try {
            const b = await publicClient.getBlock({ blockNumber: bn });
            blockTs.set(bn, Number(b.timestamp));
          } catch {
            // ignore — card will fall back to "—"
          }
        }),
      );
      const byAddress = new Map<Address, OnChainVault>();
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
          createdAt: log.blockNumber != null ? (blockTs.get(log.blockNumber) ?? null) : null,
        });
      }
      return Array.from(byAddress.values());
    },
  });

  const cards = useMemo<VaultCardProps[]>(
    () =>
      (vaults ?? []).map((v) => ({
        name: v.name,
        symbol: v.symbol,
        chain: "Arbitrum Sepolia",
        asset: assetSymbol(v.asset),
        createdAt: v.createdAt,
        href: `/vault/${v.address}`,
      })),
    [vaults],
  );

  return (
    <Shell>
      <div
        style={{
          font: "800 34px/40px var(--ct-font-display)",
          color: "var(--ct-fg-1)",
          letterSpacing: "-0.9px",
        }}
      >
        Explore vaults
      </div>
      <div
        style={{
          font: "400 15px/22px var(--ct-font-body)",
          color: "var(--ct-fg-4)",
          marginTop: 8,
          marginBottom: 24,
        }}
      >
        Browse confidential vaults built on ERC-7540.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ font: "500 13px/18px var(--ct-font-ui)", color: "var(--ct-fg-4)" }}>
          {isLoading ? "Loading…" : `${cards.length} vault${cards.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "rgba(229,115,115,0.08)",
            border: "1px solid rgba(229,115,115,0.30)",
            color: "var(--ct-warn, #e57373)",
            font: "500 13px/19px var(--ct-font-body)",
          }}
        >
          Failed to load vaults: {error instanceof Error ? error.message : String(error)}
        </div>
      ) : cards.length === 0 && !isLoading ? (
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
          No vaults deployed by the factory yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {cards.map((c) => (
            <VaultCard key={c.href} {...c} />
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          padding: "13px 16px",
          borderRadius: 12,
          background: "rgba(116,142,255,0.06)",
          border: "1px solid var(--ct-brand-border)",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <MI name="lock" size={16} color="var(--ct-brand)" />
        <span style={{ font: "500 13px/19px var(--ct-body)", color: "var(--ct-fg-3)" }}>
          Individual balances remain encrypted and visible only to authorized parties.
        </span>
      </div>
    </Shell>
  );
}
