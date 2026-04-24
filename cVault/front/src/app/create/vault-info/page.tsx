"use client";

import { useRouter } from "next/navigation";
import { Badge, Field, MI, TextInput, WarnNote } from "@/components/ui";
import { Dropdown, StepHeader, WizardCard, WizardFooter, WizardShell } from "@/components/wizard";
import { SUPPORTED_TOKENS, type SupportedToken } from "@/config/contracts";
import { WIZARD_STEPS, useWizard, DEFAULT_STATE } from "../WizardContext";

// Default name/symbol suggestions keyed off the token id. Only applied when the user
// hasn't yet edited the wizard defaults.
const TOKEN_DEFAULTS: Record<SupportedToken["id"], { name: string; symbol: string }> = {
  cUSDC: { name: "Delta Neutral USDC", symbol: "dnUSDC" },
  cRLC: { name: "Delta Neutral RLC", symbol: "dnRLC" },
};

function TokenTile({
  token,
  active,
  onClick,
}: {
  token: SupportedToken;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        all: "unset",
        cursor: "pointer",
        height: 72,
        padding: "0 14px",
        borderRadius: 12,
        background: active ? "var(--ct-brand-tint-18)" : "rgba(255,255,255,0.03)",
        border: active
          ? "1px solid var(--ct-brand)"
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: active ? "0 0 0 3px var(--ct-brand-tint-18)" : "none",
        display: "flex",
        gap: 12,
        alignItems: "center",
        transition: "background 120ms, border-color 120ms, box-shadow 120ms",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9999,
          flexShrink: 0,
          background: `linear-gradient(135deg, ${token.accent}, ${token.accent}aa)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.18)",
          position: "relative",
        }}
      >
        <span
          style={{
            font: "800 11px/1 var(--ct-font-display)",
            color: "#fff",
            letterSpacing: "-0.2px",
          }}
        >
          {token.underlyingSymbol}
        </span>
        <MI
          name="lock"
          size={10}
          color="#fff"
          style={{
            position: "absolute",
            right: -3,
            bottom: -3,
            background: "var(--ct-brand)",
            borderRadius: 9999,
            padding: 2,
            border: "1.5px solid var(--ct-surface-1)",
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span
          style={{
            font: "700 15px/20px var(--ct-font-display)",
            color: "var(--ct-fg-1)",
          }}
        >
          {token.confidentialSymbol}
        </span>
        <span
          style={{
            font: "500 12px/16px var(--ct-font-body)",
            color: "var(--ct-fg-5)",
          }}
        >
          {token.underlyingSymbol} wrapped in TEE
        </span>
      </div>
    </button>
  );
}

export default function VaultInfoPage() {
  const router = useRouter();
  const { state, setState } = useWizard();

  const canContinue = state.name.trim().length > 0 && state.symbol.trim().length > 0;

  const selectedToken =
    SUPPORTED_TOKENS.find((t) => t.id === state.asset) ?? SUPPORTED_TOKENS[0];
  const namePlaceholder = `e.g. ${TOKEN_DEFAULTS[selectedToken.id].name}`;
  const symbolPlaceholder = `e.g. ${TOKEN_DEFAULTS[selectedToken.id].symbol}`;

  const pickAsset = (token: SupportedToken) => {
    const patch: Partial<typeof state> = { asset: token.id };
    // Only replace name/symbol if the current values still match a known default
    // (either the wizard's factory default, or a prior token's suggested defaults).
    // That way we never clobber user edits, but picking cRLC after cUSDC still retunes the suggestion.
    const isKnownDefault =
      (state.name === DEFAULT_STATE.name && state.symbol === DEFAULT_STATE.symbol) ||
      Object.values(TOKEN_DEFAULTS).some(
        (d) => d.name === state.name && d.symbol === state.symbol,
      );
    if (isKnownDefault) {
      const suggestion = TOKEN_DEFAULTS[token.id];
      patch.name = suggestion.name;
      patch.symbol = suggestion.symbol;
    }
    setState(patch);
  };

  return (
    <WizardShell step={1} steps={WIZARD_STEPS}>
      <StepHeader
        title="Vault information"
        subtitle="Choose the chain and underlying asset, then give your vault an identity."
      />

      <WizardCard
        title="Token"
        subtitle="The chain and underlying asset define what this vault accepts as deposits."
        badge={<Badge tone="brand" icon="lock">Confidential</Badge>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Chain" required>
            <Dropdown icon="hub" value={state.chain} options={["Arbitrum Sepolia"]} disabled />
          </Field>
          <Field label="Underlying asset" required>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${SUPPORTED_TOKENS.length}, minmax(0, 1fr))`,
                gap: 10,
              }}
            >
              {SUPPORTED_TOKENS.map((token) => (
                <TokenTile
                  key={token.id}
                  token={token}
                  active={state.asset === token.id}
                  onClick={() => pickAsset(token)}
                />
              ))}
            </div>
          </Field>
        </div>
      </WizardCard>

      <WizardCard title="General information" subtitle="How your vault appears on-chain and in explorers.">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Field label="Vault name" required immutable>
            <TextInput
              value={state.name}
              onChange={(v) => setState({ name: v })}
              placeholder={namePlaceholder}
            />
            <WarnNote>This parameter is immutable after deployment.</WarnNote>
          </Field>
          <Field
            label="Vault symbol"
            required
            immutable
            hint="3–6 letters, used as the share token ticker."
          >
            <TextInput
              value={state.symbol}
              onChange={(v) => setState({ symbol: v.toUpperCase() })}
              placeholder={symbolPlaceholder}
            />
            <WarnNote>This parameter is immutable after deployment.</WarnNote>
          </Field>
          <div
            style={{
              display: "flex",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              background: "rgba(116,142,255,0.06)",
              border: "1px solid var(--ct-brand-border)",
            }}
          >
            <MI name="info" size={16} color="var(--ct-brand)" style={{ marginTop: 2 }} />
            <div style={{ font: "400 12px/18px var(--ct-font-body)", color: "var(--ct-fg-3)" }}>
              Your vault will be issued as an <b style={{ color: "var(--ct-fg-1)" }}>ERC-7540</b> tokenized share with
              Nox&apos;s confidentiality layer. Depositors receive shares minted 1:1 with NAV at time of request
              approval.
            </div>
          </div>
        </div>
      </WizardCard>

      <WizardFooter
        onNext={() => router.push("/create/roles")}
        nextLabel="Roles & permissions"
        nextIcon="arrow_forward"
        disabled={!canContinue}
      />
    </WizardShell>
  );
}
