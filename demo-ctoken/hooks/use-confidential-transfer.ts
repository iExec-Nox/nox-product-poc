"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits, isAddress } from "viem";
import { confidentialTokenAbi } from "@/lib/confidential-token-abi";
import { buildTxOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useHandleClient } from "@/hooks/use-handle-client";
import { useInvalidateBalances } from "@/hooks/use-invalidate-balances";
import { pushGtmEvent } from "@/lib/gtm";
import type { TokenConfig } from "@/lib/tokens";

export type TransferStep =
  | "idle"
  | "encrypting"
  | "transferring"
  | "confirmed"
  | "error";

interface UseConfidentialTransferResult {
  step: TransferStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  transfer: (token: TokenConfig, amount: string, recipient: string) => Promise<boolean>;
  reset: () => void;
}

export function useConfidentialTransfer(): UseConfidentialTransferResult {
  const { address } = useAccount();
  const { handleClient } = useHandleClient();
  const [step, setStep] = useState<TransferStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, reset: resetWriteContract } = useWriteContract();
  const publicClient = usePublicClient();
  const invalidateBalances = useInvalidateBalances();

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(undefined);
    resetWriteContract();
  }, [resetWriteContract]);

  const transfer = useCallback(
    async (token: TokenConfig, amount: string, recipient: string) => {
      if (!address) {
        setError("Wallet not connected");
        setStep("error");
        return false;
      }

      if (!token.confidentialAddress) {
        setError("Confidential token address not configured");
        setStep("error");
        return false;
      }

      if (!handleClient) {
        setError("Handle client not initialized — please reconnect your wallet");
        setStep("error");
        return false;
      }

      if (!isAddress(recipient)) {
        setError("Invalid recipient address");
        setStep("error");
        return false;
      }

      const parsedAmount = parseUnits(amount, token.decimals);

      if (parsedAmount === 0n) {
        setError("Amount must be greater than zero");
        setStep("error");
        return false;
      }

      const cTokenAddress = token.confidentialAddress as `0x${string}`;
      const recipientAddress = recipient as `0x${string}`;

      try {
        // Step 1: Encrypt the amount via Handle Gateway
        setStep("encrypting");
        setError(null);

        const { handle, handleProof } = await handleClient.encryptInput(
          parsedAmount,
          "uint256",
          cTokenAddress,
        );

        // Step 2: Confidential transfer
        setStep("transferring");

        const transferArgs = [recipientAddress, handle, handleProof] as const;
        const overrides = await buildTxOverrides("transfer", {
          address: cTokenAddress,
          abi: confidentialTokenAbi,
          functionName: "confidentialTransfer",
          args: transferArgs,
          account: address,
        });

        const transferTx = await writeContractAsync({
          address: cTokenAddress,
          abi: confidentialTokenAbi,
          functionName: "confidentialTransfer",
          args: transferArgs,
          ...overrides,
        });

        setTxHash(transferTx);

        // Wait for transfer tx to be mined before marking confirmed
        await publicClient!.waitForTransactionReceipt({ hash: transferTx });

        setStep("confirmed");
        pushGtmEvent("cdefi_transfer");
        invalidateBalances();
        return true;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return false;
      }
    },
    [address, handleClient, writeContractAsync, publicClient, invalidateBalances],
  );

  return { step, error, txHash, transfer, reset };
}
