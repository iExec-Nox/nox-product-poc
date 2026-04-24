"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { Badge, MI, TextInput } from "@/components/ui";
import { Dropdown, StepHeader, WizardCard, WizardFooter, WizardShell } from "@/components/wizard";
import { Viewer, WIZARD_STEPS, useWizard } from "../WizardContext";

const ROLE_OPTIONS = ["Auditor", "Compliance", "Risk Agent", "Read-only"] as const;

function truncateAddr(a: string) {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function ViewerRow({
  v,
  onRemove,
  onRename,
}: {
  v: Viewer;
  onRemove: () => void;
  onRename: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v.label);
  const commit = () => {
    const next = draft.trim() || v.label;
    onRename(next);
    setEditing(false);
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          flexShrink: 0,
          background: "rgba(116,142,255,0.14)",
          border: "1px solid var(--ct-brand-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MI name="key" size={16} color="var(--ct-brand)" />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(v.label);
                setEditing(false);
              }
            }}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--ct-brand)",
              borderRadius: 6,
              outline: 0,
              color: "#fff",
              padding: "2px 8px",
              font: "700 13px/18px var(--ct-font-display)",
              minWidth: 180,
            }}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            title="Click to rename"
            style={{
              font: "700 13px/18px var(--ct-font-display)",
              color: "var(--ct-fg-1)",
              cursor: "text",
            }}
          >
            {v.label}
          </span>
        )}
        <span
          style={{
            font: "500 12px/18px ui-monospace, 'JetBrains Mono', Menlo, monospace",
            color: "#5EEAD4",
          }}
        >
          {truncateAddr(v.address)}
        </span>
      </div>
      <Badge tone="neutral">{v.role}</Badge>
      <button
        onClick={onRemove}
        title="Remove viewer"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          color: "var(--ct-fg-5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MI name="close" size={16} />
      </button>
    </div>
  );
}

