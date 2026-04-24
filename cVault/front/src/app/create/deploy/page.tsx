"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Address, Hex } from "viem";
import { decodeEventLog, isAddress } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import { Badge, Field, MI, PrimaryButton, SecondaryButton, TextInput, WarnNote } from "@/components/ui";
import { WizardCard, WizardShell } from "@/components/wizard";
import { factoryAbi } from "@/abi/factory";
import { FACTORY_ADDRESS, SUPPORTED_TOKENS } from "@/config/contracts";
import { bumpFees } from "@/lib/bumpFees";
import { randomSalt } from "@/lib/format";
import { WIZARD_STEPS, useWizard } from "../WizardContext";

type Phase = "idle" | "submitting" | "mining" | "confirmed" | "error";

const PROGRESS_LABELS = [
  "Submitting createVault transaction",
  "Waiting for confirmation on Arbitrum Sepolia",
  "Vault deployed",
];

function StepRow({ label, state }: { label: string; state: "done" | "active" | "pending" | "failed" }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 18px" }}>
      {state === "done" && (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 9999,
            background: "var(--ct-success)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MI name="check" size={14} color="#fff" />
        </div>
      )}
      {state === "active" && (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 9999,
            border: "2px solid var(--ct-brand)",
            borderTopColor: "transparent",
            animation: "ct-spin 0.9s linear infinite",
            flexShrink: 0,
          }}
        />
      )}
      {state === "pending" && (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 9999,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 9999, background: "rgba(255,255,255,0.15)" }} />
        </div>
      )}
      {state === "failed" && (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 9999,
            background: "#F87171",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MI name="close" size={14} color="#fff" />
        </div>
      )}
      <span
        style={{
          font: `${state === "pending" ? "500" : "600"} 14px/20px var(--ct-font-body)`,
          color:
            state === "pending"
              ? "var(--ct-fg-5)"
              : state === "active"
                ? "var(--ct-fg-1)"
                : state === "failed"
                  ? "#F87171"
                  : "var(--ct-fg-2)",
        }}
      >
        {label}
      </span>
      {state === "active" && (
        <span style={{ font: "500 12px/16px var(--ct-font-ui)", color: "var(--ct-brand)", marginLeft: "auto" }}>
          In progress
        </span>
      )}
      {state === "done" && (
        <span style={{ font: "500 12px/16px var(--ct-font-ui)", color: "var(--ct-success-light)", marginLeft: "auto" }}>
          Done
        </span>
      )}
    </div>
  );
}

