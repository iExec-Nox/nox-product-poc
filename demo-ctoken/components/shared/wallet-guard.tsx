"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppKitAccount } from "@reown/appkit/react";

export function WalletGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isConnected, status } = useAppKitAccount();

  useEffect(() => {
    if (status === "disconnected") {
      router.replace("/");
    }
  }, [status, router]);

  if (!isConnected) return null;

  return <>{children}</>;
}
