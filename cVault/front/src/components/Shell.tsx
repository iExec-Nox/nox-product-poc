"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ReactNode } from "react";
import { useAccount } from "wagmi";
import { MI } from "./ui";
import { CHAIN_ID } from "@/config/contracts";

type NavItem = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  external?: boolean;
};

const NAV: NavItem[] = [
  { href: "/discover", label: "Vaults", match: (p) => p.startsWith("/discover") || p.startsWith("/vault") },
  { href: "/account", label: "Account", match: (p) => p.startsWith("/account") },
  { href: "https://docs.iex.ec/", label: "Docs", match: () => false, external: true },
];

export function TestnetBanner() {
  return (
    <div
      style={{
        height: 36,
        background: "var(--ct-brand)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        font: "500 13px/20px var(--ct-font-ui)",
        color: "#fff",
        padding: "0 24px",
      }}
    >
      <MI name="info" size={14} />
      You are on <b style={{ fontWeight: 700 }}>Arbitrum Sepolia</b>. All actions are simulated — no real assets
      involved.
    </div>
  );
}

export function NetworkChip() {
  // Read the chain directly from the connected account. `useChainId()` from wagmi reads the
  // store's "current chain" which can be stale during hydration and reports the first chain
  // from the config before the connector actually reports one — leading to a green dot on an
  // unconnected wallet and an orange dot on a freshly-connected one.
  const { isConnected, chainId: accountChainId } = useAccount();
  const onExpectedChain = isConnected && accountChainId === CHAIN_ID;
  const dotColor = !isConnected
    ? "var(--ct-fg-5)"
    : onExpectedChain
      ? "var(--ct-success, #10b981)"
      : "var(--ct-warn)";
  const dotGlow = !isConnected
    ? "none"
    : onExpectedChain
      ? "0 0 8px rgba(16,185,129,0.6)"
      : "0 0 8px rgba(245,158,11,0.6)";
  const title = !isConnected
    ? "Wallet disconnected"
    : onExpectedChain
      ? `Connected to Arbitrum Sepolia (${CHAIN_ID})`
      : `Wrong network: wallet is on chain ${accountChainId ?? "?"}, expected ${CHAIN_ID}`;
  return (
    <div
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 12px",
        borderRadius: 9,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        font: "600 13px/18px var(--ct-font-ui)",
        color: "var(--ct-fg-3)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 9999,
          background: dotColor,
          boxShadow: dotGlow,
        }}
      />
      Arbitrum Sepolia
    </div>
  );
}

export function TopNav() {
  const pathname = usePathname() ?? "";
  return (
    <div
      style={{
        height: 64,
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(29,29,36,0.82)",
        backdropFilter: "blur(16px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
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
      </Link>

      <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.08)" }} />

      <nav style={{ display: "flex", gap: 4 }}>
        {NAV.map((it) => {
          const isActive = it.match(pathname);
          const style = {
            height: 36,
            padding: "0 14px",
            borderRadius: 9,
            background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
            font: `${isActive ? 700 : 600} 14px/36px var(--ct-font-display)`,
            color: isActive ? "var(--ct-fg-1)" : "var(--ct-fg-4)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          } as const;
          if (it.external) {
            return (
              <a key={it.href} href={it.href} target="_blank" rel="noopener noreferrer" style={style}>
                {it.label}
                <MI name="open_in_new" size={12} color="var(--ct-fg-5)" />
              </a>
            );
          }
          return (
            <Link key={it.href} href={it.href} style={style}>
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />
      <NetworkChip />
      <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        maxWidth: 1200,
        width: "100%",
        margin: "0 auto",
        padding: "32px 24px 80px",
      }}
    >
      {children}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <TestnetBanner />
      <TopNav />
      <PageContainer>{children}</PageContainer>
    </>
  );
}
