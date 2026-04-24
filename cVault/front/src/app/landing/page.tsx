"use client";

import Image from "next/image";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MI } from "@/components/ui";
import { NetworkChip } from "@/components/Shell";

/**
 * W1 — Full-bleed landing page. The hero stays visible regardless of wallet state; the CTA
 * switches between "Connect Wallet" (opens RainbowKit modal) and "Go to Portfolio" (link).
 */
export default function LandingPage() {
  const { isConnected } = useAccount();

  return (
    <div
      style={{
        flex: 1,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(1200px 600px at 50% 15%, rgba(116,142,255,0.10), transparent 60%), var(--ct-bg)",
      }}
    >
      {/* Slim top bar (logo + network chip — no nav, no connect) */}
      <div
        style={{
          height: 64,
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              overflow: "hidden",
              position: "relative",
              boxShadow: "0 0 14px var(--ct-brand-soft)",
            }}
          >
            <Image src="/nox-icon.png" alt="Nox" fill sizes="28px" style={{ objectFit: "cover" }} />
          </div>
          <div
            style={{
              font: "800 18px/24px var(--ct-font-display)",
              color: "var(--ct-fg-1)",
              letterSpacing: "-0.3px",
            }}
          >
            cVault
          </div>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: 6,
              background: "var(--ct-brand-tint-18)",
              border: "1px solid var(--ct-brand-border)",
              font: "800 9px/14px var(--ct-font-ui)",
              letterSpacing: "1.2px",
              color: "var(--ct-brand)",
              textTransform: "uppercase",
            }}
          >
            Beta
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <NetworkChip />
      </div>

      {/* Centre hero */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 22,
            background: "linear-gradient(180deg, rgba(116,142,255,0.18), rgba(116,142,255,0.04))",
            border: "1px solid var(--ct-brand-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            boxShadow: "0 12px 40px rgba(116,142,255,0.18)",
          }}
        >
          <MI name="shield_lock" size={44} color="var(--ct-brand)" />
        </div>

        <h1
          style={{
            margin: 0,
            font: "800 56px/62px var(--ct-font-display)",
            letterSpacing: "-1.5px",
            color: "var(--ct-fg-1)",
            maxWidth: 820,
          }}
        >
          Confidential vault
        </h1>

        <p
          style={{
            marginTop: 20,
            maxWidth: 560,
            font: "400 17px/26px var(--ct-font-body)",
            color: "var(--ct-fg-4)",
          }}
        >
          Institutional-grade privacy for on-chain vaults. Powered by iExec Nox.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: 28,
          }}
        >
          {[
            { icon: "lock", label: "Encrypted balances" },
            { icon: "fact_check", label: "Selective disclosure" },
            { icon: "bolt", label: "ERC-7540 async" },
          ].map((p) => (
            <span
              key={p.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 14px",
                borderRadius: 9999,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                font: "600 13px/18px var(--ct-font-ui)",
                color: "var(--ct-fg-3)",
              }}
            >
              <MI name={p.icon} size={14} color="var(--ct-fg-4)" />
              {p.label}
            </span>
          ))}
        </div>

        <div style={{ marginTop: 40 }}>
          {isConnected ? (
            <Link
              href="/discover"
              style={{
                height: 56,
                padding: "0 32px",
                borderRadius: 14,
                background: "var(--ct-brand)",
                color: "#fff",
                font: "800 16px/24px var(--ct-font-display)",
                letterSpacing: "-0.2px",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
                boxShadow: "var(--ct-shadow-glow)",
              }}
            >
              <MI name="dashboard" size={18} />
              Go to Portfolio
            </Link>
          ) : (
            <ConnectButton.Custom>
              {({ openConnectModal, connectModalOpen }) => (
                <button
                  type="button"
                  onClick={openConnectModal}
                  disabled={connectModalOpen}
                  style={{
                    height: 56,
                    padding: "0 32px",
                    borderRadius: 14,
                    border: 0,
                    background: "var(--ct-brand)",
                    color: "#fff",
                    font: "800 16px/24px var(--ct-font-display)",
                    letterSpacing: "-0.2px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    boxShadow: "var(--ct-shadow-glow)",
                    transition: "transform 120ms ease",
                  }}
                >
                  <MI name="account_balance_wallet" size={18} />
                  Connect Wallet
                </button>
              )}
            </ConnectButton.Custom>
          )}
        </div>

        <div
          style={{
            marginTop: 14,
            font: "400 13px/18px var(--ct-font-body)",
            color: "var(--ct-fg-5)",
          }}
        >
          {isConnected
            ? "Wallet connected — explore the available vaults."
            : "You will be asked to select and authorize your wallet."}
        </div>
      </div>

      <div
        style={{
          padding: "20px 24px 24px",
          textAlign: "center",
          font: "500 11px/16px var(--ct-font-ui)",
          letterSpacing: "0.4px",
          color: "var(--ct-fg-6)",
        }}
      >
        Powered by iExec Nox · Arbitrum
      </div>
    </div>
  );
}
