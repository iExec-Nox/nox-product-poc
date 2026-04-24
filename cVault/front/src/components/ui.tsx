"use client";

// Shared UI primitives ported from project/src/*.jsx and converted to TS.
// Uses design tokens from src/ds/colors_and_type.css.

import { CSSProperties, ReactNode } from "react";

// ---------- Material Icon ----------
export function MI({
  name,
  size = 18,
  color,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="mi"
      style={{
        fontFamily: "'Material Icons'",
        fontSize: size,
        lineHeight: 1,
        color,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

// ---------- Badge ----------
export type BadgeTone = "brand" | "warn" | "success" | "neutral" | "violet" | "danger";
const BADGE_TONE: Record<BadgeTone, { bg: string; bd: string; fg: string }> = {
  brand: { bg: "var(--ct-brand-tint-18)", bd: "var(--ct-brand-border)", fg: "var(--ct-brand)" },
  warn: { bg: "rgba(245,158,11,0.14)", bd: "rgba(245,158,11,0.35)", fg: "var(--ct-warn)" },
  success: { bg: "rgba(16,185,129,0.14)", bd: "rgba(16,185,129,0.35)", fg: "var(--ct-success-light)" },
  neutral: { bg: "rgba(255,255,255,0.05)", bd: "rgba(255,255,255,0.08)", fg: "var(--ct-fg-3)" },
  violet: { bg: "rgba(138,56,245,0.16)", bd: "rgba(138,56,245,0.35)", fg: "#C4A3FF" },
  danger: { bg: "rgba(248,113,113,0.14)", bd: "rgba(248,113,113,0.35)", fg: "#F87171" },
};

export function Badge({
  children,
  tone = "brand",
  icon,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: string;
}) {
  const s = BADGE_TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 9999,
        background: s.bg,
        border: `1px solid ${s.bd}`,
        font: "700 11px/16px var(--ct-font-ui)",
        color: s.fg,
        letterSpacing: "0.3px",
        whiteSpace: "nowrap",
      }}
    >
      {icon && <MI name={icon} size={12} color={s.fg} />}
      {children}
    </span>
  );
}

// ---------- Primary button ----------
export function PrimaryButton({
  children,
  onClick,
  disabled,
  icon,
  loading,
  type = "button",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: string;
  loading?: boolean;
  type?: "button" | "submit";
  style?: CSSProperties;
}) {
  const isDisabled = disabled || loading;
  // Disabled (not loading) should read as clearly inert — grey bg, muted text, no brand tint.
  // Loading keeps the brand tint (just spinner-swap) so the user sees "working" not "blocked".
  const showDisabled = disabled && !loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        height: 44,
        padding: "0 18px",
        borderRadius: 12,
        border: showDisabled ? "1px solid rgba(255,255,255,0.08)" : 0,
        background: showDisabled
          ? "rgba(255,255,255,0.04)"
          : loading
            ? "rgba(116,142,255,0.55)"
            : "var(--ct-brand)",
        color: showDisabled ? "var(--ct-fg-5)" : "#fff",
        font: "700 14px/20px var(--ct-font-display)",
        letterSpacing: "-0.2px",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: isDisabled ? "not-allowed" : "pointer",
        boxShadow: isDisabled ? "none" : "var(--ct-shadow-glow)",
        opacity: showDisabled ? 0.75 : 1,
        transition: "transform 120ms ease, box-shadow 120ms ease",
        ...style,
      }}
    >
      {loading ? <MI name="sync" size={16} style={{ animation: "ct-pulse 1.2s infinite" }} /> : icon && <MI name={icon} size={16} />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  icon,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 44,
        padding: "0 18px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "transparent",
        color: "var(--ct-fg-3)",
        font: "700 14px/20px var(--ct-font-display)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {icon && <MI name={icon} size={16} />}
      {children}
    </button>
  );
}

// ---------- Card ----------
export function Card({
  children,
  style,
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  style?: CSSProperties;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
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
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: subtitle ? 20 : 22 }}>
          <div style={{ flex: 1 }}>
            {title && (
              <div style={{ font: "700 17px/24px var(--ct-font-display)", color: "var(--ct-fg-1)" }}>{title}</div>
            )}
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

