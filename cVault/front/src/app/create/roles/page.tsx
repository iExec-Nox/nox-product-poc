"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { Badge, Field, MI, TextInput, Toggle, WarnNote } from "@/components/ui";
import { Capability, StepHeader, WizardCard, WizardFooter, WizardShell } from "@/components/wizard";
import { WIZARD_STEPS, useWizard } from "../WizardContext";

function RoleCard({
  title,
  description,
  badge,
  capabilities,
  children,
}: {
  title: string;
  description: string;
  badge?: ReactNode;
  capabilities?: string[];
  children: ReactNode;
}) {
  return (
    <WizardCard title={title} subtitle={description} badge={badge}>
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
  const { address } = useAccount();
  const { state, setState } = useWizard();

  // Defer to connected wallet for the admin field if blank.
  const adminValue = state.admin || address || "";
  const adminValid = isAddress(adminValue);

  return (
    <WizardShell step={2} steps={WIZARD_STEPS}>
      <StepHeader
        title="Roles & permissions"
        subtitle="Assign addresses to the four operator roles. The curation wallet is gated by an encrypted ACL."
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
        <Field label="Administrator address" required hint="Defaults to your connected wallet if left blank.">
          <TextInput
            mono
            value={state.admin}
            onChange={(v) => setState({ admin: v })}
            placeholder={address ?? "0x…"}
          />
        </Field>
      </RoleCard>

      <RoleCard
        title="Curation wallet"
        badge={<Badge tone="violet" icon="enhanced_encryption">Encrypted ACL</Badge>}
        description="Manages vault assets and validates oracle-submitted valuations. Only visible to authorized ACL parties."
        capabilities={["Manage vault assets", "Validate submitted valuations"]}
      >
        <Field label="Curation wallet address" required immutable>
          <TextInput mono value={state.curation} onChange={(v) => setState({ curation: v })} placeholder="0x…" />
          <WarnNote>This parameter is immutable after deployment.</WarnNote>
        </Field>
      </RoleCard>

      <RoleCard
        title="Valuation oracle"
        description="Submits NAV updates to the curator for validation."
        capabilities={["Submit valuation to curator", "Expire cached valuations"]}
      >
        <Field label="Oracle address" required>
          <TextInput mono value={state.oracle} onChange={(v) => setState({ oracle: v })} placeholder="0x…" />
        </Field>
      </RoleCard>

      <RoleCard
        title="Upgrade authority"
        description="Controls contract upgrades within a timelock window."
        capabilities={[
          "Upgrade vault version",
          "Update vault upgrades timelock",
          "Make vault version immutable",
        ]}
      >
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <Field label="Upgrade authority address" required>
            <TextInput mono value={state.upgrade} onChange={(v) => setState({ upgrade: v })} placeholder="0x…" />
          </Field>
          <Field label="Upgrade timelock" hint="Minimum delay before upgrades take effect.">
            <TextInput value={state.timelock} onChange={(v) => setState({ timelock: v })} suffix="days" />
          </Field>
        </div>
      </RoleCard>

      <WizardCard title="Whitelist management" subtitle="Restrict deposits to an approved list of addresses.">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 18px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <MI
              name={state.whitelist ? "fact_check" : "block"}
              size={22}
              color={state.whitelist ? "var(--ct-brand)" : "var(--ct-fg-5)"}
            />
            <div>
              <div style={{ font: "700 14px/20px var(--ct-font-display)", color: "var(--ct-fg-1)" }}>
                Whitelist management {state.whitelist ? "enabled" : "disabled"}
              </div>
              <div style={{ font: "400 12px/16px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 2 }}>
                {state.whitelist ? "Only approved addresses can deposit." : "Deposits are open to any address."}
              </div>
            </div>
          </div>
          <Toggle checked={state.whitelist} onChange={(v) => setState({ whitelist: v })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <WarnNote icon="warning_amber">
            Can be disabled later, can&apos;t be enabled after deployment.
          </WarnNote>
        </div>
      </WizardCard>

      <WizardFooter
        onBack={() => router.push("/create/vault-info")}
        onNext={() => router.push("/create/privacy")}
        nextLabel="Confidentiality"
        nextIcon="arrow_forward"
        disabled={!adminValid}
      />
    </WizardShell>
  );
}
