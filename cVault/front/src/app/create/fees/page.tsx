"use client";

import { useRouter } from "next/navigation";
import { Field, TextInput } from "@/components/ui";
import { StepHeader, WizardCard, WizardFooter, WizardShell } from "@/components/wizard";
import { WIZARD_STEPS, useWizard } from "../WizardContext";

export default function FeesPage() {
  const router = useRouter();
  const { state, setState } = useWizard();

  return (
    <WizardShell step={4} steps={WIZARD_STEPS}>
      <StepHeader
        title="Fee structure"
        subtitle="Set fees and optional deposit limits. Fees are charged on-chain in the underlying asset."
      />

      <WizardCard
        title="Management fee"
        subtitle="Accrued continuously against TVL. Minted to the recipient on each settlement."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
          <Field label="Rate" required hint="Annualized rate. Max 5%.">
            <TextInput
              value={state.mgmtRate}
              onChange={(v) => setState({ mgmtRate: v })}
              suffix="% per year"
            />
          </Field>
          <Field label="Fee recipient address" required>
            <TextInput
              mono
              value={state.mgmtRecipient}
              onChange={(v) => setState({ mgmtRecipient: v })}
              placeholder="0x…"
            />
          </Field>
        </div>
      </WizardCard>

      <WizardCard
        title="Performance fee"
        subtitle="Charged on realized profits above the high-water mark."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
          <Field label="Rate" required hint="Percentage of profits. Max 30%.">
            <TextInput
              value={state.perfRate}
              onChange={(v) => setState({ perfRate: v })}
              suffix="% of profits"
            />
          </Field>
          <Field label="Fee recipient address" required>
            <TextInput
              mono
              value={state.perfRecipient}
              onChange={(v) => setState({ perfRecipient: v })}
              placeholder="0x…"
            />
          </Field>
        </div>
      </WizardCard>

      <WizardCard title="Deposit limits" subtitle="Optional minimum and maximum deposit per transaction.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Minimum deposit" hint="Leave blank for no minimum.">
            <TextInput
              value={state.minDeposit}
              onChange={(v) => setState({ minDeposit: v })}
              suffix="USDC"
              placeholder="0"
            />
          </Field>
          <Field label="Maximum deposit" hint="Leave blank for no maximum.">
            <TextInput
              value={state.maxDeposit}
              onChange={(v) => setState({ maxDeposit: v })}
              suffix="USDC"
              placeholder="No limit"
            />
          </Field>
        </div>
      </WizardCard>

      <WizardFooter
        onBack={() => router.push("/create/privacy")}
        onNext={() => router.push("/create/review")}
        nextLabel="Review"
        nextIcon="arrow_forward"
      />
    </WizardShell>
  );
}