// ---------- Field + TextInput ----------
export function Field({
  label,
  required,
  hint,
  children,
  immutable,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  immutable?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ font: "600 13px/18px var(--ct-font-ui)", color: "var(--ct-fg-3)", display: "flex", gap: 4, alignItems: "center" }}>
          {label}
          {required && <span style={{ color: "var(--ct-warn)" }}>*</span>}
        </div>
        {immutable && (
          <span
            style={{
              font: "500 11px/14px var(--ct-font-ui)",
              color: "var(--ct-warn)",
              display: "inline-flex",
              gap: 4,
              alignItems: "center",
            }}
          >
            <MI name="lock" size={12} color="var(--ct-warn)" />
            Immutable after deploy
          </span>
        )}
      </div>
      {children}
      {hint && <div style={{ font: "400 12px/16px var(--ct-font-body)", color: "var(--ct-fg-5)" }}>{hint}</div>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  mono,
  disabled,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  mono?: boolean;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div
      style={{
        height: 46,
        padding: "0 16px",
        borderRadius: 12,
        background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      {prefix && <span style={{ font: "500 14px/20px var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>{prefix}</span>}
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        type={type}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: 0,
          outline: 0,
          color: disabled ? "var(--ct-fg-5)" : "#fff",
          font: mono
            ? "500 13px/20px ui-monospace, 'JetBrains Mono', Menlo, monospace"
            : "500 15px/22px var(--ct-font-body)",
        }}
      />
      {suffix && <span style={{ font: "500 13px/20px var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>{suffix}</span>}
    </div>
  );
}

// ---------- Status chip + handle pill ----------
export function HandlePill({ handle }: { handle: string | undefined | null }) {
  const text = handle ?? "—";
  const display =
    text === "—"
      ? text
      : text === "0x0000000000000000000000000000000000000000000000000000000000000000"
        ? "none"
        : `${text.slice(0, 6)}…${text.slice(-4)}`;
  return (
    <span
      title={text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 6,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        font: "500 12px/18px ui-monospace, 'JetBrains Mono', Menlo, monospace",
        color: "var(--ct-indigo-200)",
      }}
    >
      <MI name="lock" size={10} color="var(--ct-indigo-200)" />
      {display}
    </span>
  );
}

// ---------- KV row ----------
export function KV({ label, children, last }: { label: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)",
        gap: 24,
      }}
    >
      <span style={{ font: "500 13px/18px var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>{label}</span>
      <span style={{ font: "600 14px/20px var(--ct-font-body)", color: "var(--ct-fg-1)", textAlign: "right" }}>
        {children}
      </span>
    </div>
  );
}

// ---------- Warning note ----------
export function WarnNote({ children, icon = "lock" }: { children: ReactNode; icon?: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.25)",
      }}
    >
      <MI name={icon} size={14} color="var(--ct-warn)" style={{ marginTop: 2 }} />
      <span style={{ font: "500 12px/17px var(--ct-font-body)", color: "#FCD34D" }}>{children}</span>
    </div>
  );
}

// ---------- Info note ----------
export function InfoNote({ children, icon = "info" }: { children: ReactNode; icon?: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--ct-brand-tint-12)",
        border: "1px solid var(--ct-brand-border)",
      }}
    >
      <MI name={icon} size={14} color="var(--ct-brand)" style={{ marginTop: 2 }} />
      <span style={{ font: "500 12px/17px var(--ct-font-body)", color: "var(--ct-fg-3)" }}>{children}</span>
    </div>
  );
}

// ---------- Step list (for multi-step tx flows) ----------
export type Step = {
  label: string;
  status: "pending" | "active" | "done" | "error";
  hint?: string;
  txHash?: string;
};

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {steps.map((s, i) => {
        const bg =
          s.status === "done"
            ? "var(--ct-success)"
            : s.status === "active"
              ? "var(--ct-brand)"
              : s.status === "error"
                ? "#F87171"
                : "rgba(255,255,255,0.05)";
        const icon =
          s.status === "done" ? "check" : s.status === "error" ? "close" : s.status === "active" ? "sync" : "";
        return (
          <div
            key={i}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: s.status === "active" ? "var(--ct-brand-tint-12)" : "transparent",
              border: `1px solid ${s.status === "active" ? "var(--ct-brand-border)" : "transparent"}`,
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
                background: bg,
                border: s.status === "pending" ? "1px solid rgba(255,255,255,0.10)" : "none",
                boxShadow: s.status === "active" ? "0 0 0 4px var(--ct-brand-tint-18)" : "none",
              }}
            >
              {icon ? (
                <MI
                  name={icon}
                  size={14}
                  color="#fff"
                  style={s.status === "active" ? { animation: "ct-pulse 1.2s infinite" } : undefined}
                />
              ) : (
                <span style={{ font: "700 12px/1 var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>{i + 1}</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  font: "700 14px/20px var(--ct-font-display)",
                  color: s.status === "pending" ? "var(--ct-fg-5)" : "var(--ct-fg-1)",
                }}
              >
                {s.label}
              </div>
              {(s.hint || s.txHash) && (
                <div style={{ font: "400 12px/16px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 2 }}>
                  {s.txHash ? (
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${s.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--ct-brand)", textDecoration: "none" }}
                    >
                      {`${s.txHash.slice(0, 10)}…${s.txHash.slice(-6)}`}
                    </a>
                  ) : (
                    s.hint
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Toggle ----------
export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 9999,
        border: 0,
        padding: 3,
        background: checked ? "var(--ct-brand)" : "rgba(255,255,255,0.10)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        boxShadow: checked ? "0 0 0 4px var(--ct-brand-tint-12)" : "none",
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 9999,
          background: "#fff",
          transform: checked ? "translateX(18px)" : "translateX(0)",
          transition: "transform 150ms ease",
        }}
      />
    </button>
  );
}
