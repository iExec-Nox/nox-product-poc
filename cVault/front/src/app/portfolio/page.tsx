"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getAbiItem, type AbiEvent, type Address } from "viem";

import { Shell } from "@/components/Shell";
import { Badge, MI, PrimaryButton } from "@/components/ui";
import { MetricTile } from "@/components/lp";
import { DecryptedAmount } from "@/components/DecryptedAmount";

import { FACTORY_ADDRESS, ZERO_HANDLE } from "@/config/contracts";
import { factoryAbi } from "@/abi/factory";
import { vaultAbi } from "@/abi/vault";

type FactoryVault = {
  address: Address;
  asset: Address;
  name: string;
  symbol: string;
};

type PositionSnapshot = {
  vault: FactoryVault;
  shares?: `0x${string}`;
  pendingDeposit?: `0x${string}`;
  claimableDeposit?: `0x${string}`;
  pendingRedeem?: `0x${string}`;
  claimableRedeem?: `0x${string}`;
};

const createdEvent = getAbiItem({ abi: factoryAbi, name: "ConfidentialERC7540Created" }) as AbiEvent;

/**
 * L0 — Portfolio. Iterates every vault the factory has deployed and renders one card per
 * vault where the connected user has any non-zero handle (shares, pending, or claimable).
 */
export default function PortfolioPage() {
  const router = useRouter();
  const { address, isConnected, status } = useAccount();
  const publicClient = usePublicClient();

  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") return;
    if (!isConnected) router.replace("/landing");
  }, [isConnected, status, router]);

  const { data: vaults } = useQuery<FactoryVault[]>({
    queryKey: ["portfolio-factory-vaults", FACTORY_ADDRESS, publicClient?.chain?.id, address],
    enabled: !!publicClient && !!address,
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
          name?: string;
          symbol?: string;
        };
        if (!args.vault || !args.asset) continue;
        byAddress.set(args.vault, {
          address: args.vault,
          asset: args.asset,
          name: args.name ?? "Confidential Vault",
          symbol: args.symbol ?? "cvTOKEN",
        });
      }
      return Array.from(byAddress.values());
    },
  });

  return (
    <Shell>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "800 34px/40px var(--ct-font-display)",
              color: "var(--ct-fg-1)",
              letterSpacing: "-0.9px",
            }}
          >
            My Portfolio
          </div>
          <div style={{ font: "400 15px/22px var(--ct-font-body)", color: "var(--ct-fg-4)", marginTop: 8 }}>
            Your vault positions — invisible to any external observer.
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 12px",
            borderRadius: 9999,
            background: "var(--ct-brand-tint-12)",
            border: "1px solid var(--ct-brand-border)",
            font: "600 12px/16px var(--ct-font-ui)",
            color: "var(--ct-brand)",
            flexShrink: 0,
          }}
        >
          <MI name="lock" size={13} color="var(--ct-brand)" /> Encrypted · Visible only to you
        </div>
      </div>

      <PortfolioBody vaults={vaults ?? []} user={address} />
    </Shell>
  );
}

