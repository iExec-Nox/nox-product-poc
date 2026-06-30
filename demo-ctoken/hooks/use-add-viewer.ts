"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { isAddress } from "viem";
import { confidentialTokenAbi } from "@/lib/confidential-token-abi";
import { buildTxOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import {
  noxComputeAbi,
  NOX_COMPUTE_ADDRESS,
} from "@/lib/nox-compute-abi";
import { TEE_COOLDOWN_MS } from "@/lib/config";
import { pushGtmEvent } from "@/lib/gtm";
import type { TokenConfig } from "@/lib/tokens";
import { ZERO_HANDLE } from "@/lib/contracts";

export type AddViewerStep =
  | "idle"
  | "reading-handle"
  | "granting"
  | "confirmed"
  | "error";

interface UseAddViewerResult {
  step: AddViewerStep;
  error: string | null;
  txEntries: { hash: `0x${string}`; symbol: string }[];
  grant: (
    viewerAddress: string,
    tokens: TokenConfig[],
  ) => Promise<boolean>;
  reset: () => void;
}

export function useAddViewer(): UseAddViewerResult {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, reset: resetWriteContract } = useWriteContract();

  const [step, setStep] = useState<AddViewerStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txEntries, setTxEntries] = useState<{ hash: `0x${string}`; symbol: string }[]>([]);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxEntries([]);
    resetWriteContract();
  }, [resetWriteContract]);

  const grant = useCallback(
    async (viewerAddress: string, tokens: TokenConfig[]) => {
      if (!address) {
        setError("Wallet not connected");
        setStep("error");
        return false;
      }

      if (!publicClient) {
        setError("Public client not available");
        setStep("error");
        return false;
      }

      if (!isAddress(viewerAddress)) {
        setError("Invalid viewer address");
        setStep("error");
        return false;
      }

      const viewer = viewerAddress as `0x${string}`;

      try {
        // Step 1: Read balance handles for each selected token
        setStep("reading-handle");
        setError(null);

        const handleEntries: { token: TokenConfig; handle: `0x${string}` }[] =
          [];

        for (const token of tokens) {
          const cTokenAddress = token.confidentialAddress as
            | `0x${string}`
            | undefined;

          if (!cTokenAddress || cTokenAddress === "0x...") continue;

          const balanceHandle = await publicClient.readContract({
            address: cTokenAddress,
            abi: confidentialTokenAbi,
            functionName: "confidentialBalanceOf",
            args: [address],
          });

          if (balanceHandle && balanceHandle !== ZERO_HANDLE) {
            handleEntries.push({ token, handle: balanceHandle });
          }
        }

        if (handleEntries.length === 0) {
          setError(
            "No confidential balance found for the selected token(s). Wrap tokens first.",
          );
          setStep("error");
          return false;
        }

        // Step 2: Call addViewer for each handle
        setStep("granting");

        const entries: { hash: `0x${string}`; symbol: string }[] = [];

        for (const { token, handle } of handleEntries) {
          const addViewerArgs = [handle, viewer] as const;
          const tx = await writeContractAsync({
            address: NOX_COMPUTE_ADDRESS,
            abi: noxComputeAbi,
            functionName: "addViewer",
            args: addViewerArgs,
            ...(await buildTxOverrides("addViewer", {
              address: NOX_COMPUTE_ADDRESS,
              abi: noxComputeAbi,
              functionName: "addViewer",
              args: addViewerArgs,
              account: address,
            })),
          });

          // Wait for tx to be mined before sending the next one
          await publicClient.waitForTransactionReceipt({ hash: tx });
          entries.push({ hash: tx, symbol: token.symbol });

          // Cooldown — NoxCompute rate-limits rapid successive calls
          await new Promise((r) => setTimeout(r, TEE_COOLDOWN_MS));
        }

        setTxEntries(entries);
        setStep("confirmed");
        pushGtmEvent("cdefi_selectiveDisclosure");
        return true;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return false;
      }
    },
    [address, publicClient, writeContractAsync],
  );

  return { step, error, txEntries, grant, reset };
}
