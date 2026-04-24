"use client";

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import type { Address } from "viem";
import type { Step } from "@/components/ui";

export type Viewer = {
  label: string;
  address: string;
  role: string;
};

export type WizardState = {
  // Step 1 — Vault info
  chain: string;
  asset: string;
  name: string;
  symbol: string;

  // Step 2 — Roles (design-only; only `admin` is sent on-chain as initialOwner)
  admin: string;
  curation: string;
  oracle: string;
  upgrade: string;
  timelock: string;
  whitelist: boolean;

  // Privacy (design-only)
  viewers: Viewer[];

  // Step 3 — Fees (design-only)
  mgmtRate: string;
  mgmtRecipient: string;
  perfRate: string;
  perfRecipient: string;
  minDeposit: string;
  maxDeposit: string;

  // Optional contract URI (defaulted, advanced)
  contractURI: string;
};

export const DEFAULT_STATE: WizardState = {
  chain: "Arbitrum Sepolia",
  asset: "cUSDC",
  name: "Alpha USDC",
  symbol: "αUSDC",

  admin: "",
  curation: "",
  oracle: "",
  upgrade: "",
  timelock: "1",
  whitelist: false,

  viewers: [],

  mgmtRate: "1.5",
  mgmtRecipient: "",
  perfRate: "10",
  perfRecipient: "",
  minDeposit: "",
  maxDeposit: "",

  contractURI: "ipfs://placeholder",
};

export type DeployResult = {
  vaultAddress?: Address;
  txHash?: `0x${string}`;
  steps: Step[];
  status: "idle" | "running" | "success" | "error";
  error?: string;
};

type WizardCtx = {
  state: WizardState;
  setState: (patch: Partial<WizardState>) => void;
  reset: () => void;
  deploy: DeployResult;
  setDeploy: (next: DeployResult | ((prev: DeployResult) => DeployResult)) => void;
};

const Ctx = createContext<WizardCtx | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<WizardState>(DEFAULT_STATE);
  const [deploy, setDeployRaw] = useState<DeployResult>({ steps: [], status: "idle" });

  const setState = useCallback((patch: Partial<WizardState>) => {
    setStateRaw((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setStateRaw(DEFAULT_STATE);
    setDeployRaw({ steps: [], status: "idle" });
  }, []);

  const setDeploy = useCallback(
    (next: DeployResult | ((prev: DeployResult) => DeployResult)) => {
      setDeployRaw((prev) => (typeof next === "function" ? (next as (p: DeployResult) => DeployResult)(prev) : next));
    },
    [],
  );

  const value = useMemo<WizardCtx>(
    () => ({ state, setState, reset, deploy, setDeploy }),
    [state, setState, reset, deploy, setDeploy],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWizard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWizard must be used inside WizardProvider");
  return ctx;
}

// ---------- Step metadata + nav helpers ----------

export const WIZARD_STEPS = [
  { key: "vault-info", path: "/create/vault-info", label: "Vault information", hint: "Chain, asset, name, symbol" },
  { key: "roles", path: "/create/roles", label: "Roles & permissions", hint: "Who controls the vault" },
  { key: "privacy", path: "/create/privacy", label: "Confidentiality", hint: "Privacy and viewers" },
  { key: "fees", path: "/create/fees", label: "Fee structure", hint: "Fees and deposit limits" },
  { key: "review", path: "/create/review", label: "Review & deploy", hint: "Confirm and deploy" },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

export function stepIndexFromPath(pathname: string): number {
  // /create/deploy is treated as the final step (5)
  if (pathname.startsWith("/create/deploy")) return WIZARD_STEPS.length;
  const idx = WIZARD_STEPS.findIndex((s) => pathname.startsWith(s.path));
  return idx === -1 ? 0 : idx + 1;
}
