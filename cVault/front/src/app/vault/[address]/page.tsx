"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";

import { Shell } from "@/components/Shell";
import { Badge, MI, PrimaryButton, SecondaryButton } from "@/components/ui";
import { MetricTile, VaultHero } from "@/components/lp";
import { DecryptedAmount } from "@/components/DecryptedAmount";
import {
  FinalizeDepositModal,
  FinalizeRedeemModal,
  RequestDepositModal,
  RequestRedeemModal,
} from "@/components/RequestModals";
import { useDecryptedHandle } from "@/hooks/useDecryptedHandle";

import { ZERO_HANDLE } from "@/config/contracts";
import { vaultAbi } from "@/abi/vault";

/**
 * L5 — My position in a specific vault.
 */
export default function VaultPositionPage({ params }: { params: Promise<{ address: string }> }) {
  const router = useRouter();
  const { address: vaultAddrParam } = use(params);
  const vaultAddress = vaultAddrParam as Address;

  const { address } = useAccount();
  const [depositOpen, setDepositOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [finalizeDepositOpen, setFinalizeDepositOpen] = useState(false);
  const [finalizeRedeemOpen, setFinalizeRedeemOpen] = useState(false);

  const { data: vaultName } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "name",
  });
  const { data: vaultSymbol } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "symbol",
  });

  // `refetchOnMount: "always"` forces a fresh read every time the user navigates back to the
  // vault page — otherwise wagmi/react-query happily reuses a pre-claim ZERO_HANDLE and the
  // `DecryptedAmount` shows "0" via its empty-state shortcut instead of the freshly-minted
  // share balance.
  const sharedQueryOpts = { enabled: !!address, refetchOnMount: "always" as const, staleTime: 0 };

  const { data: shares, refetch: refetchShares } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: sharedQueryOpts,
  });
  const { data: pendingDeposit, refetch: refetchPendingDeposit } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "pendingDepositRequest",
    args: address ? [address] : undefined,
    query: sharedQueryOpts,
  });
  const { data: claimableDeposit } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "claimableDepositRequest",
    args: address ? [address] : undefined,
    query: sharedQueryOpts,
  });
  const { data: pendingRedeem, refetch: refetchPendingRedeem } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "pendingRedeemRequest",
    args: address ? [address] : undefined,
    query: sharedQueryOpts,
  });
  const { data: claimableRedeem } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "claimableRedeemRequest",
    args: address ? [address] : undefined,
    query: sharedQueryOpts,
  });

  // Debug: surface the raw handle returned by `confidentialBalanceOf(user)` so we can confirm
  // the front reads exactly what on-chain `cast call` returns. Logs every time the handle or
  // the connected account changes.
  useEffect(() => {
    console.log("[vault:shares]", {
      vault: vaultAddress,
      user: address,
      sharesHandle: shares,
      isZero: !shares || shares === ZERO_HANDLE,
    });
  }, [shares, address, vaultAddress]);

  const hasPendingDeposit = pendingDeposit && pendingDeposit !== ZERO_HANDLE;
  const hasClaimableDeposit = claimableDeposit && claimableDeposit !== ZERO_HANDLE;
  const hasPendingRedeem = pendingRedeem && pendingRedeem !== ZERO_HANDLE;
  const hasClaimableRedeem = claimableRedeem && claimableRedeem !== ZERO_HANDLE;

  const name = (vaultName as string | undefined) ?? "Confidential Vault";
  const symbol = (vaultSymbol as string | undefined) ?? "cvUSDC";

  return (
    <Shell>
      <VaultHero
        back={{ label: "Back to portfolio", onClick: () => router.push("/portfolio") }}
        title={`My position — ${name} (${symbol})`}
        badges={
          <>
            <Badge tone="brand" icon="lock">
              Confidential
            </Badge>
            <Badge tone="success" icon="fiber_manual_record">
              Live
            </Badge>
          </>
        }
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SecondaryButton icon="south_west" onClick={() => setRedeemOpen(true)}>
              Request redeem
            </SecondaryButton>
            <PrimaryButton icon="arrow_forward" onClick={() => setDepositOpen(true)}>
              Request deposit
            </PrimaryButton>
          </div>
        }
      />

      {/* Shares metric (full width) */}
      <div style={{ marginBottom: 24 }}>
        <MetricTile label="My shares" me sub="On-chain balance">
          <DecryptedAmount handle={shares as `0x${string}` | undefined} decimals={6} suffix={symbol} />
        </MetricTile>
      </div>

      {/* Requests — split into Pending + Ready to finalize sub-sections */}
      {(hasPendingDeposit || hasPendingRedeem || hasClaimableDeposit || hasClaimableRedeem) && (
        <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          {(hasPendingDeposit || hasPendingRedeem) && (
            <RequestSection
              icon="schedule"
              iconColor="var(--ct-fg-4)"
              title="Pending"
              description="Awaiting vault operator settlement."
            >
              {hasPendingDeposit && (
                <RequestCard status="pending" kind="deposit" handle={pendingDeposit as `0x${string}`} suffix="cUSDC" />
              )}
              {hasPendingRedeem && (
                <RequestCard status="pending" kind="redeem" handle={pendingRedeem as `0x${string}`} suffix={symbol} />
              )}
            </RequestSection>
          )}
          {(hasClaimableDeposit || hasClaimableRedeem) && (
            <RequestSection
              icon="check_circle"
              iconColor="var(--ct-success-light, #34d399)"
              title="Ready to finalize"
              description="Settlement complete — finalize to update your balance."
            >
              {hasClaimableDeposit && (
                <RequestCard
                  status="ready"
                  kind="deposit"
                  handle={claimableDeposit as `0x${string}`}
                  suffix="shares"
                  onFinalize={() => setFinalizeDepositOpen(true)}
                />
              )}
              {hasClaimableRedeem && (
                <RequestCard
                  status="ready"
                  kind="redeem"
                  handle={claimableRedeem as `0x${string}`}
                  suffix="cUSDC"
                  onFinalize={() => setFinalizeRedeemOpen(true)}
                />
              )}
            </RequestSection>
          )}
        </div>
      )}

      {depositOpen && (
        <RequestDepositModal
          vaultAddress={vaultAddress}
          onClose={() => setDepositOpen(false)}
          onSuccess={() => {
            refetchPendingDeposit();
          }}
        />
      )}
      {redeemOpen && (
        <RequestRedeemModal
          vaultAddress={vaultAddress}
          symbol={symbol}
          onClose={() => setRedeemOpen(false)}
          onSuccess={() => {
            refetchPendingRedeem();
            refetchShares();
          }}
        />
      )}
      {finalizeDepositOpen && (
        <FinalizeDepositModal
          vaultAddress={vaultAddress}
          onClose={() => setFinalizeDepositOpen(false)}
          onSuccess={() => {
            refetchShares();
          }}
        />
      )}
      {finalizeRedeemOpen && (
        <FinalizeRedeemModal
          vaultAddress={vaultAddress}
          onClose={() => setFinalizeRedeemOpen(false)}
          onSuccess={() => {
            refetchShares();
          }}
        />
      )}
    </Shell>
  );
}

