"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTransferModal } from "./transfer-modal-provider";
import { useDevMode } from "@/hooks/use-dev-mode";
import { useConfidentialTransfer } from "@/hooks/use-confidential-transfer";
import { useEstimatedFee } from "@/hooks/use-estimated-fee";
import { useDecryptBalance } from "@/hooks/use-decrypt-balance";
import { useDropdown } from "@/hooks/use-dropdown";
import { ProgressTracker, type ProgressStep } from "@/components/shared/step-indicator";
import { CodeSection } from "@/components/shared/code-section";
import { InfoCard } from "@/components/shared/info-card";
import { ErrorMessage } from "@/components/shared/error-message";
import { TxSuccessStatus } from "@/components/shared/tx-success-status";
import { EncryptedBalance } from "@/components/shared/encrypted-balance";
import { confidentialTokens, wrappableTokens as wrappableTokenConfigs } from "@/lib/tokens";
import { isAddress } from "viem";
import { truncateAddress } from "@/lib/utils";

const TRANSFER_CODE = `function confidentialTransfer(
  address to,
  externalEuint256 encryptedAmount,
  bytes calldata inputProof
) public virtual returns (euint256) {
    // decrypt and verify the user-provided encrypted amount
    return _transfer(msg.sender, to,
      Nox.fromExternal(encryptedAmount, inputProof));
}`;

const TRANSFER_STEPS: ProgressStep[] = [
  { key: "encrypting", icon: "lock", label: "Encrypt" },
  { key: "transferring", icon: "sync", label: "Transfer" },
  { key: "confirmed", icon: "verified", label: "Confirmed" },
];

