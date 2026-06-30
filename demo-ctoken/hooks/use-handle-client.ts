"use client";

import { useWalletClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { createViemHandleClient, type HandleClient } from "@iexec-nox/handle";

export function useHandleClient() {
  const { data: walletClient } = useWalletClient();

  const { data: handleClient = null, error } = useQuery<HandleClient | null>({
    queryKey: ["handle-client", walletClient?.account?.address, walletClient?.chain?.id],
    queryFn: async () => {
      if (!walletClient) return null;
      return createViemHandleClient(walletClient);
    },
    enabled: !!walletClient,
    staleTime: Infinity,
    retry: false,
  });

  const errorMessage = error
    ? (error instanceof Error ? error.message : String(error))
    : null;

  return { handleClient, error: errorMessage };
}
