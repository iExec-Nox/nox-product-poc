"use client";

import { ReactNode } from "react";
import { TestnetBanner, TopNav } from "@/components/Shell";
import { WizardProvider } from "./WizardContext";

/**
 * Banner is 36px, top nav is 64px — we pin the wizard shell to the remaining viewport height so
 * the sidebar's vertical span stays identical across every step, regardless of how long the
 * current step's form happens to be. The inner content area handles its own vertical scroll.
 */
export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <WizardProvider>
      <TestnetBanner />
      <TopNav />
      <div style={{ height: "calc(100vh - 36px - 64px)", display: "flex", minHeight: 0 }}>
        {children}
      </div>
    </WizardProvider>
  );
}
