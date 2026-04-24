"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Field, WarnNote } from "@/components/ui";
import { Capability, StepHeader, WizardCard, WizardFooter, WizardShell } from "@/components/wizard";
import { WIZARD_STEPS, useWizard } from "../WizardContext";

const POC_ADMIN_ADDRESS = "0xAeC6774921142D55e40c52792614759bf8621dD4";

function RoleCard({
  title,
  description,
  capabilities,
  children,
}: {
  title: string;
  description: string;
  capabilities?: string[];
  children: ReactNode;
}) {
  return (
    <WizardCard title={title} subtitle={description}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {capabilities && (
          <div>
            <div
              style={{
                font: "700 11px/14px var(--ct-font-ui)",
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "var(--ct-fg-5)",
                marginBottom: 12,
              }}
            >
              Capabilities
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
              {capabilities.map((c) => (
                <Capability key={c} label={c} />
              ))}
            </div>
          </div>
        )}
        {children}
      </div>
    </WizardCard>
  );
}

export default function RolesPage() {
  const router = useRouter();
  const { state } = useWizard();

  const adminAddress = state.admin || POC_ADMIN_ADDRESS;

  return (
    <WizardShell step={2} steps={WIZARD_STEPS}>
      <StepHeader
        title="Roles & permissions"
      />

      <RoleCard
        title="Administrator"
        description="Full control of vault parameters and governance. This address is set as the vault initial owner on-chain."
        capabilities={[
          "Assign roles",
          "Change fee rates",
          "Pause vault operation",
          "Make settings immutable",
          "Close vault",
          "Transfer ownership",
        ]}
      >
        <Field label="Administrator address">
          <code
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--ct-fg-1)",
              font: "500 13px/18px var(--ct-font-mono, monospace)",
              letterSpacing: "0.2px",
              wordBreak: "break-all",
            }}
          >
            {adminAddress}
          </code>
          <WarnNote icon="lock">
            Admin is hard-coded for the proof of concept. All newly deployed vaults use this address as initial owner.
          </WarnNote>
        </Field>
      </RoleCard>

      <WizardFooter
        onBack={() => router.push("/create/vault-info")}
        onNext={() => router.push("/create/privacy")}
        nextLabel="Confidentiality"
        nextIcon="arrow_forward"
      />
    </WizardShell>
  );
}
