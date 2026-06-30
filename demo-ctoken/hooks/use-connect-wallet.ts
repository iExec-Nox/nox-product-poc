"use client";

import { useAppKit } from "@reown/appkit/react";

export function useConnectWallet() {
  const { open } = useAppKit();

  return { connect: () => open() };
}
