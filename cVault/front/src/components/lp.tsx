"use client";

// LP-specific shared primitives ported from project/src/lp_shared.jsx and the L0/L5 screens.

import { ReactNode } from "react";
import { MI } from "./ui";

// ---------- Horizontal 3-step stepper (L2, L6) ----------
export function HStepper({ steps, active }: { steps: string[]; active: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, i) => {
        const state = i < active ? "done" : i === active ? "active" : "pending";
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
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
                {state === "done" && <MI name="check" size={14} color="#fff" />}
                {state === "active" && <div style={{ width: 8, height: 8, borderRadius: 9999, background: "#fff" }} />}
                {state === "pending" && (
                  <span style={{ font: "700 12px/1 var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>{i + 1}</span>
                )}
              </div>
              <span
                style={{
                  font: `${state === "pending" ? 500 : 700} 13px/18px var(--ct-font-display)`,
                  color:
                    state === "pending"
                      ? "var(--ct-fg-5)"
                      : state === "active"
                        ? "var(--ct-fg-1)"
                        : "var(--ct-fg-2)",
                  whiteSpace: "nowrap",
                }}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 14px",
                  background: i < active ? "var(--ct-success)" : "rgba(255,255,255,0.08)",
                  borderRadius: 9999,
                  minWidth: 30,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Vault hero header (L2, L5, L6) ----------
export function VaultHero({
  title,
  badges,
  back,
  right,
}: {
  title: ReactNode;
  badges?: ReactNode;
  back?: { label: string; onClick: () => void };
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "28px 24px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.015)",
        borderRadius: 20,
        marginBottom: 24,
      }}
    >
      {back && (
        <button
          onClick={back.onClick}
          style={{
            background: "transparent",
            border: 0,
            color: "var(--ct-fg-5)",
            font: "500 13px/20px var(--ct-font-ui)",
            cursor: "pointer",
            display: "inline-flex",
            gap: 6,
            alignItems: "center",
            padding: 0,
            marginBottom: 16,
          }}
        >
          <MI name="arrow_back" size={14} /> {back.label}
        </button>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                font: "800 26px/32px var(--ct-font-display)",
                color: "var(--ct-fg-1)",
                letterSpacing: "-0.6px",
              }}
            >
              {title}
            </div>
            {badges}
          </div>
        </div>
        {right}
      </div>
    </div>
  );
}

// ---------- Metric tile (L5 PosMetric / L0 SummaryCard) ----------
export function MetricTile({
  label,
  children,
  me,
  decrypted,
  publicTag,
  sub,
  accent,
}: {
  label: string;
  children: ReactNode;
  me?: boolean;
  decrypted?: boolean;
  publicTag?: boolean;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 16,
        background: "var(--ct-surface-1)",
        border: `1px solid ${me ? "var(--ct-brand-border)" : accent ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.08)"}`,
        boxShadow: me ? "0 0 0 1px var(--ct-brand-tint-18)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span
          style={{
            font: "700 10px/14px var(--ct-font-ui)",
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--ct-fg-5)",
          }}
        >
          {label}
        </span>
        {publicTag ? (
          <span
            style={{
              display: "inline-flex",
              gap: 4,
              alignItems: "center",
              font: "700 10px/13px var(--ct-font-ui)",
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              color: "var(--ct-fg-5)",
            }}
          >
            <MI name="public" size={10} color="var(--ct-fg-5)" />
            Public
          </span>
        ) : me ? (
          <span
            style={{
              display: "inline-flex",
              gap: 4,
              alignItems: "center",
              font: "700 10px/13px var(--ct-font-ui)",
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              color: decrypted ? "var(--ct-success-light)" : "var(--ct-brand)",
            }}
          >
            <MI
              name={decrypted ? "visibility" : "lock"}
              size={12}
              color={decrypted ? "var(--ct-success-light)" : "var(--ct-brand)"}
            />
            {decrypted ? "Decrypted" : "Encrypted"}
          </span>
        ) : null}
      </div>
      <div
        style={{
          font: "700 28px/34px var(--ct-font-ui)",
          color: "var(--ct-fg-1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children}
      </div>
      {sub && (
        <div style={{ font: "500 12px/16px var(--ct-font-ui)", color: "var(--ct-fg-5)", marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}
