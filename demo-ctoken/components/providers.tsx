"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { FaucetModalProvider } from "@/components/modals/faucet-modal-provider";
import { WrapModalProvider } from "@/components/modals/wrap-modal-provider";
import { TransferModalProvider } from "@/components/modals/transfer-modal-provider";
import { SelectiveDisclosureModalProvider } from "@/components/modals/selective-disclosure-modal-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit, useAppKitTheme } from "@reown/appkit/react";
import { sepolia } from "@reown/appkit/networks";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { wagmiAdapter, projectId } from "@/lib/wagmi";
import { APP_URL } from "@/lib/config";

let appKitInitialized = false;

function initAppKit() {
  if (appKitInitialized) return;
  appKitInitialized = true;

  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: [sepolia],
    defaultNetwork: sepolia,
    metadata: {
      name: "Confidential Token | Nox",
      description: "Manage your confidential assets privately",
      url: APP_URL,
      icons: ["/nox-icon.png"],
    },
    allowUnsupportedChain: false,
    features: {
      socials: ["google", "x", "discord", "apple", "github", "farcaster"],
      connectMethodsOrder: ["wallet", "social", "email"],
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#748eff",
      "--w3m-border-radius-master": "2px",
      "--w3m-font-family": "var(--font-mulish), sans-serif",
    },
  });
}

function AppKitThemeSync() {
  const { resolvedTheme } = useTheme();
  const appKitTheme = useAppKitTheme();
  const prevThemeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!resolvedTheme || resolvedTheme === prevThemeRef.current) return;
    prevThemeRef.current = resolvedTheme;

    const mode = resolvedTheme as "light" | "dark";
    appKitTheme.setThemeMode(mode);
    appKitTheme.setThemeVariables(
      mode === "light"
        ? {
            "--w3m-accent": "#748eff",
            "--w3m-border-radius-master": "2px",
            "--w3m-color-mix": "#e3ecff",
            "--w3m-color-mix-strength": 25,
          }
        : {
            "--w3m-accent": "#748eff",
            "--w3m-border-radius-master": "2px",
            "--w3m-color-mix": "#0f1119",
            "--w3m-color-mix-strength": 10,
          }
    );
  }, [resolvedTheme, appKitTheme]);

  return null;
}

interface ProvidersProps {
  children: React.ReactNode;
  cookies: string | null;
}

export function Providers({ children, cookies }: ProvidersProps) {
  initAppKit();

  const [queryClient] = useState(() => new QueryClient());

  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <WagmiProvider
        config={wagmiAdapter.wagmiConfig as Config}
        initialState={initialState}
      >
        <QueryClientProvider client={queryClient}>
          <AppKitThemeSync />
          <TooltipProvider>
            <FaucetModalProvider>
              <WrapModalProvider>
                <TransferModalProvider>
                  <SelectiveDisclosureModalProvider>
                    {children}
                  </SelectiveDisclosureModalProvider>
                </TransferModalProvider>
              </WrapModalProvider>
            </FaucetModalProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
