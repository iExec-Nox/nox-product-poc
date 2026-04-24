"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Badge, KV, MI } from "@/components/ui";
import { AddressMono, StepHeader, WizardCard, WizardFooter, WizardShell } from "@/components/wizard";
import { SUPPORTED_TOKENS } from "@/config/contracts";
import { WIZARD_STEPS, useWizard } from "../WizardContext";

function ReviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <WizardCard title={title}>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </WizardCard>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const { state } = useWizard();
  const { address } = useAccount();

  const adminDisplay = state.admin || address || "—";
  const token = SUPPORTED_TOKENS.find((t) => t.id === state.asset);
  const assetLabel = token?.confidentialSymbol ?? state.asset;

  return (
    <WizardShell step={4} steps={WIZARD_STEPS}>
      <StepHeader
        title="Review & deploy"
        subtitle={`Review your configuration. Deployment is a single transaction on ${state.chain}.`}
      />

      <ReviewCard title="Token & general info">
        <KV label="Chain">{state.chain}</KV>
        <KV label="Underlying asset">{assetLabel}</KV>
        <KV label="Vault name">{state.name}</KV>
        <KV label="Vault symbol">{state.symbol}</KV>
        <KV label="Standard">
          <Badge tone="neutral">cERC-7540</Badge>
        </KV>
        <KV label="Confidentiality" last>
          <Badge tone="brand" icon="lock">Nox protocol</Badge>
        </KV>
      </ReviewCard>

      <ReviewCard title="Roles & permissions">
        <KV label="Administrator (initial owner)" last>
          <AddressMono>{adminDisplay}</AddressMono>
        </KV>
      </ReviewCard>

      <ReviewCard title="Confidentiality">
        <KV label="Mode">
          <Badge tone="brand" icon="shield">Full confidentiality</Badge>
        </KV>
        <KV label="Initial viewers" last>
          {state.viewers.length === 0 ? "None" : `${state.viewers.length} address${state.viewers.length === 1 ? "" : "es"}`}
        </KV>
      </ReviewCard>

      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.25)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <MI name="warning_amber" size={20} color="var(--ct-warn)" style={{ marginTop: 1 }} />
        <div>
          <div style={{ font: "700 14px/20px var(--ct-font-display)", color: "#FCD34D" }}>
            Immutable after deployment
          </div>
          <div style={{ font: "400 13px/19px var(--ct-font-body)", color: "var(--ct-fg-3)", marginTop: 4 }}>
            Vault name and symbol cannot be changed after deployment. Review carefully.
          </div>
        </div>
      </div>

      <WizardFooter
        onBack={() => router.push("/create/privacy")}
        onNext={() => router.push("/create/deploy")}
        nextLabel="Deploy confidential vault"
        nextIcon="lock"
      />
    </WizardShell>
  );
}
