"use client";

import { useState, useCallback } from "react";
import { formatUnits } from "viem";
import { useHandleClient } from "@/hooks/use-handle-client";
import { useConfidentialBalances } from "@/hooks/use-confidential-balances";

export function useDecryptBalance() {
  const { handleClient } = useHandleClient();
  const { balances: confidentialBalances } = useConfidentialBalances();
  const [decryptedAmounts, setDecryptedAmounts] = useState<Record<string, string>>({});
  const [decryptingSymbol, setDecryptingSymbol] = useState<string | null>(null);

  const decrypt = useCallback(
    async (symbol: string) => {
      if (!handleClient || decryptingSymbol) return;
      const cBalance = confidentialBalances.find((b) => b.symbol === symbol);
      if (!cBalance || !cBalance.isInitialized) return;

      setDecryptingSymbol(symbol);
      try {
        const { value } = await handleClient.decrypt(cBalance.handle);
        const formatted = formatUnits(
          typeof value === "bigint" ? value : BigInt(String(value)),
          cBalance.decimals,
        );
        setDecryptedAmounts((prev) => ({ ...prev, [symbol]: formatted }));
      } catch {
        // Decrypt failed silently — user can retry
      } finally {
        setDecryptingSymbol(null);
      }
    },
    [handleClient, decryptingSymbol, confidentialBalances],
  );

  const getConfidentialDisplay = useCallback(
    (symbol: string): string | null => {
      const decrypted = decryptedAmounts[symbol];
      if (decrypted !== undefined) return decrypted;
      const cBalance = confidentialBalances.find((b) => b.symbol === symbol);
      if (!cBalance?.isInitialized) return "0";
      return null; // null = encrypted, needs decrypt
    },
    [decryptedAmounts, confidentialBalances],
  );

  return { decryptedAmounts, decryptingSymbol, decrypt, getConfidentialDisplay };
}
