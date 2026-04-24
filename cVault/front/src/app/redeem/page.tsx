"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { VAULT_ADDRESS } from "@/config/contracts";

/**
 * Legacy /redeem route — the redesign moved redeem under the vault-scoped URL
 * `/vault/[address]/redeem`. This page keeps old bookmarks working.
 */
export default function LegacyRedeemRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/vault/${VAULT_ADDRESS}/redeem`);
  }, [router]);
  return null;
}
