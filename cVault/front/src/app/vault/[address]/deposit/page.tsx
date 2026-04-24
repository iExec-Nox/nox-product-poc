"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import type { Address, Hex } from "viem";
import { parseUnits, formatUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";

import { Shell } from "@/components/Shell";
import {
  Badge,
  Card,
  Field,
  InfoNote,
  KV,
  MI,
  PrimaryButton,
  StepList,
  WarnNote,
} from "@/components/ui";
import { HStepper, VaultHero } from "@/components/lp";
import { DecryptedAmount } from "@/components/DecryptedAmount";
import { useDecryptedHandle } from "@/hooks/useDecryptedHandle";
import { useStepRunner } from "@/lib/useStepRunner";
import { GetCusdcModal, pickScenario, type GetCusdcScenario } from "@/components/GetCusdcModal";

import { CUSDC_ADDRESS, NOX_COMPUTE_ADDRESS, VAULT_ADDRESS, ZERO_HANDLE } from "@/config/contracts";
import { cusdcAbi } from "@/abi/cusdc";
import { erc20Abi } from "@/abi/erc20";
import { noxComputeAbi } from "@/abi/nox";
import { vaultAbi } from "@/abi/vault";
import { depositClaimAbi, requestDepositHandleAbi } from "@/abi/vaultOverloads";

const USDC_DECIMALS = 6;

/**
 * L2 — Deposit request + claim. Keeps the existing 5-step contract flow from the pre-redesign
 * page and only changes the visual shell (VaultHero, big AmountField, "Get cUSDC" modal,
 * HStepper).
 */
export default function DepositPage({ params }: { params: Promise<{ address: string }> }) {
  const router = useRouter();
  const { address: vaultAddrParam } = use(params);
  const vaultAddress = (vaultAddrParam as Address) || VAULT_ADDRESS;

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [amount, setAmount] = useState("0.1");
  const [modalScenario, setModalScenario] = useState<GetCusdcScenario | null>(null);
  const runner = useStepRunner();
  const claimRunner = useStepRunner();

  // Vault metadata
  const { data: vaultName } = useReadContract({ address: vaultAddress, abi: vaultAbi, functionName: "name" });
  const { data: vaultSymbol } = useReadContract({ address: vaultAddress, abi: vaultAbi, functionName: "symbol" });

  // Underlying USDC address
  const { data: underlyingUsdc } = useReadContract({
    address: CUSDC_ADDRESS,
    abi: cusdcAbi,
    functionName: "underlying",
  });

  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: underlyingUsdc as Address | undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!underlyingUsdc },
  });

  const { data: cusdcHandle } = useReadContract({
    address: CUSDC_ADDRESS,
    abi: cusdcAbi,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  // cUSDC is encrypted — we derive a UI-visible number from the decrypted handle, if the user
  // has already revealed it elsewhere. Otherwise, the "Get cUSDC" modal falls back to
  // "wrap"/"none" heuristics.
  const { state: cusdcState } = useDecryptedHandle(cusdcHandle as `0x${string}` | undefined);

  const { data: pendingDeposit, refetch: refetchPendingDeposit } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "pendingDepositRequest",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: claimableDeposit, refetch: refetchClaimable } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "claimableDepositRequest",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: shares, refetch: refetchShares } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  let amountWei = 0n;
  try {
    if (amount) amountWei = parseUnits(amount, USDC_DECIMALS);
  } catch {
    amountWei = 0n;
  }

  const usdcNum = typeof usdcBalance === "bigint" ? Number(formatUnits(usdcBalance as bigint, USDC_DECIMALS)) : 0;
  const cusdcNum = cusdcState.status === "ok" ? Number(formatUnits(cusdcState.value, USDC_DECIMALS)) : 0;
  const amountNum = Number(amount) || 0;

  const insufficient = typeof usdcBalance === "bigint" && amountWei > (usdcBalance as bigint);
  const hasPending = pendingDeposit && pendingDeposit !== ZERO_HANDLE;
  const hasClaimable = claimableDeposit && claimableDeposit !== ZERO_HANDLE;

  // Which step of the HStepper is active?
  const activeStep = hasClaimable ? 2 : hasPending ? 1 : 0;

  const openGetCUSDC = () => setModalScenario(pickScenario(usdcNum, cusdcNum, amountNum));

  async function handleRequestDeposit() {
    if (!walletClient || !publicClient || !address) return;
    if (amountWei === 0n) return;

    const OWNER = address;
    const USDC = underlyingUsdc as Address;

    await runner.runAll([
      {
        label: "Approve USDC for cUSDC wrapper",
        run: async () => {
          const tx = await walletClient.writeContract({
            address: USDC,
            abi: erc20Abi,
            functionName: "approve",
            args: [CUSDC_ADDRESS, amountWei],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
      {
        label: "Wrap USDC into cUSDC",
        run: async () => {
          const tx = await walletClient.writeContract({
            address: CUSDC_ADDRESS,
            abi: cusdcAbi,
            functionName: "wrap",
            args: [OWNER, amountWei],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
      {
        label: "Set vault as operator on cUSDC (24h)",
        run: async () => {
          const until = Math.floor(Date.now() / 1000) + 24 * 3600;
          const tx = await walletClient.writeContract({
            address: CUSDC_ADDRESS,
            abi: cusdcAbi,
            functionName: "setOperator",
            args: [vaultAddress, until],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
      {
        label: "Grant NoxCompute ACL on balance handle",
        run: async () => {
          const handle = (await publicClient.readContract({
            address: CUSDC_ADDRESS,
            abi: cusdcAbi,
            functionName: "confidentialBalanceOf",
            args: [OWNER],
          })) as Hex;
          const tx = await walletClient.writeContract({
            address: NOX_COMPUTE_ADDRESS,
            abi: noxComputeAbi,
            functionName: "allow",
            args: [handle, vaultAddress],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
      {
        label: "Submit requestDeposit (→ pending)",
        run: async () => {
          const handle = (await publicClient.readContract({
            address: CUSDC_ADDRESS,
            abi: cusdcAbi,
            functionName: "confidentialBalanceOf",
            args: [OWNER],
          })) as Hex;
          const tx = await walletClient.writeContract({
            address: vaultAddress,
            abi: requestDepositHandleAbi,
            functionName: "requestDeposit",
            args: [handle, OWNER, OWNER],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
    ]);

    refetchUsdcBalance();
    refetchPendingDeposit();
  }

  async function handleClaim() {
    if (!walletClient || !publicClient || !address) return;
    const OWNER = address;
    await claimRunner.runAll([
      {
        label: "Claim deposit — mint shares at live NAV",
        run: async () => {
          const tx = await walletClient.writeContract({
            address: vaultAddress,
            abi: depositClaimAbi,
            functionName: "deposit",
            args: [OWNER, OWNER],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
    ]);
    refetchClaimable();
    refetchShares();
  }

  if (!isConnected) {
    return (
      <Shell>
        <Card title="Connect wallet to deposit">Please connect to continue.</Card>
      </Shell>
    );
  }

  const name = (vaultName as string | undefined) ?? "Confidential Vault";
  const symbol = (vaultSymbol as string | undefined) ?? "cvUSDC";

  return (
    <Shell>
      <VaultHero
        back={{ label: "Back to vaults", onClick: () => router.push("/portfolio") }}
        title={`Deposit into ${name} (${symbol})`}
        badges={
          <>
            <Badge tone="brand" icon="lock">
              Confidential
            </Badge>
            <Badge tone="neutral">ERC-7540</Badge>
          </>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860, margin: "0 auto", width: "100%" }}>
        <Card title="Submit deposit request" subtitle="Enter the amount of USDC to wrap and deposit.">
          {/* cUSDC balance bar */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 9999,
                flexShrink: 0,
                background: "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MI name="account_balance_wallet" size={14} color="var(--ct-fg-4)" />
            </div>
            <div style={{ flex: 1, font: "600 13px/18px var(--ct-font-body)", color: "var(--ct-fg-3)" }}>
              cUSDC balance:{" "}
              <b style={{ fontWeight: 800, color: "var(--ct-fg-1)" }}>
                <DecryptedAmount handle={cusdcHandle as `0x${string}` | undefined} decimals={6} suffix="cUSDC" />
              </b>
            </div>
            <button
              onClick={openGetCUSDC}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 8,
                background: "var(--ct-brand-tint-18)",
                border: "1px solid var(--ct-brand-border)",
                color: "var(--ct-brand)",
                font: "800 12px/18px var(--ct-font-display)",
                display: "inline-flex",
                gap: 4,
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              Get cUSDC <MI name="arrow_forward" size={13} />
            </button>
          </div>

          {/* Big amount input */}
          <Field label="Amount (USDC)" required hint="USDC has 6 decimals. Your USDC is wrapped into cUSDC before deposit.">
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
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: 0,
                  outline: 0,
                  color: "#fff",
                  font: "700 32px/38px var(--ct-font-display)",
                  letterSpacing: "-0.5px",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
              <span style={{ font: "700 18px/22px var(--ct-font-display)", color: "var(--ct-fg-4)" }}>USDC</span>
              <button
                onClick={() => {
                  if (typeof usdcBalance === "bigint") setAmount(formatUnits(usdcBalance as bigint, USDC_DECIMALS));
                }}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: 8,
                  background: "var(--ct-brand-tint-18)",
                  border: "1px solid var(--ct-brand-border)",
                  color: "var(--ct-brand)",
                  font: "700 12px/18px var(--ct-font-display)",
                  cursor: "pointer",
                }}
              >
                Max
              </button>
            </div>
          </Field>

          {insufficient && (
            <div style={{ marginTop: 14 }}>
              <WarnNote icon="warning_amber">
                Not enough USDC. You have{" "}
                {typeof usdcBalance === "bigint" ? formatUnits(usdcBalance as bigint, USDC_DECIMALS) : "—"} USDC.
              </WarnNote>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <PrimaryButton
              icon="rocket_launch"
              onClick={handleRequestDeposit}
              disabled={amountWei === 0n || insufficient || runner.running || !underlyingUsdc}
              loading={runner.running}
              style={{ width: "100%", height: 52 }}
            >
              {runner.running ? "Submitting…" : "Submit deposit request"}
            </PrimaryButton>
          </div>

          {runner.steps.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <StepList steps={runner.steps} />
            </div>
          )}
          {runner.error && (
            <div style={{ marginTop: 14 }}>
              <WarnNote icon="error">{runner.error}</WarnNote>
            </div>
          )}
          {runner.done && (
            <div style={{ marginTop: 14 }}>
              <InfoNote icon="check_circle">
                Request submitted. The vault owner must approve it next. Come back here once approved to claim.
              </InfoNote>
            </div>
          )}
        </Card>

        <Card title="How it works" subtitle="ERC-7540 is an asynchronous deposit standard.">
          <HStepper active={activeStep} steps={["Submit request", "Wait for approval", "Claim your shares"]} />
          <div style={{ marginTop: 20 }}>
            <WarnNote icon="schedule">
              This is not an instant deposit. The vault manager will review and approve your request before shares are
              issued.
            </WarnNote>
          </div>
        </Card>

        {(hasPending || hasClaimable) && (
          <Card title="Request status" subtitle="Track your pending deposit and claim when ready.">
            <KV label="Pending">
              {hasPending ? (
                <Badge tone="warn" icon="schedule">
                  Awaiting approval
                </Badge>
              ) : (
                <span style={{ color: "var(--ct-fg-5)" }}>none</span>
              )}
            </KV>
            <KV label="Pending amount">
              <DecryptedAmount handle={pendingDeposit as `0x${string}` | undefined} decimals={6} suffix="cUSDC" />
            </KV>
            <KV label="Claimable">
              {hasClaimable ? (
                <Badge tone="success" icon="check_circle">
                  Ready
                </Badge>
              ) : (
                <span style={{ color: "var(--ct-fg-5)" }}>none</span>
              )}
            </KV>
            <KV label="Claimable amount">
              <DecryptedAmount handle={claimableDeposit as `0x${string}` | undefined} decimals={6} suffix="cUSDC" />
            </KV>
            <KV label="Your shares" last>
              <DecryptedAmount handle={shares as `0x${string}` | undefined} decimals={6} suffix={symbol} />
            </KV>

            <div style={{ marginTop: 20 }}>
              <PrimaryButton
                icon="check"
                onClick={handleClaim}
                disabled={!hasClaimable || claimRunner.running}
                loading={claimRunner.running}
                style={{ width: "100%", height: 52 }}
              >
                Claim shares
              </PrimaryButton>
            </div>

            {claimRunner.steps.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <StepList steps={claimRunner.steps} />
              </div>
            )}
            {claimRunner.error && (
              <div style={{ marginTop: 14 }}>
                <WarnNote icon="error">{claimRunner.error}</WarnNote>
              </div>
            )}
          </Card>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Link href="/admin" style={{ textDecoration: "none", color: "var(--ct-fg-5)" }}>
            <span style={{ font: "500 12px/17px var(--ct-font-body)" }}>Vault owner? Go to Admin →</span>
          </Link>
        </div>
      </div>

      {modalScenario && (
        <GetCusdcModal
          scenario={modalScenario}
          usdcBalance={usdcNum}
          cusdcBalance={cusdcNum}
          onClose={() => setModalScenario(null)}
        />
      )}
    </Shell>
  );
}
