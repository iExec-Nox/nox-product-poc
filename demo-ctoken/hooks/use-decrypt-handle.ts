"use client";

import { useCallback, useState } from "react";
import { formatUnits } from "viem";
import { useHandleClient } from "@/hooks/use-handle-client";

export function useDecryptHandle() {
  const { handleClient } = useHandleClient();
  const [decryptedValues, setDecryptedValues] = useState<
    Record<string, string>
  >({});
  const [decryptingHandle, setDecryptingHandle] = useState<string | null>(null);

  const decrypt = useCallback(
    async (handleId: string, decimals?: number) => {
      if (!handleClient || decryptedValues[handleId]) return;
      setDecryptingHandle(handleId);
      try {
        const result = await handleClient.decrypt(handleId as `0x${string}`);
        const raw = result?.value ?? result;
        const bigintValue =
          typeof raw === "bigint" ? raw : BigInt(String(raw));
        const str =
          decimals != null
            ? formatUnits(bigintValue, decimals)
            : bigintValue.toString();
        setDecryptedValues((prev) => ({ ...prev, [handleId]: str }));
      } catch {
        setDecryptedValues((prev) => ({ ...prev, [handleId]: "Error" }));
      } finally {
        setDecryptingHandle(null);
      }
    },
    [handleClient, decryptedValues],
  );

  return { decryptedValues, decryptingHandle, decrypt };
}
