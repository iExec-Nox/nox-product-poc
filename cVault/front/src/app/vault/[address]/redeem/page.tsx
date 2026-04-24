"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import type { Address, Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";

import { Shell } from "@/components/Shell";
import { Badge, Card, InfoNote, KV, MI, PrimaryButton, StepList, WarnNote } from "@/components/ui";
import { HStepper, VaultHero } from "@/components/lp";
import { DecryptedAmount } from "@/components/DecryptedAmount";
import { useStepRunner } from "@/lib/useStepRunner";

import { NOX_COMPUTE_ADDRESS, VAULT_ADDRESS, ZERO_HANDLE } from "@/config/contracts";
import { noxComputeAbi } from "@/abi/nox";
import { vaultAbi } from "@/abi/vault";
import { redeemClaimAbi, requestRedeemHandleAbi } from "@/abi/vaultOverloads";

/**
 * L6 — Redeem. Reuses the pre-redesign 2-step contract flow (allow + requestRedeem)
 * and adds a P&L card at the top. P&L values are estimates — the actual settlement amount is
 * computed at claim time by the vault.
 */
export default function RedeemPage({ params }: { params: Promise<{ address: string }> }) {
  const router = useRouter();
  const { address: vaultAddrParam } = use(params);
  const vaultAddress = (vaultAddrParam as Address) || VAULT_ADDRESS;

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const runner = useStepRunner();
  const claimRunner = useStepRunner();

  const { data: vaultName } = useReadContract({ address: vaultAddress, abi: vaultAbi, functionName: "name" });
  const { data: vaultSymbol } = useReadContract({ address: vaultAddress, abi: vaultAbi, functionName: "symbol" });

  const { data: shares, refetch: refetchShares } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: pendingRedeem, refetch: refetchPendingRedeem } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "pendingRedeemRequest",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: claimableRedeem, refetch: refetchClaimable } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "claimableRedeemRequest",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const hasShares = shares && shares !== ZERO_HANDLE;
  const hasPending = pendingRedeem && pendingRedeem !== ZERO_HANDLE;
  const hasClaimable = claimableRedeem && claimableRedeem !== ZERO_HANDLE;

  const activeStep = hasClaimable ? 2 : hasPending ? 1 : 0;

  async function handleRequestRedeem() {
    if (!walletClient || !publicClient || !address) return;
    if (!hasShares) return;
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
        label: "Submit requestRedeem (→ pending)",
        run: async () => {
          const handle = (await publicClient.readContract({
            address: vaultAddress,
            abi: vaultAbi,
            functionName: "confidentialBalanceOf",
            args: [OWNER],
          })) as Hex;
          const tx = await walletClient.writeContract({
            address: vaultAddress,
            abi: requestRedeemHandleAbi,
            functionName: "requestRedeem",
            args: [handle, OWNER, OWNER],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
    ]);

    refetchPendingRedeem();
    refetchShares();
  }

  async function handleClaimRedeem() {
    if (!walletClient || !publicClient || !address) return;
    const OWNER = address;
    await claimRunner.runAll([
      {
        label: "Claim redeem — burn shares, receive cUSDC",
        run: async () => {
          const tx = await walletClient.writeContract({
            address: vaultAddress,
            abi: redeemClaimAbi,
            functionName: "redeem",
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
        <Card title="Connect wallet to redeem">Please connect to continue.</Card>
      </Shell>
    );
  }

  const name = (vaultName as string | undefined) ?? "Confidential Vault";
  const symbol = (vaultSymbol as string | undefined) ?? "cvUSDC";

  return (
    <Shell>
      <VaultHero
        back={{ label: "Back to my position", onClick: () => router.push(`/vault/${vaultAddress}`) }}
        title={`Redeem from ${name} (${symbol})`}
        badges={
          <Badge tone="brand" icon="lock">
            Confidential
          </Badge>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860, margin: "0 auto", width: "100%" }}>
        {/* PnL card (locally-estimated, labelled as such) */}
        <PnLCard symbol={symbol} sharesHandle={shares as `0x${string}` | undefined} />

        <Card title="Submit redeem request" subtitle="Redeem burns your entire shares balance in this PoC.">
          <KV label="Your shares balance" last>
            <DecryptedAmount handle={shares as `0x${string}` | undefined} decimals={6} suffix={symbol} />
          </KV>

          <div style={{ marginTop: 20 }}>
            <PrimaryButton
              icon="call_made"
              onClick={handleRequestRedeem}
              disabled={!hasShares || runner.running}
              loading={runner.running}
              style={{ width: "100%", height: 52 }}
            >
              {runner.running ? "Submitting…" : "Submit redeem request"}
            </PrimaryButton>
          </div>

          {!hasShares && (
            <div style={{ marginTop: 14 }}>
              <InfoNote icon="info">
                No shares balance yet. Run the{" "}
                <Link href={`/vault/${vaultAddress}/deposit`} style={{ color: "var(--ct-brand)" }}>
                  deposit flow
                </Link>{" "}
                first, wait for approval, and claim shares.
              </InfoNote>
            </div>
          )}

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
                Redeem request submitted. Await approval, then come back to claim.
              </InfoNote>
            </div>
          )}
        </Card>

        <Card title="Redeem flow" subtitle="ERC-7540 redeems are asynchronous." right={<Badge tone="neutral">ERC-7540</Badge>}>
          <HStepper active={activeStep} steps={["Submit request", "Wait for processing", "Claim cUSDC"]} />
          <div style={{ marginTop: 20 }}>
            <WarnNote icon="schedule">
              Redeems settle on approval by the vault owner. Typical processing time: 24–72 hours.
            </WarnNote>
          </div>
        </Card>

        {(hasPending || hasClaimable) && (
          <Card title="Request status" subtitle="Phase 2/3 — approve + claim">
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
              <DecryptedAmount handle={pendingRedeem as `0x${string}` | undefined} decimals={6} suffix={symbol} />
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
            <KV label="Claimable amount" last>
              <DecryptedAmount handle={claimableRedeem as `0x${string}` | undefined} decimals={6} suffix="cUSDC" />
            </KV>

            <div style={{ marginTop: 20 }}>
              <PrimaryButton
                icon="check"
                onClick={handleClaimRedeem}
                disabled={!hasClaimable || claimRunner.running}
                loading={claimRunner.running}
                style={{ width: "100%", height: 52 }}
              >
                Claim cUSDC
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
      </div>
    </Shell>
  );
}

function PnLCard({ symbol, sharesHandle }: { symbol: string; sharesHandle: `0x${string}` | undefined }) {
  // For the PoC we don't track entry value on-chain — display placeholder copy with the
  // decrypted shares count. The real product would read epoch-level snapshots.
  return (
    <div
      style={{
        padding: "22px 24px",
        borderRadius: 18,
        background: "var(--ct-surface-1)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            background: "var(--ct-brand-tint-18)",
            border: "1px solid var(--ct-brand-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MI name="lock" size={16} color="var(--ct-brand)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                font: "800 18px/24px var(--ct-font-display)",
                color: "var(--ct-fg-1)",
                letterSpacing: "-0.3px",
              }}
            >
              Your P&L on this position
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 7px",
                borderRadius: 5,
                background: "var(--ct-brand-tint-12)",
                border: "1px solid var(--ct-brand-border)",
                font: "800 9px/13px var(--ct-font-ui)",
                letterSpacing: "0.8px",
                color: "var(--ct-brand)",
                textTransform: "uppercase",
              }}
            >
              <MI name="visibility" size={10} color="var(--ct-brand)" /> Local only
            </span>
          </div>
          <div style={{ font: "400 13px/18px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 4 }}>
            Decrypted locally from your position data.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <PnLMetric label="Current shares">
          <DecryptedAmount handle={sharesHandle} decimals={6} suffix={symbol} />
        </PnLMetric>
        <PnLMetric label="Estimated P&L" sub="vs entry at 1:1 NAV">
          <span style={{ color: "var(--ct-fg-4)" }}>—</span>
        </PnLMetric>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          font: "500 12px/17px var(--ct-font-body)",
          color: "var(--ct-fg-5)",
        }}
      >
        <MI name="info" size={13} color="var(--ct-fg-6)" style={{ marginTop: 2 }} />
        <span>
          P&L is estimated based on current NAV. Final amount is calculated at settlement. Redeemed amount is encrypted
          during the waiting period.
        </span>
      </div>
    </div>
  );
}

function PnLMetric({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.22)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        style={{
          font: "700 10px/14px var(--ct-font-ui)",
          letterSpacing: "1px",
          textTransform: "uppercase",
          color: "var(--ct-fg-5)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          font: "700 20px/26px var(--ct-font-ui)",
          color: "var(--ct-fg-1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 2,
            font: "500 12px/18px var(--ct-font-ui)",
            color: "var(--ct-fg-5)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
