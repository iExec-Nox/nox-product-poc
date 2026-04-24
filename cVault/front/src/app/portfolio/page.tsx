"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";

import { Shell } from "@/components/Shell";
import { Badge, MI, PrimaryButton } from "@/components/ui";
import { MetricTile } from "@/components/lp";
import { DecryptedAmount } from "@/components/DecryptedAmount";

import { VAULT_ADDRESS, ZERO_HANDLE } from "@/config/contracts";
import { vaultAbi } from "@/abi/vault";

/**
 * L0 — Portfolio. For this PoC only one vault is deployed, so we show a single position card
 * (backed by the actual on-chain vault) instead of the mocked multi-vault list. A "Discover
 * more vaults" link points to /discover (L1).
 */
export default function PortfolioPage() {
  const router = useRouter();
  const { address, isConnected, status } = useAccount();

  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") return;
    if (!isConnected) router.replace("/landing");
  }, [isConnected, status, router]);

  const { data: vaultName } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "name",
    query: { enabled: !!VAULT_ADDRESS },
  });
  const { data: vaultSymbol } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "symbol",
    query: { enabled: !!VAULT_ADDRESS },
  });
  const { data: shares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: pendingDeposit } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "pendingDepositRequest",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: claimableDeposit } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "claimableDepositRequest",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: pendingRedeem } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "pendingRedeemRequest",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: claimableRedeem } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "claimableRedeemRequest",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const hasPendingDeposit = pendingDeposit && pendingDeposit !== ZERO_HANDLE;
  const hasClaimableDeposit = claimableDeposit && claimableDeposit !== ZERO_HANDLE;
  const hasPendingRedeem = pendingRedeem && pendingRedeem !== ZERO_HANDLE;
  const hasClaimableRedeem = claimableRedeem && claimableRedeem !== ZERO_HANDLE;

  const pendingCount =
    (hasPendingDeposit ? 1 : 0) +
    (hasPendingRedeem ? 1 : 0) +
    (hasClaimableDeposit ? 1 : 0) +
    (hasClaimableRedeem ? 1 : 0);

  const name = (vaultName as string | undefined) ?? "Confidential Vault";
  const symbol = (vaultSymbol as string | undefined) ?? "cvUSDC";

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

      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <MetricTile label="Shares" me>
          <DecryptedAmount handle={shares as `0x${string}` | undefined} decimals={6} suffix={symbol} />
        </MetricTile>
        <MetricTile label="Active positions" publicTag sub="Count is always visible">
          1
        </MetricTile>
        <MetricTile
          label="Pending requests"
          accent
          sub={pendingCount > 0 ? "Action required" : "No pending activity"}
        >
          {pendingCount}
        </MetricTile>
      </div>

      {/* Positions list */}
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

      {/* Single vault position card */}
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
        {/* Row 1 — vault identity + actions */}
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
            <Link href={`/vault/${VAULT_ADDRESS}`} style={{ textDecoration: "none" }}>
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

        {/* Row 2 — metrics */}
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
              content: <DecryptedAmount handle={shares as `0x${string}` | undefined} decimals={6} suffix={symbol} />,
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
              content: hasClaimableDeposit ? (
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

        {/* Row 3 — pending banner */}
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
                  ? `/vault/${VAULT_ADDRESS}/deposit`
                  : hasClaimableRedeem
                    ? `/vault/${VAULT_ADDRESS}/redeem`
                    : `/vault/${VAULT_ADDRESS}`
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

      {/* Empty state if no shares + nothing pending */}
      {!shares || shares === ZERO_HANDLE ? (
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
          <Link href={`/vault/${VAULT_ADDRESS}/deposit`} style={{ textDecoration: "none" }}>
            <PrimaryButton icon="arrow_forward">Deposit</PrimaryButton>
          </Link>
        </div>
      ) : null}
    </Shell>
  );
}
