"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import { confidentialTokenAbi } from "@/lib/confidential-token-abi";
import { buildTxOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useInvalidateBalances } from "@/hooks/use-invalidate-balances";
import { TEE_COOLDOWN_MS } from "@/lib/config";
import { pushGtmEvent } from "@/lib/gtm";
import type { TokenConfig } from "@/lib/tokens";

export type WrapStep = "idle" | "approving" | "wrapping" | "confirmed" | "error";

interface UseWrapResult {
  step: WrapStep;
  error: string | null;
  approveTxHash: `0x${string}` | undefined;
  wrapTxHash: `0x${string}` | undefined;
  wrap: (token: TokenConfig, amount: string) => Promise<boolean>;
  reset: () => void;
}

export function useWrap(): UseWrapResult {
  const { address } = useAccount();
  const [step, setStep] = useState<WrapStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [wrapTxHash, setWrapTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, reset: resetWriteContract } = useWriteContract();
  const publicClient = usePublicClient();
  const invalidateBalances = useInvalidateBalances();

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setApproveTxHash(undefined);
    setWrapTxHash(undefined);
    resetWriteContract();
  }, [resetWriteContract]);

  const wrap = useCallback(
    async (token: TokenConfig, amount: string) => {
      if (!address) {
        setError("Wallet not connected");
        setStep("error");
        return false;
      }

      if (!token.address || !token.confidentialAddress) {
        setError("Token addresses not configured");
        setStep("error");
        return false;
      }

      const parsedAmount = parseUnits(amount, token.decimals);

      if (parsedAmount === 0n) {
        setError("Amount must be greater than zero");
        setStep("error");
        return false;
      }

      const erc20Address = token.address as `0x${string}`;
      const cTokenAddress = token.confidentialAddress as `0x${string}`;

      try {
        // Step 1: Approve exact amount on ERC-20
        setStep("approving");
        setError(null);

        const approveArgs = [cTokenAddress, parsedAmount] as const;
        const approveTx = await writeContractAsync({
          address: erc20Address,
          abi: erc20Abi,
          functionName: "approve",
          args: approveArgs,
          ...(await buildTxOverrides("approve", {
            address: erc20Address,
            abi: erc20Abi,
            functionName: "approve",
            args: approveArgs,
            account: address,
          })),
        });

        setApproveTxHash(approveTx);
        // TODO(debug): remove once wrap is validated
        console.log("[nox:wrap] approve tx submitted", approveTx);

        // Wait for approve to be mined before calling wrap — the on-chain
        // allowance must be effective for the wrap to succeed
        const approveReceipt = await publicClient!.waitForTransactionReceipt({ hash: approveTx });
        // TODO(debug): remove once wrap is validated
        console.log("[nox:wrap] approve receipt", {
          status: approveReceipt.status,
          gasUsed: approveReceipt.gasUsed?.toString(),
        });

        // Small cooldown — NoxCompute rate-limits rapid successive calls
        await new Promise((r) => setTimeout(r, TEE_COOLDOWN_MS));

        // Step 2: Wrap on cToken contract (re-estimate gas fresh)
        setStep("wrapping");

        const wrapArgs = [address, parsedAmount] as const;
        const wrapTx = await writeContractAsync({
          address: cTokenAddress,
          abi: confidentialTokenAbi,
          functionName: "wrap",
          args: wrapArgs,
          ...(await buildTxOverrides("wrap", {
            address: cTokenAddress,
            abi: confidentialTokenAbi,
            functionName: "wrap",
            args: wrapArgs,
            account: address,
          })),
        });

        setWrapTxHash(wrapTx);
        // TODO(debug): remove once wrap is validated
        console.log("[nox:wrap] wrap tx submitted", wrapTx);

        // Wait for wrap tx to be mined before marking confirmed
        const wrapReceipt = await publicClient!.waitForTransactionReceipt({ hash: wrapTx });
        // TODO(debug): remove once wrap is validated
        console.log("[nox:wrap] wrap receipt", {
          status: wrapReceipt.status,
          gasUsed: wrapReceipt.gasUsed?.toString(),
          logCount: wrapReceipt.logs.length,
        });

        if (wrapReceipt.status === "reverted") {
          throw new Error(
            "Wrap transaction reverted on-chain. Check the [nox:wrap] logs and Etherscan for the revert reason.",
          );
        }

        setStep("confirmed");
        pushGtmEvent("cdefi_wrap");
        invalidateBalances();
        return true;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return false;
      }
    },
    [address, writeContractAsync, publicClient, invalidateBalances],
  );

  return { step, error, approveTxHash, wrapTxHash, wrap, reset };
}
