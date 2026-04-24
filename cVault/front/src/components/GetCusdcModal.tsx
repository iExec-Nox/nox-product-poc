"use client";

// L2 "Get cUSDC" modal. 4 scenarios, derived automatically from the user's USDC + cUSDC
// balances. All "wrap" actions link out to https://cdefi.iex.ec per the design chat —
// we never wrap in-app.

import { MI, PrimaryButton } from "./ui";

export type GetCusdcScenario = "sufficient" | "insufficient" | "wrap" | "none";

export function pickScenario(
  usdcBalance: number,
  cusdcBalance: number,
  requiredAmount: number,
): GetCusdcScenario {
  if (cusdcBalance >= requiredAmount) return "sufficient";
  if (cusdcBalance > 0) return "insufficient";
  if (usdcBalance > 0) return "wrap";
  return "none";
}

export function GetCusdcModal({
  scenario,
  usdcBalance,
  cusdcBalance,
  onClose,
}: {
  scenario: GetCusdcScenario;
  usdcBalance: number;
  cusdcBalance: number;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(10,10,14,0.72)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "ct-fade-up 200ms ease-out",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--ct-surface-1)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 24,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--ct-brand-tint-12)",
          padding: 28,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 9999,
            border: 0,
            background: "rgba(255,255,255,0.05)",
            color: "var(--ct-fg-4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MI name="close" size={16} />
        </button>

        <div style={{ paddingRight: 40 }}>
          <div
            style={{
              font: "800 22px/28px var(--ct-font-display)",
              color: "var(--ct-fg-1)",
              letterSpacing: "-0.5px",
            }}
          >
            Get cUSDC
          </div>
          <div style={{ font: "400 13px/18px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 4 }}>
            1 USDC = 1 cUSDC · No fees
          </div>
        </div>

        {/* Balances card */}
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              font: "700 10px/14px var(--ct-font-ui)",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "var(--ct-fg-5)",
              marginBottom: 10,
            }}
          >
            Your wallet balances
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
            <BalanceCard label="USDC balance" amount={usdcBalance} hint="available to wrap" />
            <MI name="arrow_forward" size={18} color="var(--ct-fg-5)" />
            <BalanceCard label="cUSDC balance" amount={cusdcBalance} hint="currently held" />
          </div>
        </div>

        {scenario === "sufficient" && <Sufficient onClose={onClose} />}
        {scenario === "insufficient" && <Insufficient cusdcBalance={cusdcBalance} />}
        {scenario === "wrap" && <WrapOnly />}
        {scenario === "none" && <NoFunds />}
      </div>
    </div>
  );
}

function BalanceCard({ label, amount, hint }: { label: string; amount: number; hint: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ font: "500 12px/16px var(--ct-font-ui)", color: "var(--ct-fg-5)" }}>{label}</div>
      <div
        style={{
          font: "800 22px/28px var(--ct-font-display)",
          color: "var(--ct-fg-1)",
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}
      </div>
      <div style={{ font: "500 11px/15px var(--ct-font-body)", color: "var(--ct-fg-5)", marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function Sufficient({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        style={{
          marginTop: 22,
          padding: 16,
          borderRadius: 12,
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.30)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <MI name="check_circle" size={20} color="var(--ct-success-light)" style={{ marginTop: 1 }} />
        <div style={{ font: "500 13px/19px var(--ct-font-body)", color: "#6EE7B7" }}>
          <b style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>You have enough cUSDC to deposit.</b> You
          can close this and continue with your deposit amount.
        </div>
      </div>
      <PrimaryButton icon="arrow_forward" onClick={onClose} style={{ width: "100%", marginTop: 16, height: 52 }}>
        Continue to deposit
      </PrimaryButton>
      <div
        style={{
          font: "500 12px/17px var(--ct-font-body)",
          color: "var(--ct-fg-5)",
          marginTop: 14,
          textAlign: "center",
        }}
      >
        Need more cUSDC later? Top up on{" "}
        <a
          href="https://cdefi.iex.ec"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--ct-brand)", textDecoration: "none" }}
        >
          cdefi.iex.ec
        </a>
        .
      </div>
    </>
  );
}

function Insufficient({ cusdcBalance }: { cusdcBalance: number }) {
  return (
    <>
      <div
        style={{
          marginTop: 22,
          padding: "18px 20px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          font: "500 14px/21px var(--ct-font-body)",
          color: "var(--ct-fg-3)",
          textAlign: "center",
        }}
      >
        You have{" "}
        <b style={{ color: "var(--ct-fg-1)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {cusdcBalance.toLocaleString("en-US", { maximumFractionDigits: 4 })} cUSDC
        </b>
        . Get more cUSDC on cDeFi to reach your intended deposit amount.
      </div>
      <a
        href="https://cdefi.iex.ec"
        target="_blank"
        rel="noreferrer"
        style={{ textDecoration: "none", display: "block", marginTop: 16 }}
      >
        <PrimaryButton icon="north_east" style={{ width: "100%", height: 52 }}>
          Get more cUSDC on cDeFi
        </PrimaryButton>
      </a>
      <div
        style={{
          font: "500 12px/17px var(--ct-font-body)",
          color: "var(--ct-fg-5)",
          marginTop: 14,
          textAlign: "center",
        }}
      >
        Come back here once you have enough cUSDC in your wallet.
      </div>
    </>
  );
}

function WrapOnly() {
  return (
    <>
      <div
        style={{
          marginTop: 22,
          padding: "18px 20px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          font: "500 14px/21px var(--ct-font-body)",
          color: "var(--ct-fg-3)",
          textAlign: "center",
        }}
      >
        You need to wrap your USDC to cUSDC before depositing.
        <br />
        This also covers the gas setup needed on Arbitrum.
      </div>
      <a
        href="https://cdefi.iex.ec"
        target="_blank"
        rel="noreferrer"
        style={{ textDecoration: "none", display: "block", marginTop: 16 }}
      >
        <PrimaryButton icon="north_east" style={{ width: "100%", height: 52 }}>
          Go to cDeFi to get cUSDC
        </PrimaryButton>
      </a>
      <div
        style={{
          font: "500 12px/17px var(--ct-font-body)",
          color: "var(--ct-fg-5)",
          marginTop: 14,
          textAlign: "center",
        }}
      >
        Come back here once you have cUSDC in your wallet.
      </div>
    </>
  );
}

function NoFunds() {
  return (
    <>
      <div
        style={{
          marginTop: 22,
          padding: 16,
          borderRadius: 12,
          background: "rgba(245,158,11,0.10)",
          border: "1px solid rgba(245,158,11,0.35)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <MI name="warning_amber" size={20} color="var(--ct-warn)" style={{ marginTop: 1 }} />
        <div style={{ font: "500 13px/19px var(--ct-font-body)", color: "#FCD34D" }}>
          <b style={{ fontWeight: 700 }}>You don&apos;t have any USDC in your wallet.</b> You&apos;ll need USDC first,
          then wrap it to cUSDC on cDeFi.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <a href="https://cdefi.iex.ec" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <PrimaryButton icon="north_east" style={{ width: "100%", height: 52 }}>
            Get test USDC / cUSDC on cDeFi
          </PrimaryButton>
        </a>
      </div>
      <div
        style={{
          font: "500 12px/17px var(--ct-font-body)",
          color: "var(--ct-fg-5)",
          marginTop: 14,
          textAlign: "center",
        }}
      >
        Once you have USDC, wrap it to cUSDC on cdefi.iex.ec to deposit into this vault.
      </div>
    </>
  );
}
