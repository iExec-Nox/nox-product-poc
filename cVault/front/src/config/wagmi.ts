"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrumSepolia } from "wagmi/chains";
import { WALLETCONNECT_PROJECT_ID } from "./contracts";

const projectId = WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = getDefaultConfig({
  appName: "cVault",
  projectId,
  chains: [arbitrumSepolia],
  ssr: true,
});