function PortfolioBody({ vaults, user }: { vaults: FactoryVault[]; user: Address | undefined }) {
  // Map keyed by lowercased vault address; each PositionCard pushes its live snapshot up.
  const [snapshots, setSnapshots] = useState<Map<string, PositionSnapshot>>(() => new Map());

  // Clear when the discovered vault set or the account changes so stale entries don't linger.
  useEffect(() => {
    setSnapshots(new Map());
  }, [vaults, user]);

  const register = useCallback((vaultAddress: Address, snap: PositionSnapshot | null) => {
    const key = vaultAddress.toLowerCase();
    setSnapshots((prev) => {
      const next = new Map(prev);
      if (snap === null) next.delete(key);
      else next.set(key, snap);
      return next;
    });
  }, []);

  const activeSnapshots = useMemo(() => {
    const out: PositionSnapshot[] = [];
    for (const v of vaults) {
      const snap = snapshots.get(v.address.toLowerCase());
      if (!snap) continue;
      if (hasAnyNonZero(snap)) out.push(snap);
    }
    return out;
  }, [vaults, snapshots]);

  const sharesOnly = activeSnapshots.filter((s) => s.shares && s.shares !== ZERO_HANDLE);
  const pendingCount = activeSnapshots.reduce(
    (acc, s) =>
      acc +
      (s.pendingDeposit && s.pendingDeposit !== ZERO_HANDLE ? 1 : 0) +
      (s.pendingRedeem && s.pendingRedeem !== ZERO_HANDLE ? 1 : 0) +
      (s.claimableDeposit && s.claimableDeposit !== ZERO_HANDLE ? 1 : 0) +
      (s.claimableRedeem && s.claimableRedeem !== ZERO_HANDLE ? 1 : 0),
    0,
  );
  const singleSharesSnap = sharesOnly.length === 1 ? sharesOnly[0] : null;

  return (
    <>
      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <MetricTile label="Shares" me>
          {singleSharesSnap ? (
            <DecryptedAmount
              handle={singleSharesSnap.shares}
              decimals={6}
              suffix={singleSharesSnap.vault.symbol}
            />
          ) : sharesOnly.length > 1 ? (
            <span
              title="Multiple positions, open a vault to decrypt"
              style={{ color: "var(--ct-fg-4)", cursor: "help" }}
            >
              —
            </span>
          ) : (
            <span style={{ color: "var(--ct-fg-4)" }}>0</span>
          )}
        </MetricTile>
        <MetricTile label="Active positions" publicTag sub="Count is always visible">
          {activeSnapshots.length}
        </MetricTile>
        <MetricTile
          label="Pending requests"
          accent
          sub={pendingCount > 0 ? "Action required" : "No pending activity"}
        >
          {pendingCount}
        </MetricTile>
      </div>

      {/* Positions list header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div style={{ font: "700 14px/20px var(--ct-font-display)", color: "var(--ct-fg-2)" }}>Positions</div>
        <Link
          href="/discover"
          style={{
            color: "var(--ct-fg-5)",
            font: "500 12px/16px var(--ct-font-ui)",
            display: "inline-flex",
            gap: 5,
            alignItems: "center",
            textDecoration: "none",
          }}
        >
          <MI name="explore" size={13} />
          Discover more vaults
        </Link>
      </div>

      {/* One PositionCard per vault — cards self-hide if all handles are zero */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {vaults.map((v) => (
          <PositionCard key={v.address} vault={v} user={user} register={register} />
        ))}
      </div>

      {activeSnapshots.length === 0 ? (
        <div
          style={{
            marginTop: 24,
            padding: "24px",
            borderRadius: 16,
            background: "rgba(255,255,255,0.015)",
            border: "1px dashed rgba(255,255,255,0.10)",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "radial-gradient(circle at 30% 30%, var(--ct-brand-tint-18), rgba(116,142,255,0.04))",
              border: "1px solid var(--ct-brand-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MI name="inbox" size={22} color="var(--ct-brand)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: "800 16px/22px var(--ct-font-display)", color: "var(--ct-fg-1)" }}>
              No shares yet
            </div>
            <div style={{ font: "400 13px/18px var(--ct-font-body)", color: "var(--ct-fg-4)", marginTop: 4 }}>
              Make your first deposit to receive encrypted shares.
            </div>
          </div>
          <Link href="/discover" style={{ textDecoration: "none" }}>
            <PrimaryButton icon="arrow_forward">Deposit</PrimaryButton>
          </Link>
        </div>
      ) : null}
    </>
  );
}

function hasAnyNonZero(s: PositionSnapshot): boolean {
  const vals = [s.shares, s.pendingDeposit, s.claimableDeposit, s.pendingRedeem, s.claimableRedeem];
  return vals.some((v) => !!v && v !== ZERO_HANDLE);
}

function PositionCard({
  vault,
  user,
  register,
}: {
  vault: FactoryVault;
  user: Address | undefined;
  register: (vaultAddress: Address, snap: PositionSnapshot | null) => void;
}) {
  const { data: vaultName } = useReadContract({
    address: vault.address,
    abi: vaultAbi,
    functionName: "name",
  });
  const { data: vaultSymbol } = useReadContract({
    address: vault.address,
    abi: vaultAbi,
    functionName: "symbol",
  });

  // `refetchOnMount: "always"` because wagmi cache would otherwise serve pre-claim ZERO_HANDLE.
  const sharedQueryOpts = { enabled: !!user, refetchOnMount: "always" as const, staleTime: 0 };

  const { data: shares } = useReadContract({
    address: vault.address,
    abi: vaultAbi,
    functionName: "confidentialBalanceOf",
    args: user ? [user] : undefined,
    query: sharedQueryOpts,
  });
  const { data: pendingDeposit } = useReadContract({
    address: vault.address,
    abi: vaultAbi,
    functionName: "pendingDepositRequest",
    args: user ? [user] : undefined,
    query: sharedQueryOpts,
  });
  const { data: claimableDeposit } = useReadContract({
    address: vault.address,
    abi: vaultAbi,
    functionName: "claimableDepositRequest",
    args: user ? [user] : undefined,
    query: sharedQueryOpts,
  });
  const { data: pendingRedeem } = useReadContract({
    address: vault.address,
    abi: vaultAbi,
    functionName: "pendingRedeemRequest",
    args: user ? [user] : undefined,
    query: sharedQueryOpts,
  });
  const { data: claimableRedeem } = useReadContract({
    address: vault.address,
    abi: vaultAbi,
    functionName: "claimableRedeemRequest",
    args: user ? [user] : undefined,
    query: sharedQueryOpts,
  });

  const name = (vaultName as string | undefined) ?? vault.name;
  const symbol = (vaultSymbol as string | undefined) ?? vault.symbol;

  useEffect(() => {
    const snap: PositionSnapshot = {
      vault: { ...vault, name, symbol },
      shares: shares as `0x${string}` | undefined,
      pendingDeposit: pendingDeposit as `0x${string}` | undefined,
      claimableDeposit: claimableDeposit as `0x${string}` | undefined,
      pendingRedeem: pendingRedeem as `0x${string}` | undefined,
      claimableRedeem: claimableRedeem as `0x${string}` | undefined,
    };
    register(vault.address, snap);
    return () => register(vault.address, null);
  }, [
    vault,
    name,
    symbol,
    shares,
    pendingDeposit,
    claimableDeposit,
    pendingRedeem,
    claimableRedeem,
    register,
  ]);

  const hasPendingDeposit = pendingDeposit && pendingDeposit !== ZERO_HANDLE;
  const hasClaimableDeposit = claimableDeposit && claimableDeposit !== ZERO_HANDLE;
  const hasPendingRedeem = pendingRedeem && pendingRedeem !== ZERO_HANDLE;
  const hasClaimableRedeem = claimableRedeem && claimableRedeem !== ZERO_HANDLE;
  const hasShares = shares && shares !== ZERO_HANDLE;

  if (!hasShares && !hasPendingDeposit && !hasClaimableDeposit && !hasPendingRedeem && !hasClaimableRedeem) {
    return null;
  }

  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 16,
        background: "var(--ct-surface-1)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: "linear-gradient(135deg, var(--ct-brand-tint-18), rgba(116,142,255,0.04))",
            border: "1px solid var(--ct-brand-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ct-brand)",
            font: "800 15px/1 var(--ct-font-display)",
            flexShrink: 0,
          }}
        >
          {symbol.slice(0, 3)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                font: "800 17px/22px var(--ct-font-display)",
                color: "var(--ct-fg-1)",
                letterSpacing: "-0.3px",
              }}
            >
              {name}
            </span>
            <span style={{ font: "700 15px/22px var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>·</span>
            <span
              style={{
                font: "800 15px/22px var(--ct-font-ui)",
                color: "var(--ct-brand)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {symbol}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Badge tone="success" icon="fiber_manual_record">
              Active
            </Badge>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Link href={`/vault/${vault.address}`} style={{ textDecoration: "none" }}>
            <button
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: 10,
                background: "rgba(116,142,255,0.10)",
                border: "1px solid var(--ct-brand-border)",
                color: "var(--ct-brand)",
                font: "700 13px/18px var(--ct-font-display)",
                display: "inline-flex",
                gap: 6,
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              View position <MI name="arrow_forward" size={13} />
            </button>
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0,
          borderRadius: 12,
          overflow: "hidden",
          background: "rgba(0,0,0,0.20)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {[
          {
            label: "Shares",
            content: (
              <DecryptedAmount handle={shares as `0x${string}` | undefined} decimals={6} suffix={symbol} />
            ),
            encrypted: true,
          },
          {
            label: "Pending deposit",
            content: hasPendingDeposit ? (
              <DecryptedAmount handle={pendingDeposit as `0x${string}` | undefined} decimals={6} suffix="cUSDC" />
            ) : (
              <span style={{ color: "var(--ct-fg-5)" }}>—</span>
            ),
            encrypted: true,
          },
          {
            label: "Claimable",
            content: hasClaimableDeposit || hasClaimableRedeem ? (
              <Badge tone="success" icon="check_circle">
                Ready
              </Badge>
            ) : (
              <span style={{ color: "var(--ct-fg-5)" }}>—</span>
            ),
            encrypted: false,
          },
        ].map((m, i) => (
          <div
            key={m.label}
            style={{
              padding: "14px 18px",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                font: "700 10px/14px var(--ct-font-ui)",
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "var(--ct-fg-5)",
              }}
            >
              <span>{m.label}</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  color: m.encrypted ? "var(--ct-brand)" : "var(--ct-fg-6)",
                  letterSpacing: "0.6px",
                }}
              >
                <MI
                  name={m.encrypted ? "lock" : "public"}
                  size={10}
                  color={m.encrypted ? "var(--ct-brand)" : "var(--ct-fg-6)"}
                />
                {m.encrypted ? "Encrypted" : "Public"}
              </span>
            </div>
            <div
              style={{
                marginTop: 8,
                font: "700 18px/24px var(--ct-font-ui)",
                color: "var(--ct-fg-1)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {(hasClaimableDeposit || hasClaimableRedeem || hasPendingRedeem) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.25)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 9999,
              background: "var(--ct-warn)",
            }}
          />
          <span style={{ font: "600 12px/17px var(--ct-font-body)", color: "#FCD34D" }}>
            {hasClaimableDeposit && "Deposit ready to claim · "}
            {hasClaimableRedeem && "Redeem ready to claim · "}
            {hasPendingRedeem && "Redeem awaiting approval"}
          </span>
          <span style={{ flex: 1 }} />
          <Link
            href={
              hasClaimableDeposit
                ? `/vault/${vault.address}/deposit`
                : hasClaimableRedeem
                  ? `/vault/${vault.address}/redeem`
                  : `/vault/${vault.address}`
            }
            style={{
              color: "#FCD34D",
              font: "700 12px/17px var(--ct-font-display)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              display: "inline-flex",
              gap: 4,
              alignItems: "center",
            }}
          >
            View status <MI name="arrow_forward" size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
