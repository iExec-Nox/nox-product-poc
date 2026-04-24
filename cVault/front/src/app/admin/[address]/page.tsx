"use client";

import { use, useState } from "react";
import type { Address, Hex } from "viem";
import { isAddress } from "viem";
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
  SecondaryButton,
  StepList,
  TextInput,
  WarnNote,
} from "@/components/ui";
import { DecryptedAmount } from "@/components/DecryptedAmount";
import { useStepRunner } from "@/lib/useStepRunner";

import { ZERO_HANDLE } from "@/config/contracts";
import { vaultAbi } from "@/abi/vault";

export default function AdminVaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address: vaultAddrParam } = use(params);
  const vaultAddress = vaultAddrParam as Address;

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [controller, setController] = useState("");
  const depositRunner = useStepRunner();
  const redeemRunner = useStepRunner();

  const { data: vaultOwner } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "owner",
  });
  const isOwner = address && vaultOwner && address.toLowerCase() === (vaultOwner as string).toLowerCase();

  const parsedController = isAddress(controller) ? (controller as Address) : undefined;

  const { data: pendingDeposit, refetch: refetchPendingDeposit } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "pendingDepositRequest",
    args: parsedController ? [parsedController] : undefined,
    query: { enabled: !!parsedController },
  });
  const { data: pendingRedeem, refetch: refetchPendingRedeem } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "pendingRedeemRequest",
    args: parsedController ? [parsedController] : undefined,
    query: { enabled: !!parsedController },
  });

  const hasPendingDeposit = pendingDeposit && pendingDeposit !== ZERO_HANDLE;
  const hasPendingRedeem = pendingRedeem && pendingRedeem !== ZERO_HANDLE;

  async function handleApproveDeposit() {
    if (!walletClient || !publicClient || !parsedController) return;
    if (!hasPendingDeposit) return;

    await depositRunner.runAll([
      {
        label: `approveDeposit(${pendingDeposit?.slice(0, 10)}…, ${parsedController.slice(0, 6)}…)`,
        run: async () => {
          const tx = await walletClient.writeContract({
            address: vaultAddress,
            abi: vaultAbi,
            functionName: "approveDeposit",
            args: [pendingDeposit as Hex, parsedController],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
    ]);
    refetchPendingDeposit();
  }

  async function handleApproveRedeem() {
    if (!walletClient || !publicClient || !parsedController) return;
    if (!hasPendingRedeem) return;

    await redeemRunner.runAll([
      {
        label: `approveRedeem(${pendingRedeem?.slice(0, 10)}…, ${parsedController.slice(0, 6)}…)`,
        run: async () => {
          const tx = await walletClient.writeContract({
            address: vaultAddress,
            abi: vaultAbi,
            functionName: "approveRedeem",
            args: [pendingRedeem as Hex, parsedController],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          return tx;
        },
      },
    ]);
    refetchPendingRedeem();
  }

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
            Approve pending requests
          </h1>
        </div>
        {isOwner ? (
          <Badge tone="success" icon="verified">
            Vault owner
          </Badge>
        ) : (
          <Badge tone="warn" icon="warning">
            Read-only
          </Badge>
        )}
      </div>

      <Card>
        <KV label="Vault">
          <code style={{ font: "500 12px/20px ui-monospace, Menlo, monospace", color: "var(--ct-indigo-200)" }}>
            {vaultAddress}
          </code>
        </KV>
        <KV label="Vault owner" last>
          <code style={{ font: "500 12px/20px ui-monospace, Menlo, monospace", color: "var(--ct-indigo-200)" }}>
            {(vaultOwner as string | undefined) ?? "—"}
          </code>
        </KV>
      </Card>

      {!isOwner && (
        <div style={{ marginTop: 16 }}>
          <WarnNote icon="lock">
            Your connected account is not the vault owner. You can inspect pending requests below but calls to{" "}
            <code>approveDeposit</code> / <code>approveRedeem</code> will revert.
          </WarnNote>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Card title="Controller lookup" subtitle="Enter the LP address that submitted a request">
          <Field label="Controller address" required>
            <TextInput
              value={controller}
              onChange={setController}
              placeholder="0x…"
              mono
              prefix={<MI name="person" size={14} color="var(--ct-fg-5)" />}
            />
          </Field>
          {address && (
            <div style={{ marginTop: 10 }}>
              <SecondaryButton icon="content_paste" onClick={() => setController(address)}>
                Use my address
              </SecondaryButton>
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 20 }}>
        <Card title="Pending deposit" subtitle="Calls approveDeposit(handle, controller)">
          <KV label="Controller">
            {parsedController ? (
              <code style={{ font: "500 12px/20px ui-monospace, Menlo, monospace", color: "var(--ct-indigo-200)" }}>
                {parsedController}
              </code>
            ) : (
              <span style={{ color: "var(--ct-fg-5)" }}>—</span>
            )}
          </KV>
          <KV label="Pending amount" last>
            <DecryptedAmount
              handle={pendingDeposit as `0x${string}` | undefined}
              decimals={6}
              suffix="cUSDC"
            />
          </KV>
          <div style={{ marginTop: 20 }}>
            <PrimaryButton
              icon="check"
              onClick={handleApproveDeposit}
              disabled={!hasPendingDeposit || !isOwner || depositRunner.running}
              loading={depositRunner.running}
            >
              Approve deposit
            </PrimaryButton>
          </div>
          {depositRunner.steps.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <StepList steps={depositRunner.steps} />
            </div>
          )}
          {depositRunner.error && (
            <div style={{ marginTop: 14 }}>
              <WarnNote icon="error">{depositRunner.error}</WarnNote>
            </div>
          )}
          {depositRunner.done && (
            <div style={{ marginTop: 14 }}>
              <InfoNote icon="check_circle">Approved. The controller can now claim their shares.</InfoNote>
            </div>
          )}
        </Card>

        <Card title="Pending redeem" subtitle="Calls approveRedeem(handle, controller)">
          <KV label="Controller">
            {parsedController ? (
              <code style={{ font: "500 12px/20px ui-monospace, Menlo, monospace", color: "var(--ct-indigo-200)" }}>
                {parsedController}
              </code>
            ) : (
              <span style={{ color: "var(--ct-fg-5)" }}>—</span>
            )}
          </KV>
          <KV label="Pending amount" last>
            <DecryptedAmount
              handle={pendingRedeem as `0x${string}` | undefined}
              decimals={6}
              suffix="shares"
            />
          </KV>
          <div style={{ marginTop: 20 }}>
            <PrimaryButton
              icon="check"
              onClick={handleApproveRedeem}
              disabled={!hasPendingRedeem || !isOwner || redeemRunner.running}
              loading={redeemRunner.running}
            >
              Approve redeem
            </PrimaryButton>
          </div>
          {redeemRunner.steps.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <StepList steps={redeemRunner.steps} />
            </div>
          )}
          {redeemRunner.error && (
            <div style={{ marginTop: 14 }}>
              <WarnNote icon="error">{redeemRunner.error}</WarnNote>
            </div>
          )}
          {redeemRunner.done && (
            <div style={{ marginTop: 14 }}>
              <InfoNote icon="check_circle">Approved. The controller can now claim their cUSDC.</InfoNote>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