function RequestSection({
  icon,
  iconColor,
  title,
  description,
  children,
}: {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <MI name={icon} size={18} color={iconColor} />
        <div style={{ font: "700 15px/20px var(--ct-font-display)", color: "var(--ct-fg-1)" }}>{title}</div>
        <div style={{ font: "400 13px/18px var(--ct-font-body)", color: "var(--ct-fg-5)" }}>· {description}</div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Self-contained card for one confidential request (pending or ready-to-finalize). When ready,
 * the Finalize button stays disabled until the user reveals the handle and the decrypted value
 * is strictly positive — avoids a no-op claim tx on a slot that was already finalized.
 */
function RequestCard({
  status,
  kind,
  handle,
  suffix,
  onFinalize,
}: {
  status: "pending" | "ready";
  kind: "deposit" | "redeem";
  handle: `0x${string}`;
  suffix: string;
  onFinalize?: () => void;
}) {
  const { state } = useDecryptedHandle(status === "ready" ? handle : undefined);
  const revealed = state.status === "ok";
  const canFinalize = status === "ready" && revealed && state.value > 0n;

  const kindLabel = kind === "deposit" ? "Deposit" : "Redeem";
  // Color/icon per kind — gives each card an instantly-recognizable identity.
  const kindColor = kind === "deposit" ? "var(--ct-brand)" : "#F59E0B"; // indigo vs amber
  const kindTint = kind === "deposit" ? "rgba(116,142,255,0.12)" : "rgba(245,158,11,0.12)";
  const kindBorder = kind === "deposit" ? "rgba(116,142,255,0.35)" : "rgba(245,158,11,0.35)";
  const kindIcon = kind === "deposit" ? "south_west" : "north_east";
  const kindSubtitle = kind === "deposit" ? "Money in · mints shares" : "Shares out · burns to assets";

  const statusColor = status === "pending" ? "var(--ct-fg-5)" : "var(--ct-success-light, #34d399)";
  const statusBg =
    status === "pending" ? "rgba(255,255,255,0.05)" : "rgba(16,185,129,0.12)";
  const statusBorder =
    status === "pending" ? "rgba(255,255,255,0.10)" : "rgba(16,185,129,0.35)";
  const statusIcon = status === "pending" ? "schedule" : "check_circle";
  const statusText = status === "pending" ? "Pending" : "Ready";
  const footerHint =
    status === "pending"
      ? "Waiting for vault operator to settle."
      : !revealed
        ? "Reveal the amount to enable finalization."
        : state.value === 0n
          ? "Already finalized — nothing left to claim."
          : "Confirmed — ready to finalize on-chain.";

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        background: "var(--ct-surface-1)",
        border: `1px solid ${kindBorder}`,
        borderLeft: `4px solid ${kindColor}`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Header: kind (prominent, colored) on left, status chip on right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: kindTint,
              border: `1px solid ${kindBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <MI name={kindIcon} size={16} color={kindColor} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "800 15px/20px var(--ct-font-display)", color: kindColor, letterSpacing: "-0.2px" }}>
              {kindLabel}
            </div>
            <div
              style={{
                font: "500 11px/14px var(--ct-font-body)",
                color: "var(--ct-fg-5)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {kindSubtitle}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 22,
            padding: "0 8px",
            borderRadius: 6,
            background: statusBg,
            border: `1px solid ${statusBorder}`,
            font: "800 10px/14px var(--ct-font-ui)",
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: statusColor,
            flexShrink: 0,
          }}
        >
          <MI name={statusIcon} size={11} color={statusColor} />
          {statusText}
        </div>
      </div>

      {/* Amount */}
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          font: "700 22px/28px var(--ct-font-display)",
          color: "var(--ct-fg-1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <DecryptedAmount handle={handle} decimals={6} suffix={suffix} />
      </div>

      {/* Footer: action (if ready + >0) or hint */}
      {status === "ready" && canFinalize && onFinalize ? (
        <PrimaryButton icon="check" onClick={onFinalize} style={{ width: "100%" }}>
          {kind === "deposit" ? "Finalize deposit" : "Finalize redeem"}
        </PrimaryButton>
      ) : status === "ready" ? (
        <PrimaryButton icon="check" disabled style={{ width: "100%" }}>
          {kind === "deposit" ? "Finalize deposit" : "Finalize redeem"}
        </PrimaryButton>
      ) : null}

      <div
        style={{
          font: "500 12px/17px var(--ct-font-body)",
          color: "var(--ct-fg-5)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <MI name={status === "pending" ? "hourglass_empty" : "info"} size={13} color="var(--ct-fg-5)" />
        {footerHint}
      </div>
    </div>
  );
}
