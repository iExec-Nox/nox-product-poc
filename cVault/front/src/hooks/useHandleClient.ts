"use client";

import { useWalletClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { createViemHandleClient, type HandleClient } from "@iexec-nox/handle";

/**
 * Singleton {@link HandleClient} per (account, chain). Cached by react-query's global
 * QueryClient, so every hook that needs decryption re-uses the same client — and therefore the
 * same session `DataAccessAuthorization` sig the SDK caches internally in its
 * `InMemoryStorageService`. One sign per session, reused for every subsequent `decrypt()`.
 *
 * Matches the pattern used by @iexec-nox/demo-ctoken.
 */
export function useHandleClient() {
  const { data: walletClient } = useWalletClient();

  const { data: handleClient = null, error } = useQuery<HandleClient | null>({
    queryKey: [
      "handle-client",
      walletClient?.account?.address,
      walletClient?.chain?.id,
    ],
    queryFn: async () => (walletClient ? createViemHandleClient(walletClient) : null),
    enabled: !!walletClient,
    staleTime: Infinity,
    retry: false,
  });

  return {
    handleClient,
    error: error instanceof Error ? error.message : null,
  };
}
