"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits, decodeEventLog } from "viem";
import { confidentialTokenAbi } from "@/lib/confidential-token-abi";
import { buildTxOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useHandleClient } from "@/hooks/use-handle-client";
import { useInvalidateBalances } from "@/hooks/use-invalidate-balances";
import { TEE_COOLDOWN_MS } from "@/lib/config";
import { pushGtmEvent } from "@/lib/gtm";
import type { TokenConfig } from "@/lib/tokens";

export type UnwrapStep =
  | "idle"
  | "encrypting"
  | "unwrapping"
  | "finalizing"
  | "confirmed"
  | "error";

interface UseUnwrapResult {
  step: UnwrapStep;
  error: string | null;
  /** True when finalizeUnwrap failed — tokens are in transit */
  isFinalizeError: boolean;
  unwrapTxHash: `0x${string}` | undefined;
  finalizeTxHash: `0x${string}` | undefined;
  unwrap: (token: TokenConfig, amount: string) => Promise<boolean>;
  retryFinalize: () => Promise<void>;
  reset: () => void;
}

export function useUnwrap(): UseUnwrapResult {
  const { address } = useAccount();
  const { handleClient } = useHandleClient();
  const [step, setStep] = useState<UnwrapStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isFinalizeError, setIsFinalizeError] = useState(false);
  const [unwrapTxHash, setUnwrapTxHash] = useState<`0x${string}` | undefined>();
  const [finalizeTxHash, setFinalizeTxHash] = useState<
    `0x${string}` | undefined
  >();

  // Store finalize params so retryFinalize can re-use them
  const finalizeParamsRef = useRef<{
    cTokenAddress: `0x${string}`;
    handle: `0x${string}`;
  } | null>(null);

  const { writeContractAsync, reset: resetWriteContract } = useWriteContract();
  const publicClient = usePublicClient();
  const invalidateBalances = useInvalidateBalances();

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setIsFinalizeError(false);
    setUnwrapTxHash(undefined);
    setFinalizeTxHash(undefined);
    finalizeParamsRef.current = null;
  }, []);

  const executeFinalize = useCallback(
    async (
      cTokenAddress: `0x${string}`,
      handle: `0x${string}`,
    ) => {
      if (!handleClient) {
        throw new Error("Handle client not initialized");
      }
      if (!address) {
        throw new Error("Wallet not connected");
      }

      setStep("finalizing");
      setError(null);
      setIsFinalizeError(false);

      // Decrypt the unwrap handle publicly to get the proof
      // The contract computes cleartextAmount internally via Nox.publicDecrypt()
      // Retry silently up to 5 times with 2s between each — TEE needs time to make the handle publicly decryptable
      const MAX_RETRIES = 5;
      let decryptionProof: `0x${string}` | undefined;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await Promise.race([
            handleClient.publicDecrypt(handle),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("publicDecrypt timeout")), 15_000)
            ),
          ]);
          decryptionProof = result.decryptionProof;
          break;
        } catch (err) {
          if (attempt === MAX_RETRIES) {
            throw new Error("Unable to decrypt unwrap handle after multiple attempts — the TEE may be congested. Please retry later.");
          }
          await new Promise((r) => setTimeout(r, TEE_COOLDOWN_MS));
        }
      }

      if (!decryptionProof) {
        throw new Error("Decryption proof not available");
      }

      const finalizeArgs = [handle, decryptionProof] as const;
      const overrides = await buildTxOverrides("finalizeUnwrap", {
        address: cTokenAddress,
        abi: confidentialTokenAbi,
        functionName: "finalizeUnwrap",
        args: finalizeArgs,
        account: address,
      });

      const finalizeTx = await writeContractAsync({
        address: cTokenAddress,
        abi: confidentialTokenAbi,
        functionName: "finalizeUnwrap",
        args: finalizeArgs,
        ...overrides,
      });

      setFinalizeTxHash(finalizeTx);
      setStep("confirmed");
      pushGtmEvent("cdefi_unwrap");
      invalidateBalances();
      finalizeParamsRef.current = null;
    },
    [address, handleClient, writeContractAsync, invalidateBalances],
  );

  const retryFinalize = useCallback(async () => {
    const params = finalizeParamsRef.current;
    if (!params) {
      setError("No pending finalization to retry");
      return;
    }

    try {
      // Reset wagmi's internal mutation state so writeContractAsync can be called again
      resetWriteContract();

      // Small cooldown before retry to avoid NoxCompute rate-limiting
      await new Promise((r) => setTimeout(r, TEE_COOLDOWN_MS));

      await executeFinalize(params.cTokenAddress, params.handle);
    } catch (err) {
      setError(formatTransactionError(err));
      setStep("error");
      setIsFinalizeError(true);
    }
  }, [executeFinalize, resetWriteContract]);

  const unwrap = useCallback(
    async (token: TokenConfig, amount: string) => {
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

      const parsedAmount = parseUnits(amount, token.decimals);
      const cTokenAddress = token.confidentialAddress as `0x${string}`;

      try {
        // Step 1: Encrypt the amount via Handle Gateway
        setStep("encrypting");
        setError(null);
        setIsFinalizeError(false);

        const { handle, handleProof } = await handleClient.encryptInput(
          parsedAmount,
          "uint256",
          cTokenAddress,
        );

        // Step 2: Initiate unwrap (from and to = msg.sender)
        setStep("unwrapping");

        const unwrapArgs = [address, address, handle, handleProof] as const;
        const overrides = await buildTxOverrides("unwrap", {
          address: cTokenAddress,
          abi: confidentialTokenAbi,
          functionName: "unwrap",
          args: unwrapArgs,
          account: address,
        });

        const unwrapTx = await writeContractAsync({
          address: cTokenAddress,
          abi: confidentialTokenAbi,
          functionName: "unwrap",
          args: unwrapArgs,
          ...overrides,
        });

        // TODO(debug): remove once unwrap is validated
        console.log("[nox:unwrap] tx submitted", unwrapTx, { cTokenAddress, handle, handleProof });

        setUnwrapTxHash(unwrapTx);

        // Step 2b: Extract the contract-generated handle from UnwrapRequested event.
        // The contract creates a NEW handle via _burn() — it is NOT the encryptInput handle.
        // See ERC7984ERC20Wrapper._unwrap(): `euint256 unwrapAmount = _burn(from, amount)`
        if (!publicClient) {
          throw new Error("Public client not available");
        }

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: unwrapTx,
        });

        // TODO(debug): remove once unwrap is validated
        console.log("[nox:unwrap] receipt", {
          status: receipt.status,
          gasUsed: receipt.gasUsed?.toString(),
          gasLimit: overrides.gas.toString(),
          logCount: receipt.logs.length,
        });
        receipt.logs.forEach((log, i) => {
          console.log(`[nox:unwrap] log[${i}]`, {
            address: log.address,
            isCToken: log.address.toLowerCase() === cTokenAddress.toLowerCase(),
            topic0: log.topics[0],
            topics: log.topics,
            data: log.data,
          });
        });

        if (receipt.status === "reverted") {
          throw new Error(
            "Unwrap transaction reverted on-chain. Check the [nox:unwrap] logs and Etherscan for the revert reason.",
          );
        }

        // Decode the UnwrapRequested event to get the contract's handle
        let finalizeHandle: `0x${string}` | null = null;

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== cTokenAddress.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({
              abi: confidentialTokenAbi,
              data: log.data,
              topics: log.topics,
            });
            // TODO(debug): remove once unwrap is validated
            console.log("[nox:unwrap] decoded event", decoded.eventName, decoded.args);
            if (decoded.eventName === "UnwrapRequested") {
              finalizeHandle = (decoded.args as { amount: `0x${string}` }).amount;
              break;
            }
          } catch {
            // Not this event, skip
          }
        }

        if (!finalizeHandle) {
          throw new Error(
            "Could not find UnwrapRequested event in transaction logs — unwrap may have failed silently"
          );
        }

        // Store finalize params in case it fails and needs retry
        finalizeParamsRef.current = { cTokenAddress, handle: finalizeHandle };

        // Cooldown — NoxCompute rate-limits rapid successive calls
        await new Promise((r) => setTimeout(r, TEE_COOLDOWN_MS));

        // Step 3: Finalize unwrap (publicDecrypt + on-chain finalize)
        await executeFinalize(cTokenAddress, finalizeHandle);
        return true;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        // If unwrap tx was sent but finalize failed, flag it
        setIsFinalizeError(finalizeParamsRef.current !== null);
        return false;
      }
    },
    [address, handleClient, writeContractAsync, publicClient, executeFinalize],
  );

  return {
    step,
    error,
    isFinalizeError,
    unwrapTxHash,
    finalizeTxHash,
    unwrap,
    retryFinalize,
    reset,
  };
}
