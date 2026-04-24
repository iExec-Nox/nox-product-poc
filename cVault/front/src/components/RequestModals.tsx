"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import type { Address, Hex } from "viem";
import { parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";

import { MI, PrimaryButton, StepList, WarnNote } from "./ui";
import { DecryptedAmount } from "./DecryptedAmount";
import { useStepRunner } from "@/lib/useStepRunner";
import { useHandleClient } from "@/hooks/useHandleClient";
import { bumpFees } from "@/lib/bumpFees";

import {
  NOX_COMPUTE_ADDRESS,
  ZERO_HANDLE,
  getTokenByConfidential,
} from "@/config/contracts";
import { cusdcAbi } from "@/abi/cusdc";
import { noxComputeAbi } from "@/abi/nox";
import { vaultAbi } from "@/abi/vault";
import { requestDepositExternalAbi, requestRedeemExternalAbi } from "@/abi/vaultOverloads";

const SHARES_DECIMALS = 6;

// ---------- Shared modal shell ----------
function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(10,10,14,0.72)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--ct-surface-1)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 24,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--ct-brand-tint-12)",
          padding: 28,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 9999,
            border: 0,
            background: "rgba(255,255,255,0.05)",
            color: "var(--ct-fg-4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MI name="close" size={16} />
        </button>

        <div style={{ paddingRight: 40 }}>
          <div style={{ font: "800 22px/28px var(--ct-font-display)", color: "var(--ct-fg-1)", letterSpacing: "-0.5px" }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ font: "400 13px/18px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 4 }}>
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ marginTop: 22 }}>{children}</div>
      </div>
    </div>
  );
}

// ---------- Request Deposit modal ----------
/**
 * Partial-amount deposit: user enters the exact cUSDC amount, which is encrypted client-side via
 * the Nox handle SDK (`encryptInput`), then the resulting `externalEuint256 + inputProof` is
 * submitted to the vault's 4-arg `requestDeposit` overload. Wrapping lives on the /account page,
 * so wraps and deposits can't be trivially linked by an external observer.
 */
