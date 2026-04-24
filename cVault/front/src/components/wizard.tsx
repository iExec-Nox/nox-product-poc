"use client";

// Wizard chrome ported from project/src/shell.jsx (sidebar, card, footer)
// and a few helpers used across the Vault Creator steps.

import { CSSProperties, ReactNode, useState } from "react";
import { MI, PrimaryButton } from "./ui";

// ---------- Wizard sidebar ----------

export type WizardStep = { label: string; hint: string };

export function WizardSidebar({ step, steps }: { step: number; steps: readonly WizardStep[] }) {
  const total = steps.length;
  const clamped = Math.min(step, total);
  const pct = Math.round((clamped / total) * 100);
  return (
    <div
      style={{
        width: 300,
        padding: "40px 28px",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 32,
        background: "rgba(255,255,255,0.015)",
        flexShrink: 0,
      }}
    >
      <div>
        <div
          style={{
            font: "700 12px/16px var(--ct-font-ui)",
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--ct-brand)",
          }}
        >
          Vault Creator
        </div>
        <div
          style={{
            font: "700 22px/28px var(--ct-font-display)",
            color: "var(--ct-fg-1)",
            marginTop: 8,
            letterSpacing: "-0.5px",
          }}
        >
          Deploy a confidential vault
        </div>
        <div style={{ font: "400 13px/18px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 10 }}>
          Configure your vault in five steps before deployment.
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ font: "500 12px/16px var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>
            Step {clamped} of {total}
          </span>
          <span style={{ font: "700 12px/16px var(--ct-font-ui)", color: "var(--ct-brand)" }}>{pct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 9999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "var(--ct-brand)",
              borderRadius: 9999,
              boxShadow: "0 0 12px var(--ct-brand-soft)",
              transition: "width 300ms ease",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {steps.map((s, i) => {
          const idx = i + 1;
          const state: "done" | "active" | "pending" =
            idx < clamped ? "done" : idx === clamped ? "active" : "pending";
          return (
            <div
              key={s.label}
              style={{
                padding: "14px 14px",
                borderRadius: 12,
                background: state === "active" ? "var(--ct-brand-tint-18)" : "transparent",
                border: `1px solid ${state === "active" ? "var(--ct-brand-border)" : "transparent"}`,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 9999,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    state === "done"
                      ? "var(--ct-success)"
                      : state === "active"
                        ? "var(--ct-brand)"
                        : "rgba(255,255,255,0.05)",
                  border: state === "pending" ? "1px solid rgba(255,255,255,0.10)" : "none",
                  boxShadow: state === "active" ? "0 0 0 4px var(--ct-brand-tint-18)" : "none",
                }}
              >
                {state === "done" ? (
                  <MI name="check" size={14} color="#fff" />
                ) : (
                  <span
                    style={{
                      font: "700 12px/1 var(--ct-font-ui)",
                      color: state === "active" ? "#fff" : "var(--ct-fg-5)",
                    }}
                  >
                    {idx}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: "700 14px/20px var(--ct-font-display)",
                    color: state === "pending" ? "var(--ct-fg-5)" : "var(--ct-fg-1)",
                  }}
                >
                  {s.label}
                </div>
                <div style={{ font: "400 12px/16px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 2 }}>
                  {state === "done" ? "Completed" : s.hint}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: "rgba(116,142,255,0.08)",
          border: "1px solid var(--ct-brand-border)",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <MI name="verified_user" size={18} color="var(--ct-brand)" />
        <div style={{ font: "400 12px/17px var(--ct-font-body)", color: "var(--ct-fg-3)" }}>
          Vaults are deployed as <b style={{ color: "var(--ct-fg-1)" }}>ERC-7540</b> contracts with the Nox encryption
          layer.
        </div>
      </div>
    </div>
  );
}

// ---------- Wizard card ----------

export function WizardCard({
  title,
  subtitle,
  badge,
  right,
  children,
  style,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--ct-surface-1)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        boxShadow: "var(--ct-shadow-glow-soft)",
        padding: 28,
        ...style,
      }}
    >
      {(title || right || badge) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: subtitle ? 20 : 22 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {title && (
                <div style={{ font: "700 17px/24px var(--ct-font-display)", color: "var(--ct-fg-1)" }}>{title}</div>
              )}
              {badge}
            </div>
            {subtitle && (
              <div style={{ font: "400 13px/18px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 4 }}>
                {subtitle}
              </div>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

// ---------- Wizard footer ----------

export function WizardFooter({
  onBack,
  onNext,
  nextLabel,
  nextIcon,
  disabled,
  loading,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel: string;
  nextIcon?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 24,
        marginTop: 8,
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {onBack ? (
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "var(--ct-fg-3)",
            padding: "0 18px",
            height: 44,
            borderRadius: 12,
            font: "700 14px/20px var(--ct-font-display)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <MI name="arrow_back" size={16} />
          Back
        </button>
      ) : (
        <div />
      )}
      <PrimaryButton icon={nextIcon} onClick={onNext} disabled={disabled} loading={loading}>
        {nextLabel}
      </PrimaryButton>
    </div>
  );
}

// ---------- Wizard layout shell (sidebar + content) ----------

export function WizardShell({
  step,
  steps,
  children,
}: {
  step: number;
  steps: readonly WizardStep[];
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, alignSelf: "stretch", width: "100%" }}>
      <WizardSidebar step={step} steps={steps} />
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 56px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------- Page header (title + subtitle inside the wizard pane) ----------

export function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <div
        style={{
          font: "800 32px/38px var(--ct-font-display)",
          color: "var(--ct-fg-1)",
          letterSpacing: "-0.9px",
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div style={{ font: "400 15px/22px var(--ct-font-body)", color: "var(--ct-fg-4)", marginTop: 8 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ---------- Capability row (used by Roles step) ----------

export function Capability({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 9999,
          background: "rgba(16,185,129,0.15)",
          border: "1px solid rgba(16,185,129,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MI name="check" size={12} color="var(--ct-success-light)" />
      </div>
      <span style={{ font: "500 13px/18px var(--ct-font-body)", color: "var(--ct-fg-3)" }}>{label}</span>
    </div>
  );
}

// ---------- Mono address pill (for Review step) ----------

export function AddressMono({
  children,
  truncate = true,
  copyable = true,
}: {
  children: string | undefined | null;
  truncate?: boolean;
  copyable?: boolean;
}) {
  const text = String(children ?? "");
  const display = truncate && text.length > 14 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text || "—";
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 6,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        font: "500 12px/18px ui-monospace, 'JetBrains Mono', Menlo, monospace",
        color: "var(--ct-indigo-200)",
      }}
    >
      {display}
      {copyable && text && (
        <MI name="content_copy" size={11} color="var(--ct-fg-5)" style={{ cursor: "pointer" }} />
      )}
    </span>
  );
}

// ---------- Dropdown ----------

export function Dropdown({
  value,
  options,
  icon,
  onSelect,
  disabled,
}: {
  value: string;
  options: readonly string[];
  icon?: string;
  onSelect?: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        style={{
          width: "100%",
          height: 46,
          padding: "0 16px",
          borderRadius: 12,
          background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${open ? "var(--ct-brand)" : "rgba(255,255,255,0.10)"}`,
          display: "flex",
          gap: 10,
          alignItems: "center",
          color: "#fff",
          font: "500 15px/22px var(--ct-font-body)",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
        }}
      >
        {icon && <MI name={icon} size={18} color="var(--ct-brand)" />}
        <span style={{ flex: 1 }}>{value}</span>
        {!disabled && <MI name="expand_more" size={18} color="var(--ct-fg-4)" />}
        {disabled && <MI name="lock" size={14} color="var(--ct-fg-5)" />}
      </button>
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#2A2A31",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            padding: 6,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {options.map((o) => (
            <div
              key={o}
              onClick={() => {
                onSelect?.(o);
                setOpen(false);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                color: o === value ? "var(--ct-brand)" : "var(--ct-fg-2)",
                font: "500 14px/20px var(--ct-font-body)",
                cursor: "pointer",
                background: o === value ? "var(--ct-brand-tint-12)" : "transparent",
              }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