export function TransferModal() {
  const { open, setOpen } = useTransferModal();
  const { enabled: devMode } = useDevMode();
  const { step, error, txHash, transfer, reset } = useConfidentialTransfer();
  const { fee: estimatedFee } = useEstimatedFee(200_000n);
  const { decryptedAmounts, decryptingSymbol, decrypt: handleDecryptBalance, getConfidentialDisplay } = useDecryptBalance();
  const { open: dropdownOpen, setOpen: setDropdownOpen, triggerRef, contentRef: dropdownRef } = useDropdown();
  // Default to first token with a real deployed address (cRLC), not placeholder cUSDC
  const defaultSymbol = confidentialTokens.find((t) => t.address && t.address.length === 42)?.symbol
    ?? confidentialTokens[0]?.symbol
    ?? "cRLC";
  const [selectedSymbol, setSelectedSymbol] = useState(defaultSymbol);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  const isProcessing = step === "encrypting" || step === "transferring";

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setAmount("");
      setRecipient("");
      setDropdownOpen(false);
      reset();
    }
  }, [open, reset, setDropdownOpen]);

  const handleAmountChange = useCallback((value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  }, []);

  const handleSelectToken = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setAmount("");
    setDropdownOpen(false);
  }, [setDropdownOpen]);

  const handleMax = useCallback(() => {
    const decrypted = decryptedAmounts[selectedSymbol];
    if (decrypted) setAmount(decrypted);
  }, [decryptedAmounts, selectedSymbol]);

  // Find the base token config for the SDK hook
  const baseSymbol = selectedSymbol.replace(/^c/, "");
  const selectedTokenConfig = wrappableTokenConfigs.find(
    (t) => t.symbol === baseSymbol,
  );

  const selectedCToken = confidentialTokens.find((t) => t.symbol === selectedSymbol);

  const handleTransfer = useCallback(async () => {
    if (!selectedTokenConfig || !amount || !recipient) return;
    const success = await transfer(selectedTokenConfig, amount, recipient);
    if (success) {
      setAmount("");
      setRecipient("");
    }
  }, [selectedTokenConfig, amount, recipient, transfer]);

  // Validation
  const parsedAmount = parseFloat(amount) || 0;
  const hasDecryptedBalance = decryptedAmounts[selectedSymbol] !== undefined;
  const maxAmountStr = decryptedAmounts[selectedSymbol] ?? "0";
  const maxAmount = parseFloat(maxAmountStr) || 0;
  const isOverBalance = hasDecryptedBalance && parsedAmount > maxAmount;
  // Require decrypted balance before allowing submission
  const needsDecrypt = !hasDecryptedBalance && parsedAmount > 0;
  const isValidAmount = parsedAmount > 0 && !isOverBalance && !needsDecrypt;
  const addressValid = isAddress(recipient);
  const canTransfer = isValidAmount && addressValid && !isProcessing;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value && isProcessing) return; setOpen(value); }}>
      <DialogContent
        className="max-h-[90vh] max-w-[calc(100%-2rem)] gap-2.5 overflow-y-auto overflow-x-hidden rounded-[32px] border-modal-border bg-modal-bg px-6 py-[26px] shadow-[0px_2px_4px_0px_rgba(116,142,255,0.22)] duration-300 no-scrollbar data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8 motion-reduce:data-[state=open]:slide-in-from-bottom-0 motion-reduce:data-[state=closed]:slide-out-to-bottom-0 md:px-10 sm:max-w-[620px]"
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (isProcessing) e.preventDefault(); }}
        onInteractOutside={(e) => { if (isProcessing) e.preventDefault(); }}
      >
        {/* Content */}
        <div className="flex min-w-0 w-full flex-col items-center gap-[26px]">
          {/* Header + Close */}
          <div className="relative w-full text-center">
            <DialogTitle className="font-mulish text-2xl font-bold leading-10 tracking-[-0.9px] text-text-heading md:text-[36px]">
              Confidential Transfer
            </DialogTitle>
            <DialogDescription className="mt-3 font-mulish text-base leading-6 text-text-body">
              Transactions are encrypted and private by default.
            </DialogDescription>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isProcessing}
              className="absolute top-0 right-0 cursor-pointer font-mulish text-xl text-text-heading transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Close"
            >
              X
            </button>
          </div>

          {/* Glass card */}
          <div className="flex w-full flex-col gap-[26px] rounded-3xl border border-surface-border bg-surface px-5 py-[15px] backdrop-blur-sm">
            {/* Amount section */}
            <div className="flex flex-col gap-4">
              {/* Label + balance */}
              <div className="flex flex-col gap-2 text-xs md:flex-row md:items-center md:justify-between md:gap-0">
                <span className="pl-1 font-inter text-xs font-bold tracking-[1.2px] text-text-muted">
                  Amount
                </span>
                <div className="flex items-center gap-1.5 pl-1 font-mulish">
                  <span className="text-text-body">Balance :</span>
                  <span className="flex items-center gap-1 text-text-heading">
                    <EncryptedBalance
                      symbol={selectedSymbol}
                      display={getConfidentialDisplay(selectedSymbol)}
                      decryptingSymbol={decryptingSymbol}
                      onDecrypt={handleDecryptBalance}
                    />
                  </span>
                </div>
              </div>

              {/* Input area */}
              <div className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface px-4 py-[17px]">
                <div className="flex items-center justify-between">
                {/* Token selector */}
                <div className="relative">
                  <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-token-selector-border bg-token-selector-bg px-3 py-2.5 transition-opacity hover:opacity-80"
                    aria-label="Select token"
                    aria-expanded={dropdownOpen}
                  >
                    {selectedCToken && (
                      <Image
                        src={selectedCToken.icon}
                        alt=""
                        width={24}
                        height={24}
                        className="size-6"
                      />
                    )}
                    <span className="font-mulish text-sm font-bold text-text-heading md:text-base">
                      {selectedSymbol}
                    </span>
                    <span aria-hidden="true" className="material-icons text-[16px]! text-text-body md:text-[18px]!">
                      expand_more
                    </span>
                  </button>

                  {/* Dropdown */}
                  {dropdownOpen && (
                    <div
                      ref={dropdownRef}
                      role="listbox"
                      aria-label="Select token"
                      className="absolute left-0 top-full z-50 mt-1 min-w-[220px] origin-top-left animate-[dropdown-in_150ms_ease-out] motion-reduce:animate-none rounded-xl border border-surface-border bg-modal-bg p-2 shadow-lg"
                    >
                      {confidentialTokens.map((token) => {
                        const confidentialDisplay = getConfidentialDisplay(token.symbol);
                        return (
                          <button
                            key={token.symbol}
                            type="button"
                            onClick={() => handleSelectToken(token.symbol)}
                            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface ${
                              token.symbol === selectedSymbol ? "bg-surface" : ""
                            }`}
                          >
                            <Image
                              src={token.icon}
                              alt=""
                              width={24}
                              height={24}
                              className="size-6"
                            />
                            <span className="font-mulish text-sm font-bold text-text-heading">
                              {token.symbol}
                            </span>
                            <span className="ml-auto flex items-center gap-1.5 font-mulish text-xs text-text-body">
                              <EncryptedBalance
                                symbol={token.symbol}
                                display={confidentialDisplay}
                                decryptingSymbol={decryptingSymbol}
                                onDecrypt={handleDecryptBalance}
                                showSymbol={false}
                                iconSize="text-[14px]!"
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Amount input */}
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className={`ml-6 min-w-0 flex-1 bg-transparent text-right font-mulish text-2xl font-bold leading-8 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary/50 placeholder:text-text-muted/60 ${
                    isOverBalance ? "text-tx-error-text" : "text-text-heading"
                  }`}
                  aria-label="Amount"
                  aria-invalid={isOverBalance || needsDecrypt}
                  aria-describedby={isOverBalance ? "transfer-balance-error" : needsDecrypt ? "transfer-decrypt-hint" : undefined}
                />
                </div>

                {/* Network + MAX */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mulish text-text-muted">Ethereum Sepolia</span>
                  <button
                    type="button"
                    onClick={handleMax}
                    className="cursor-pointer font-mulish font-bold text-primary transition-opacity hover:opacity-80"
                  >
                    MAX
                  </button>
                </div>
              {isOverBalance && (
                <p id="transfer-balance-error" className="pl-1 font-mulish text-xs text-tx-error-text">
                  Insufficient balance
                </p>
              )}
              {needsDecrypt && (
                <p id="transfer-decrypt-hint" className="pl-1 font-mulish text-xs text-decrypt-warning">
                  Decrypt your balance first to continue
                </p>
              )}
              </div>
            </div>

            {/* Recipient address section */}
            <div className="flex flex-col gap-4">
              {/* Label */}
              <span className="pl-1 font-mulish text-xs font-bold tracking-[1.2px] text-text-muted">
                Recipient Address
              </span>

              {/* Address input */}
              <div className="px-2.5 py-3">
                <div className="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface px-[17px] py-[7px]">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent font-mulish text-sm text-text-heading outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary/50 placeholder:text-text-muted"
                    aria-label="Recipient address"
                  />
                  {recipient.length > 0 && (
                    <span
                      aria-label={addressValid ? "Valid address" : "Invalid address"}
                      className={`material-icons text-[24px]! ${
                        addressValid ? "text-tx-success-text" : "text-tx-error-text"
                      }`}
                    >
                      {addressValid ? "check_circle" : "cancel"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction info summary */}
            <div className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-[21px] text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mulish text-text-body">Recipient</span>
                <span className="flex items-center gap-1 font-mulish text-[10px] font-medium text-text-heading md:text-sm">
                  <span aria-hidden="true" className="material-icons text-[12px]! text-primary">
                    enhanced_encryption
                  </span>
                  {recipient && addressValid ? truncateAddress(recipient) : "Encrypted Hash"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mulish text-text-body">Token</span>
                <span className="font-mulish text-[10px] font-medium text-text-heading md:text-sm">
                  {selectedSymbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mulish text-text-body">Network Fee</span>
                <span className="font-mulish text-[10px] font-medium text-text-heading md:text-sm">
                  {estimatedFee ?? "..."} ETH
                </span>
              </div>
            </div>

            {/* Error message */}
            {error && <ErrorMessage error={error} onRetry={reset} />}

            {/* CTA */}
            <div className="flex justify-center">
              <button
                type="button"
                disabled={!canTransfer}
                onClick={handleTransfer}
                className="flex w-[150px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 shadow-[0px_2px_4px_0px_rgba(71,37,244,0.2)] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 md:w-[181px] md:px-[18px] md:py-3"
              >
                {isProcessing ? (
                  <>
                    <span aria-hidden="true" className="material-icons animate-spin motion-reduce:animate-none text-[16px]! text-primary-foreground md:text-[20px]!">
                      sync
                    </span>
                    <span className="font-mulish text-sm font-bold text-primary-foreground md:text-base">
                      {step === "encrypting" ? "Encrypting..." : "Transferring..."}
                    </span>
                  </>
                ) : (
                  <span className="font-mulish text-sm font-bold text-primary-foreground md:text-base">
                    Confirm &amp; Sign
                  </span>
                )}
              </button>
            </div>

            {/* Progress tracker */}
            <ProgressTracker currentStep={step} steps={TRANSFER_STEPS} />

            {/* Etherscan link on success */}
            {step === "confirmed" && txHash && (
              <TxSuccessStatus message="Confidential Transfer Complete" txHash={txHash} />
            )}

            {/* How it works */}
            <InfoCard className="md:p-3!">
              Amounts are encrypted.
              <br />
              The transfer is verified on-chain without revealing values.
            </InfoCard>
          </div>
        </div>

        {/* Function called */}
        {devMode && <CodeSection code={TRANSFER_CODE} />}

        {/* Cancel */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isProcessing}
          className="mt-1 w-full cursor-pointer text-center font-inter text-[15px] font-medium text-text-muted transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}