function AddViewerForm({ existing, onAdd }: { existing: Viewer[]; onAdd: (v: Viewer) => void }) {
  const [addr, setAddr] = useState("");
  const [role, setRole] = useState<string>("Auditor");
  const [error, setError] = useState("");

  const submit = () => {
    const v = addr.trim();
    if (!isAddress(v)) {
      setError("Invalid address");
      return;
    }
    if (existing.some((e) => e.address.toLowerCase() === v.toLowerCase())) {
      setError("Address already added.");
      return;
    }
    setError("");
    onAdd({ label: role, address: v, role });
    setAddr("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px auto", gap: 10, alignItems: "start" }}>
        <div>
          <div
            style={{
              font: "600 12px/16px var(--ct-font-ui)",
              color: "var(--ct-fg-4)",
              marginBottom: 6,
            }}
          >
            Wallet address
          </div>
          <TextInput
            mono
            value={addr}
            onChange={(v) => {
              setAddr(v);
              if (error) setError("");
            }}
            placeholder="0x…"
          />
          {error && (
            <div
              style={{
                font: "500 12px/16px var(--ct-font-body)",
                color: "#F87171",
                marginTop: 6,
                display: "inline-flex",
                gap: 5,
                alignItems: "center",
              }}
            >
              <MI name="error_outline" size={13} color="#F87171" />
              {error}
            </div>
          )}
        </div>
        <div>
          <div
            style={{
              font: "600 12px/16px var(--ct-font-ui)",
              color: "var(--ct-fg-4)",
              marginBottom: 6,
            }}
          >
            Role
          </div>
          <Dropdown value={role} options={ROLE_OPTIONS} icon="badge" onSelect={setRole} />
        </div>
        <div style={{ marginTop: 22 }}>
          <button
            onClick={submit}
            style={{
              height: 46,
              padding: "0 16px",
              borderRadius: 12,
              border: 0,
              background: "var(--ct-brand)",
              boxShadow: "var(--ct-shadow-glow)",
              color: "#fff",
              font: "700 14px/20px var(--ct-font-display)",
              cursor: "pointer",
              display: "inline-flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <MI name="add" size={16} /> Add viewer
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyViewers() {
  return (
    <div
      style={{
        padding: "28px 20px",
        borderRadius: 12,
        border: "1.5px dashed rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.015)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 8,
      }}
    >
      <MI name="key_off" size={22} color="var(--ct-fg-5)" />
      <div style={{ font: "500 13px/19px var(--ct-font-body)", color: "var(--ct-fg-4)", maxWidth: 440 }}>
        No viewers added yet. Add an address to grant read-only access to encrypted vault data.
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  const router = useRouter();
  const { state, setState } = useWizard();
  const viewers = state.viewers;

  // TODO: Wire viewers to the vault's `addViewer` ACL once the contract exposes it.
  const addViewer = (v: Viewer) => setState({ viewers: [...viewers, v] });
  const removeViewer = (i: number) => setState({ viewers: viewers.filter((_, j) => j !== i) });
  const renameViewer = (i: number, label: string) =>
    setState({ viewers: viewers.map((v, j) => (j === i ? { ...v, label } : v)) });

  return (
    <WizardShell step={3} steps={WIZARD_STEPS}>
      <StepHeader
        title="Confidentiality"
        subtitle="All vault activity is shielded by iExec Nox. Add initial viewers who can audit encrypted vault data."
      />

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
          padding: 18,
          borderRadius: 14,
          background: "rgba(116,142,255,0.10)",
          border: "1px solid var(--ct-brand)",
          boxShadow: "0 0 0 1px var(--ct-brand), 0 0 24px rgba(116,142,255,0.15)",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            background: "var(--ct-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--ct-shadow-glow)",
          }}
        >
          <MI name="shield" size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ font: "700 15px/22px var(--ct-font-display)", color: "var(--ct-fg-1)" }}>
              Full confidentiality (recommended)
            </span>
            <Badge tone="brand" icon="check_circle">Default · Enabled</Badge>
          </div>
          <div style={{ font: "400 13px/19px var(--ct-font-body)", color: "var(--ct-fg-3)", marginTop: 6 }}>
            Shielded shares, shielded deposits/redeems, and encrypted NAV updates. Only curator, manager, and approved
            viewers can decrypt.
          </div>
        </div>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 9999,
            flexShrink: 0,
            background: "var(--ct-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 4,
            boxShadow: "0 0 0 3px var(--ct-brand-tint-18)",
          }}
        >
          <MI name="lock" size={12} color="#fff" />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          marginTop: -8,
        }}
      >
        <MI name="info" size={14} color="var(--ct-fg-5)" style={{ marginTop: 2 }} />
        <span style={{ font: "500 12px/17px var(--ct-font-body)", color: "var(--ct-fg-5)" }}>
          Confidentiality mode is set at deployment and cannot be changed.
        </span>
      </div>

      <WizardCard
        title="Initial viewers"
        subtitle="Addresses that can decrypt vault-wide metrics (TVL, depositors, transaction history) without holding shares."
        badge={<Badge tone="neutral" icon="schedule">Coming soon</Badge>}
      >
        <div
          aria-disabled
          style={{
            pointerEvents: "none",
            opacity: 0.55,
            userSelect: "none",
          }}
        >
          {viewers.length === 0 ? (
            <EmptyViewers />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {viewers.map((v, i) => (
                <ViewerRow
                  key={`${v.address}-${i}`}
                  v={v}
                  onRemove={() => removeViewer(i)}
                  onRename={(label) => renameViewer(i, label)}
                />
              ))}
            </div>
          )}

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "18px 0" }} />

          <AddViewerForm existing={viewers} onAdd={addViewer} />
        </div>

        <div
          style={{
            marginTop: 16,
            font: "400 12px/17px var(--ct-font-body)",
            color: "var(--ct-fg-5)",
          }}
        >
          Viewer ACL management is not wired up yet for this PoC. The UI is shown as a preview of what the
          production flow will look like.
        </div>
      </WizardCard>

      <WizardFooter
        onBack={() => router.push("/create/roles")}
        onNext={() => router.push("/create/review")}
        nextLabel="Review & deploy"
        nextIcon="arrow_forward"
      />
    </WizardShell>
  );
}