function DeployMetric({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: "success" }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        background: "var(--ct-surface-1)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ct-fg-5)" }}>
        <MI name={icon} size={16} color={tone === "success" ? "var(--ct-success-light)" : "var(--ct-brand)"} />
        <span
          style={{
            font: "700 11px/14px var(--ct-font-ui)",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          font: "700 20px/26px var(--ct-font-ui)",
          color: "var(--ct-fg-1)",
          marginTop: 10,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function DeployPage() {
  const router = useRouter();
  const { state, setDeploy } = useWizard();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0); // 0..PROGRESS_LABELS.length
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [vaultAddress, setVaultAddress] = useState<Address | null>(null);
  const [block, setBlock] = useState<bigint | null>(null);
  const [gasUsed, setGasUsed] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const token = SUPPORTED_TOKENS.find((t) => t.id === state.asset);

  const initialOwner: Address | null = (() => {
    if (state.admin && isAddress(state.admin)) return state.admin as Address;
    if (address && isAddress(address)) return address as Address;
    return null;
  })();

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      if (!token) {
        setPhase("error");
        setError(`Unknown asset "${state.asset}". Please go back and pick a supported token.`);
        setDeploy((prev) => ({ ...prev, status: "error", error: `Unknown asset "${state.asset}".` }));
        return;
      }
      if (!walletClient || !publicClient) {
        setPhase("error");
        setError("Wallet not connected. Please connect a wallet to deploy.");
        setDeploy((prev) => ({ ...prev, status: "error", error: "Wallet not connected." }));
        return;
      }
      if (!initialOwner) {
        setPhase("error");
        setError("Invalid admin / initial owner address.");
        setDeploy((prev) => ({ ...prev, status: "error", error: "Invalid admin / initial owner address." }));
        return;
      }

      try {
        setDeploy({ steps: [], status: "running" });
        setPhase("submitting");
        setProgress(0);

        const salt = randomSalt();
        const feeOverrides = await bumpFees(publicClient);
        const hash = await walletClient.writeContract({
          address: FACTORY_ADDRESS,
          abi: factoryAbi,
          functionName: "createVault",
          args: [
            token.confidential,
            state.name,
            state.symbol,
            state.contractURI || "ipfs://placeholder",
            initialOwner,
            salt,
          ],
          ...feeOverrides,
        });
        setTxHash(hash);
        setDeploy((prev) => ({ ...prev, txHash: hash, status: "running" }));
        setPhase("mining");
        setProgress(1);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        setBlock(receipt.blockNumber);
        setGasUsed(receipt.gasUsed);
        setProgress(2);

        // Decode the ConfidentialERC7540Created event to get the vault address.
        let parsed: Address | null = null;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({
              abi: factoryAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "ConfidentialERC7540Created") {
              parsed = (decoded.args as { vault: Address }).vault;
              break;
            }
          } catch {
            // ignore non-matching logs
          }
        }
        // Unlikely fallback: if the event didn't decode, use the first log's address.
        if (!parsed && receipt.logs.length > 0) {
          parsed = receipt.logs[0].address as Address;
        }
        setVaultAddress(parsed);
        setProgress(PROGRESS_LABELS.length);
        setPhase("confirmed");
        setDeploy((prev) => ({
          ...prev,
          vaultAddress: parsed ?? undefined,
          txHash: hash,
          status: "success",
        }));
      } catch (e: unknown) {
        const msg =
          (e as { shortMessage?: string; message?: string })?.shortMessage ??
          (e as Error)?.message ??
          String(e);
        setError(msg);
        setPhase("error");
        setDeploy((prev) => ({ ...prev, status: "error", error: msg }));
      }
    })();
  }, [walletClient, publicClient, initialOwner, state.name, state.symbol, state.contractURI, state.asset, token, setDeploy]);

  const stepState = (i: number): "done" | "active" | "pending" | "failed" => {
    if (phase === "error" && i === Math.max(progress - 1, 0)) return "failed";
    if (phase === "confirmed") return "done";
    if (i < progress) return "done";
    if (i === progress) return "active";
    return "pending";
  };

  return (
    <WizardShell step={WIZARD_STEPS.length} steps={WIZARD_STEPS}>
      {phase !== "confirmed" ? (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              paddingTop: 8,
            }}
          >
            <div style={{ position: "relative", width: 80, height: 80, marginBottom: 24 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 9999,
                  border: "3px solid rgba(116,142,255,0.15)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 9999,
                  border: "3px solid var(--ct-brand)",
                  borderTopColor: "transparent",
                  animation: phase === "error" ? "none" : "ct-spin 1s linear infinite",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 18,
                  borderRadius: 9999,
                  background: "var(--ct-brand-tint-18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MI name={phase === "error" ? "error" : "lock"} size={22} color="var(--ct-brand)" />
              </div>
            </div>
            <div
              style={{
                font: "800 28px/36px var(--ct-font-display)",
                color: "var(--ct-fg-1)",
                letterSpacing: "-0.6px",
              }}
            >
              {phase === "error" ? "Deployment failed" : "Deploying your confidential vault…"}
            </div>
            <div style={{ font: "400 14px/20px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 10 }}>
              {phase === "error" ? "Review the error and try again." : "Please do not close this window."}
            </div>
          </div>

          <WizardCard title="Deployment progress">
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: -6 }}>
              {PROGRESS_LABELS.map((s, i) => (
                <StepRow key={s} label={s} state={stepState(i)} />
              ))}
            </div>
          </WizardCard>

          <WizardCard
            title="Transaction"
            badge={
              phase === "error" ? (
                <Badge tone="danger" icon="error">Failed</Badge>
              ) : phase === "mining" || phase === "submitting" ? (
                <Badge tone="warn" icon="schedule">Pending confirmation</Badge>
              ) : (
                <Badge tone="neutral">Awaiting wallet</Badge>
              )
            }
          >
            <Field label="Transaction hash">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <TextInput mono value={txHash ?? ""} onChange={() => {}} disabled placeholder="—" />
                </div>
                <a
                  href={txHash ? `https://sepolia.arbiscan.io/tx/${txHash}` : "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!txHash}
                  style={{
                    display: "inline-flex",
                    gap: 6,
                    alignItems: "center",
                    height: 46,
                    padding: "0 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: txHash ? "var(--ct-brand)" : "var(--ct-fg-5)",
                    font: "700 13px/20px var(--ct-font-display)",
                    textDecoration: "none",
                    background: "rgba(255,255,255,0.03)",
                    pointerEvents: txHash ? "auto" : "none",
                    opacity: txHash ? 1 : 0.6,
                  }}
                >
                  <MI name="open_in_new" size={14} /> Arbiscan
                </a>
              </div>
            </Field>
          </WizardCard>

          {phase === "error" && (
            <>
              <WarnNote icon="error">{error}</WarnNote>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <SecondaryButton icon="arrow_back" onClick={() => router.push("/create/review")}>
                  Back to review
                </SecondaryButton>
                <PrimaryButton
                  icon="refresh"
                  onClick={() => {
                    startedRef.current = false;
                    setPhase("idle");
                    setProgress(0);
                    setTxHash(null);
                    setError(null);
                    // trigger effect again on next render
                    setTimeout(() => {
                      startedRef.current = false;
                      // force a re-mount by navigating to the same route
                      router.refresh();
                    }, 0);
                  }}
                >
                  Retry deployment
                </PrimaryButton>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              paddingTop: 8,
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 9999,
                background: "rgba(16,185,129,0.15)",
                border: "2px solid var(--ct-success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 22,
                animation: "ct-pop 350ms ease-out",
                boxShadow: "0 0 40px rgba(16,185,129,0.3)",
              }}
            >
              <MI name="check" size={44} color="var(--ct-success-light)" />
            </div>
            <div
              style={{
                font: "800 32px/40px var(--ct-font-display)",
                color: "var(--ct-fg-1)",
                letterSpacing: "-0.8px",
              }}
            >
              Vault deployed successfully
            </div>
            <div style={{ font: "400 15px/22px var(--ct-font-body)", color: "var(--ct-fg-4)", marginTop: 10 }}>
              Your confidential vault{" "}
              <b style={{ color: "var(--ct-fg-1)" }}>
                {state.name} ({state.symbol})
              </b>{" "}
              is live on {state.chain}.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <DeployMetric
              label="Block"
              value={block ? block.toLocaleString() : "—"}
              icon="view_in_ar"
            />
            <DeployMetric label="Status" value="Confirmed" icon="verified" tone="success" />
            <DeployMetric
              label="Gas used"
              value={gasUsed ? `${gasUsed.toLocaleString()}` : "—"}
              icon="local_gas_station"
            />
          </div>

          <WizardCard title="Vault address" badge={<Badge tone="success" icon="check_circle">Live</Badge>}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <TextInput mono value={vaultAddress ?? ""} onChange={() => {}} disabled />
              </div>
              <button
                onClick={() => vaultAddress && navigator.clipboard.writeText(vaultAddress)}
                style={{
                  height: 46,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  color: "var(--ct-fg-2)",
                  font: "700 13px/20px var(--ct-font-display)",
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <MI name="content_copy" size={14} /> Copy
              </button>
              <a
                href={vaultAddress ? `https://sepolia.arbiscan.io/address/${vaultAddress}` : "#"}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  height: 46,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "var(--ct-brand)",
                  font: "700 13px/20px var(--ct-font-display)",
                  textDecoration: "none",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <MI name="open_in_new" size={14} /> Arbiscan
              </a>
            </div>
          </WizardCard>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              alignItems: "center",
              paddingTop: 8,
              flexWrap: "wrap",
            }}
          >
            {vaultAddress ? (
              <Link href={`/vault/${vaultAddress}`} style={{ textDecoration: "none" }}>
                <PrimaryButton icon="arrow_forward">Open your vault</PrimaryButton>
              </Link>
            ) : null}
            {txHash ? (
              <a
                href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  height: 46,
                  padding: "0 18px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "var(--ct-brand)",
                  font: "700 13px/20px var(--ct-font-display)",
                  textDecoration: "none",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <MI name="open_in_new" size={14} /> View on Arbiscan
              </a>
            ) : null}
          </div>
        </>
      )}
    </WizardShell>
  );
}
