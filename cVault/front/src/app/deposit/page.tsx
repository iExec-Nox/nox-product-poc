"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { VAULT_ADDRESS } from "@/config/contracts";

/**
 * Legacy /deposit route — the redesign moved deposit under the vault-scoped URL
 * `/vault/[address]/deposit`. This page keeps old bookmarks working.
 */
export default function LegacyDepositRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/vault/${VAULT_ADDRESS}/deposit`);
  }, [router]);
  return null;
}
