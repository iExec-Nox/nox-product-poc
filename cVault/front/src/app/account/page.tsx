"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "viem";
import { formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";

import { Shell } from "@/components/Shell";
import { Card, MI, PrimaryButton, StepList, WarnNote } from "@/components/ui";
import { DecryptedAmount } from "@/components/DecryptedAmount";
import { useStepRunner } from "@/lib/useStepRunner";
import { bumpFees } from "@/lib/bumpFees";

import { SUPPORTED_TOKENS, type SupportedToken } from "@/config/contracts";
import { cusdcAbi } from "@/abi/cusdc";
import { erc20Abi } from "@/abi/erc20";

/**
 * Account page — Hyperliquid-style separation of wrapping and depositing. Users keep their
 * confidential token balance here; vault deposits only draw from that balance. Wrapping and
 * depositing happen in independent transactions (and usually at different times), so an external
 * observer can't link a specific underlying → confidential wrap to a specific vault deposit.
 *
 * Supports every entry in `SUPPORTED_TOKENS` (cUSDC, cRLC, …). The user picks the token via a
 * segmented control at the top; the two balance tiles and the wrap form all reflect the active
 * token. Wrap runs the same 2-step flow (approve on the underlying, then wrap on the cToken) but
 * with per-token decimals and addresses.
 */
export default function AccountPage() {
  const router = useRouter();
  const { address, isConnected, status } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const runner = useStepRunner();

  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") return;
    if (!isConnected) router.replace("/landing");
  }, [isConnected, status, router]);

  const [activeId, setActiveId] = useState<SupportedToken["id"]>(SUPPORTED_TOKENS[0].id);
  const token = useMemo(
    () => SUPPORTED_TOKENS.find((t) => t.id === activeId) ?? SUPPORTED_TOKENS[0],
    [activeId],
  );

  const [amount, setAmount] = useState("1");

  // For cUSDC we resolve the underlying via `cUSDC.underlying()` at runtime (legacy behavior).
  // For cRLC (and any future entry with a non-zero registry underlying) we trust the registry.
  const needsUnderlyingLookup =
    token.underlying === "0x0000000000000000000000000000000000000000";
  const { data: resolvedUnderlying } = useReadContract({
    address: token.confidential,
    abi: cusdcAbi,
    functionName: "underlying",
    query: { enabled: needsUnderlyingLookup },
  });
  const underlyingAddress: Address | undefined = needsUnderlyingLookup
    ? (resolvedUnderlying as Address | undefined)
    : token.underlying;

  const { data: underlyingBalance, refetch: refetchUnderlying } = useReadContract({
    address: underlyingAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!underlyingAddress },
  });
  const { data: confidentialHandle, refetch: refetchConfidential } = useReadContract({
    address: token.confidential,
    abi: cusdcAbi,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Reset the step runner and amount input when the user switches tokens — otherwise the
  // previous run's step list lingers under a newly-selected token's wrap card.
  useEffect(() => {
    runner.reset();
    setAmount("1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  let amountWei = 0n;
  try {
    if (amount) amountWei = parseUnits(amount, token.decimals);
  } catch {
    amountWei = 0n;
  }
  const insufficient =
    typeof underlyingBalance === "bigint" && amountWei > (underlyingBalance as bigint);
  const canWrap =
    !!walletClient &&
    !!publicClient &&
    !!address &&
    !!underlyingAddress &&
    amountWei > 0n &&
    !insufficient &&
    !runner.running;

  async function wrap() {
    if (!walletClient || !publicClient || !address || !underlyingAddress) return;
    const OWNER = address;
    const UNDERLYING = underlyingAddress;
    const CONFIDENTIAL = token.confidential;
    const amt = amountWei;
    await runner.runAll([
      {
        label: `Approve ${token.underlyingSymbol} for ${token.confidentialSymbol} wrapper`,
        run: async () => {
          const fees = await bumpFees(publicClient);
          const tx = await walletClient.writeContract({
            address: UNDERLYING,
            abi: erc20Abi,
            functionName: "approve",
            args: [CONFIDENTIAL, amt],
            ...fees,
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
      {
        label: `Wrap ${token.underlyingSymbol} into ${token.confidentialSymbol}`,
        run: async () => {
          const fees = await bumpFees(publicClient);
          const tx = await walletClient.writeContract({
            address: CONFIDENTIAL,
            abi: cusdcAbi,
            functionName: "wrap",
            args: [OWNER, amt],
            ...fees,
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
    ]);
    refetchUnderlying();
    refetchConfidential();
  }

  return (
    <Shell>
      <div
        style={{
          font: "800 34px/40px var(--ct-font-display)",
          color: "var(--ct-fg-1)",
          letterSpacing: "-0.9px",
        }}
      >
        Account
      </div>
      <div
        style={{
          font: "400 15px/22px var(--ct-font-body)",
          color: "var(--ct-fg-4)",
          marginTop: 8,
          marginBottom: 20,
        }}
      >
        Wrap any supported asset into its confidential counterpart. Your cToken balance is
        encrypted and feeds every vault deposit, so wrapping and depositing can&apos;t be linked
        from the outside.
      </div>

      {/* Token selector (segmented control) */}
      <div
        style={{
          display: "inline-flex",
          padding: 4,
          marginBottom: 20,
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          gap: 2,
        }}
      >
        {SUPPORTED_TOKENS.map((t) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              disabled={runner.running}
              style={{
                height: 36,
                padding: "0 18px",
                borderRadius: 9,
                border: 0,
                cursor: runner.running ? "not-allowed" : "pointer",
                background: active ? t.accent : "transparent",
                color: active ? "#0a0a0e" : "var(--ct-fg-3)",
                font: "800 12px/16px var(--ct-font-display)",
                letterSpacing: "0.4px",
                textTransform: "uppercase",
                transition: "background 120ms ease, color 120ms ease",
              }}
            >
              {t.confidentialSymbol}
            </button>
          );
        })}
      </div>

      {/* Balances */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <BalanceTile
          label={`${token.underlyingSymbol} (public)`}
          amount={
            typeof underlyingBalance === "bigint"
              ? Number(formatUnits(underlyingBalance as bigint, token.decimals)).toLocaleString(
                  "en-US",
                  { maximumFractionDigits: 4 },
                )
              : "—"
          }
          suffix={token.underlyingSymbol}
          icon="paid"
        />
        <BalanceTile
          label={`${token.confidentialSymbol} (encrypted)`}
          encrypted
          accent={token.accent}
          custom={
            <DecryptedAmount
              handle={confidentialHandle as `0x${string}` | undefined}
              decimals={token.decimals}
              suffix={token.confidentialSymbol}
            />
          }
          suffix=""
          icon="lock"
        />
      </div>

      {/* Wrap form */}
      <Card
        title={`Wrap ${token.underlyingSymbol} → ${token.confidentialSymbol}`}
        subtitle={`1 ${token.underlyingSymbol} = 1 ${token.confidentialSymbol} · No fees.`}
      >
        <div
          style={{
            padding: 18,
            borderRadius: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            disabled={runner.running}
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: 0,
              outline: 0,
              color: "#fff",
              font: "700 28px/34px var(--ct-font-display)",
              letterSpacing: "-0.3px",
              fontVariantNumeric: "tabular-nums",
            }}
          />
          <span style={{ font: "700 16px/22px var(--ct-font-display)", color: "var(--ct-fg-4)" }}>
            {token.underlyingSymbol}
          </span>
          <button
            onClick={() => {
              if (typeof underlyingBalance === "bigint")
                setAmount(formatUnits(underlyingBalance as bigint, token.decimals));
            }}
            disabled={runner.running}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 8,
              background: "var(--ct-brand-tint-18)",
              border: "1px solid var(--ct-brand-border)",
              color: "var(--ct-brand)",
              font: "700 12px/18px var(--ct-font-display)",
              cursor: runner.running ? "not-allowed" : "pointer",
            }}
          >
            Max
          </button>
        </div>

        {insufficient && (
          <div style={{ marginTop: 14 }}>
            <WarnNote icon="warning_amber">
              Not enough {token.underlyingSymbol}. You have{" "}
              {typeof underlyingBalance === "bigint"
                ? formatUnits(underlyingBalance as bigint, token.decimals)
                : "—"}{" "}
              {token.underlyingSymbol}.
            </WarnNote>
          </div>
        )}

        <PrimaryButton
          icon="swap_horiz"
          onClick={wrap}
          disabled={!canWrap}
          loading={runner.running}
          style={{ width: "100%", marginTop: 16, height: 52 }}
        >
          {runner.running
            ? "Wrapping…"
            : runner.done
              ? "Wrapped"
              : `Wrap ${token.underlyingSymbol}`}
        </PrimaryButton>

        {runner.steps.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <StepList steps={runner.steps} />
          </div>
        )}
      </Card>
    </Shell>
  );
}

function BalanceTile({
  label,
  amount,
  suffix,
  icon,
  encrypted,
  accent,
  custom,
}: {
  label: string;
  amount?: string;
  suffix: string;
  icon: string;
  encrypted?: boolean;
  accent?: string;
  custom?: React.ReactNode;
}) {
  const borderColor = encrypted
    ? accent ?? "var(--ct-brand-border)"
    : "rgba(255,255,255,0.08)";
  return (
    <div
      style={{
        padding: 22,
        borderRadius: 18,
        background: "var(--ct-surface-1)",
        border: `1px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <MI
          name={icon}
          size={16}
          color={encrypted ? accent ?? "var(--ct-brand)" : "var(--ct-fg-4)"}
        />
        <div
          style={{
            font: "800 10px/14px var(--ct-font-ui)",
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--ct-fg-5)",
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          font: "800 28px/34px var(--ct-font-display)",
          color: "var(--ct-fg-1)",
          letterSpacing: "-0.4px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {custom ?? (
          <>
            {amount} {suffix && <span style={{ color: "var(--ct-fg-5)", fontWeight: 700 }}>{suffix}</span>}
          </>
        )}
      </div>
    </div>
  );
}
