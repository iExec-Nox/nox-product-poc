"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppKitAccount } from "@reown/appkit/react";

interface UseWalletRedirectOptions {
  onConnect?: string;
  onDisconnect?: string;
}

export function useWalletRedirect({ onConnect, onDisconnect }: UseWalletRedirectOptions) {
  const router = useRouter();
  const { isConnected } = useAppKitAccount();
  const wasConnected = useRef(isConnected);

  useEffect(() => {
    if (isConnected && !wasConnected.current && onConnect) {
      router.push(onConnect);
    }
    if (!isConnected && wasConnected.current && onDisconnect) {
      router.push(onDisconnect);
    }
    wasConnected.current = isConnected;
  }, [isConnected, router, onConnect, onDisconnect]);
}