export function RequestDepositModal({
  vaultAddress,
  onClose,
  onSuccess,
}: {
  vaultAddress: Address;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { handleClient } = useHandleClient();
  const runner = useStepRunner();

  const [amount, setAmount] = useState("1");

  // Which cToken does this vault hold? Read `vault.asset()` once per vault, then look it up in
  // the registry to get decimals / symbols / the cToken address for operator + ACL + balance.
  const { data: assetAddress } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "asset",
  });
  const token = getTokenByConfidential(assetAddress as Address | undefined);

  const { data: confidentialHandle } = useReadContract({
    address: token?.confidential,
    abi: cusdcAbi,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!token },
  });
  const hasBalance = confidentialHandle && confidentialHandle !== ZERO_HANDLE;

  let amountWei = 0n;
  try {
    if (amount && token) amountWei = parseUnits(amount, token.decimals);
  } catch {
    amountWei = 0n;
  }

  const canSubmit =
    !!walletClient &&
    !!publicClient &&
    !!address &&
    !!token &&
    !!hasBalance &&
    !!handleClient &&
    amountWei > 0n &&
    !runner.running;

  async function submit() {
    if (!walletClient || !publicClient || !address || !handleClient || !token) return;
    const OWNER = address;
    const CTOKEN = token.confidential;
    await runner.runAll([
      {
        label: `Set vault as operator on ${token.confidentialSymbol} (24h)`,
        run: async () => {
          const until = Math.floor(Date.now() / 1000) + 24 * 3600;
          const fees = await bumpFees(publicClient);
          const tx = await walletClient.writeContract({
            address: CTOKEN,
            abi: cusdcAbi,
            functionName: "setOperator",
            args: [vaultAddress, until],
            ...fees,
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
      {
        label: `Grant NoxCompute ACL on ${token.confidentialSymbol} balance handle`,
        run: async () => {
          const handle = (await publicClient.readContract({
            address: CTOKEN,
            abi: cusdcAbi,
            functionName: "confidentialBalanceOf",
            args: [OWNER],
          })) as Hex;
          const fees = await bumpFees(publicClient);
          const tx = await walletClient.writeContract({
            address: NOX_COMPUTE_ADDRESS,
            abi: noxComputeAbi,
            functionName: "allow",
            args: [handle, vaultAddress],
            ...fees,
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
      {
        label: "Encrypt amount via Nox handle SDK",
        run: async () => {
          // Encrypts `amountWei` as euint256 bound to the vault. Does NOT emit a tx.
          const { handle, handleProof } = await handleClient.encryptInput(
            amountWei,
            "uint256",
            vaultAddress,
          );
          // Stash on window for the next step — avoids re-encrypting.
          (window as unknown as { __noxEnc?: { handle: Hex; proof: Hex } }).__noxEnc = {
            handle: handle as Hex,
            proof: handleProof as Hex,
          };
          return undefined;
        },
      },
      {
        label: `Submit requestDeposit (${amount} ${token.confidentialSymbol} → pending)`,
        run: async () => {
          const enc = (window as unknown as { __noxEnc?: { handle: Hex; proof: Hex } }).__noxEnc;
          if (!enc) throw new Error("Encrypted input missing — re-run the flow.");
          const fees = await bumpFees(publicClient);
          const tx = await walletClient.writeContract({
            address: vaultAddress,
            abi: requestDepositExternalAbi,
            functionName: "requestDeposit",
            args: [enc.handle, enc.proof, OWNER, OWNER],
            ...fees,
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          delete (window as unknown as { __noxEnc?: unknown }).__noxEnc;
          return tx;
        },
      },
    ]);
    if (runner.error === null) onSuccess?.();
  }

  // Unknown asset — the vault's `asset()` doesn't match any entry in `SUPPORTED_TOKENS`.
  // Render a friendly error instead of crashing.
  if (assetAddress && !token) {
    return (
      <ModalShell
        title="Request deposit"
        subtitle="This vault uses an unsupported asset."
        onClose={onClose}
      >
        <WarnNote icon="error_outline">
          Unknown vault asset <code style={{ opacity: 0.8 }}>{String(assetAddress)}</code>. This
          front-end doesn&apos;t know how to wrap or deposit that cToken yet.
        </WarnNote>
      </ModalShell>
    );
  }

  const confidentialSymbol = token?.confidentialSymbol ?? "cToken";
  const underlyingSymbol = token?.underlyingSymbol ?? "underlying";

  return (
    <ModalShell
      title="Request deposit"
      subtitle={`Enter the ${confidentialSymbol} amount to deposit — encrypted client-side, then sent to the vault.`}
      onClose={onClose}
    >
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <MI name="lock" size={14} color="var(--ct-brand)" />
        <span style={{ flex: 1, font: "600 13px/18px var(--ct-font-body)", color: "var(--ct-fg-3)" }}>
          {confidentialSymbol} balance
        </span>
        <span style={{ font: "800 16px/22px var(--ct-font-display)", color: "var(--ct-fg-1)" }}>
          <DecryptedAmount
            handle={confidentialHandle as `0x${string}` | undefined}
            decimals={token?.decimals ?? 6}
            suffix={confidentialSymbol}
          />
        </span>
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          gap: 10,
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
            font: "700 26px/32px var(--ct-font-display)",
            letterSpacing: "-0.3px",
            fontVariantNumeric: "tabular-nums",
          }}
        />
        <span style={{ font: "700 15px/20px var(--ct-font-display)", color: "var(--ct-fg-4)" }}>
          {confidentialSymbol}
        </span>
      </div>

      {token && !hasBalance && (
        <div style={{ marginTop: 12 }}>
          <WarnNote icon="info">
            No {confidentialSymbol} in your account.{" "}
            <Link href="/account" style={{ color: "var(--ct-brand)", textDecoration: "underline" }}>
              Wrap some {underlyingSymbol} first
            </Link>
            .
          </WarnNote>
        </div>
      )}

      <PrimaryButton
        icon="arrow_forward"
        onClick={submit}
        disabled={!canSubmit}
        loading={runner.running}
        style={{ width: "100%", marginTop: 16, height: 48 }}
      >
        {runner.running ? "Submitting…" : runner.done ? "Submitted" : "Request deposit"}
      </PrimaryButton>

      {runner.steps.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <StepList steps={runner.steps} />
        </div>
      )}
    </ModalShell>
  );
}

// ---------- Request Redeem modal ----------
/**
 * Partial-amount redeem: user enters the exact share amount, encrypted client-side via the Nox
 * handle SDK and submitted to the vault's 4-arg `requestRedeem` overload.
 */
export function RequestRedeemModal({
  vaultAddress,
  symbol,
  onClose,
  onSuccess,
}: {
  vaultAddress: Address;
  symbol: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { handleClient } = useHandleClient();
  const runner = useStepRunner();

  const [amount, setAmount] = useState("1");

  const { data: shares } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const hasShares = shares && shares !== ZERO_HANDLE;

  let amountWei = 0n;
  try {
    if (amount) amountWei = parseUnits(amount, SHARES_DECIMALS);
  } catch {
    amountWei = 0n;
  }

  const canSubmit =
    !!walletClient &&
    !!publicClient &&
    !!address &&
    !!hasShares &&
    !!handleClient &&
    amountWei > 0n &&
    !runner.running;

  async function submit() {
    if (!walletClient || !publicClient || !address || !handleClient) return;
    const OWNER = address;
    await runner.runAll([
      {
        label: "Grant NoxCompute ACL on shares handle",
        run: async () => {
          const handle = (await publicClient.readContract({
            address: vaultAddress,
            abi: vaultAbi,
            functionName: "confidentialBalanceOf",
            args: [OWNER],
          })) as Hex;
          const fees = await bumpFees(publicClient);
          const tx = await walletClient.writeContract({
            address: NOX_COMPUTE_ADDRESS,
            abi: noxComputeAbi,
            functionName: "allow",
            args: [handle, vaultAddress],
            ...fees,
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
      {
        label: "Encrypt share amount via Nox handle SDK",
        run: async () => {
          const { handle, handleProof } = await handleClient.encryptInput(
            amountWei,
            "uint256",
            vaultAddress,
          );
          (window as unknown as { __noxEncR?: { handle: Hex; proof: Hex } }).__noxEncR = {
            handle: handle as Hex,
            proof: handleProof as Hex,
          };
          return undefined;
        },
      },
      {
        label: `Submit requestRedeem (${amount} ${symbol} → pending)`,
        run: async () => {
          const enc = (window as unknown as { __noxEncR?: { handle: Hex; proof: Hex } }).__noxEncR;
          if (!enc) throw new Error("Encrypted input missing — re-run the flow.");
          const fees = await bumpFees(publicClient);
          const tx = await walletClient.writeContract({
            address: vaultAddress,
            abi: requestRedeemExternalAbi,
            functionName: "requestRedeem",
            args: [enc.handle, enc.proof, OWNER, OWNER],
            ...fees,
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          delete (window as unknown as { __noxEncR?: unknown }).__noxEncR;
          return tx;
        },
      },
    ]);
    if (runner.error === null) onSuccess?.();
  }

  return (
    <ModalShell
      title="Request redeem"
      subtitle="Enter the share amount to redeem — encrypted client-side, then sent to the vault."
      onClose={onClose}
    >
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <MI name="lock" size={14} color="var(--ct-brand)" />
        <span style={{ flex: 1, font: "600 13px/18px var(--ct-font-body)", color: "var(--ct-fg-3)" }}>
          Shares balance
        </span>
        <span style={{ font: "800 16px/22px var(--ct-font-display)", color: "var(--ct-fg-1)" }}>
          <DecryptedAmount handle={shares as `0x${string}` | undefined} decimals={6} suffix={symbol} />
        </span>
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          gap: 10,
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
            font: "700 26px/32px var(--ct-font-display)",
            letterSpacing: "-0.3px",
            fontVariantNumeric: "tabular-nums",
          }}
        />
        <span style={{ font: "700 15px/20px var(--ct-font-display)", color: "var(--ct-fg-4)" }}>{symbol}</span>
      </div>

      {!hasShares && (
        <div style={{ marginTop: 12 }}>
          <WarnNote icon="info">No shares balance to redeem.</WarnNote>
        </div>
      )}

      <PrimaryButton
        icon="call_made"
        onClick={submit}
        disabled={!canSubmit}
        loading={runner.running}
        style={{ width: "100%", marginTop: 16, height: 48 }}
      >
        {runner.running ? "Submitting…" : runner.done ? "Submitted" : "Request redeem"}
      </PrimaryButton>

      {runner.steps.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <StepList steps={runner.steps} />
        </div>
      )}
    </ModalShell>
  );
}
