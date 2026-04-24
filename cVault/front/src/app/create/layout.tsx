"use client";

import { ReactNode } from "react";
import { TestnetBanner, TopNav } from "@/components/Shell";
import { WizardProvider } from "./WizardContext";

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <WizardProvider>
      <TestnetBanner />
      <TopNav />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>{children}</div>
    </WizardProvider>
  );
}
