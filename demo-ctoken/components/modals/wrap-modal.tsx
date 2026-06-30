"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useWrapModal } from "./wrap-modal-provider";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { useDevMode } from "@/hooks/use-dev-mode";
import { useWrap } from "@/hooks/use-wrap";
import { useUnwrap } from "@/hooks/use-unwrap";
import { wrappableTokens as wrappableTokenConfigs } from "@/lib/tokens";
import { TxSuccessStatus } from "@/components/shared/tx-success-status";
import { useEstimatedFee } from "@/hooks/use-estimated-fee";
import { useDecryptBalance } from "@/hooks/use-decrypt-balance";
import { useDropdown } from "@/hooks/use-dropdown";
import { ProgressTracker, type ProgressStep } from "@/components/shared/step-indicator";
import { CodeSection } from "@/components/shared/code-section";
import { InfoCard } from "@/components/shared/info-card";
import { ErrorMessage } from "@/components/shared/error-message";
import { EncryptedBalance } from "@/components/shared/encrypted-balance";

const WRAP_CODE = `function wrap(address to, uint256 amount) public virtual override returns (euint256) {
    // take ownership of the underlying tokens
    SafeERC20.safeTransferFrom(IERC20(underlying()), msg.sender, address(this), amount - (amount % rate()));

    // mint confidential tokens to recipient
    euint256 wrappedAmountSent = _mint(to, Nox.toEuint256(amount / rate()));
    Nox.allowTransient(wrappedAmountSent, msg.sender);
    return wrappedAmountSent;
}`;

const UNWRAP_CODE = `// Step 1: Initiate unwrap with encrypted amount
function unwrap(
    address from, address to,
    bytes32 encryptedAmount, bytes inputProof
) external;

// Step 2: Finalize unwrap — contract decrypts the amount on-chain
function finalizeUnwrap(
    euint256 unwrapAmount,
    bytes decryptionProof
) external;`;

const WRAP_STEPS: ProgressStep[] = [
  { key: "approving", icon: "check_circle", label: "Approve" },
  { key: "wrapping", icon: "sync", label: "Wrap" },
  { key: "confirmed", icon: "verified", label: "Confirmed" },
];

const UNWRAP_STEPS: ProgressStep[] = [
  { key: "encrypting", icon: "lock", label: "Encrypt" },
  { key: "unwrapping", icon: "sync", label: "Unwrap" },
  { key: "finalizing", icon: "check_circle", label: "Finalize" },
  { key: "confirmed", icon: "verified", label: "Confirmed" },
];

export function WrapModal() {
  const { open, setOpen, activeTab, setActiveTab } = useWrapModal();
  const { balances } = useTokenBalances();
  const { enabled: devMode } = useDevMode();
  const { step: wrapStep, error: wrapError, wrapTxHash, wrap, reset: resetWrap } = useWrap();
  const { step: unwrapStep, error: unwrapError, isFinalizeError, finalizeTxHash, unwrap, retryFinalize, reset: resetUnwrap } = useUnwrap();
  const { decryptedAmounts, decryptingSymbol, decrypt: handleDecryptBalance, getConfidentialDisplay } = useDecryptBalance();
  const { open: dropdownOpen, setOpen: setDropdownOpen, triggerRef, contentRef: dropdownRef } = useDropdown();
  const [selectedSymbol, setSelectedSymbol] = useState("RLC");
  const cSelectedSymbol = `c${selectedSymbol}`;
  const [amount, setAmount] = useState("");
  const isWrap = activeTab === "wrap";
  // Gas limits: wrap (approve + wrap) ~150k, unwrap (encrypt + unwrap + finalize) ~300k
  const { fee: estimatedFee } = useEstimatedFee(isWrap ? 150_000n : 300_000n);
  const isWrapProcessing = wrapStep === "approving" || wrapStep === "wrapping";
  const isUnwrapProcessing = unwrapStep === "encrypting" || unwrapStep === "unwrapping" || unwrapStep === "finalizing";
  const isProcessing = isWrap ? isWrapProcessing : isUnwrapProcessing;
  const currentError = isWrap ? wrapError : unwrapError;

  // Map wrappable tokens with balances
  const wrappableTokens = useMemo(() => wrappableTokenConfigs.map((t) => {
    const bal = balances.find((b) => b.symbol === t.symbol);
    return {
      symbol: t.symbol,
      icon: t.icon,
      decimals: t.decimals,
      balance: bal?.balance ?? 0n,
      formatted: bal?.formatted ?? "0",
    };
  }), [balances]);

  const selectedToken = wrappableTokens.find((t) => t.symbol === selectedSymbol) ?? wrappableTokens[0];

  // Reset amount and state when modal opens or tab changes
  useEffect(() => {
    if (open) {
      setAmount("");
      setDropdownOpen(false);
      resetWrap();
      resetUnwrap();
    }
  }, [open, activeTab, resetWrap, resetUnwrap, setDropdownOpen]);

  const handleAmountChange = useCallback(
    (value: string) => {
      // Allow empty, or valid decimal numbers
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setAmount(value);
      }
    },
    []
  );

  const handleMax = useCallback(() => {
    if (isWrap) {
      if (selectedToken) setAmount(selectedToken.formatted);
    } else {
      const decrypted = decryptedAmounts[cSelectedSymbol];
      if (decrypted) setAmount(decrypted);
    }
  }, [isWrap, selectedToken, decryptedAmounts, cSelectedSymbol]);

  const handleSelectToken = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setAmount("");
    setDropdownOpen(false);
  }, [setDropdownOpen]);

  // Find the original token config for the wrap hook
  const selectedTokenConfig = wrappableTokenConfigs.find(
    (t) => t.symbol === selectedSymbol
  );

  const handleWrap = useCallback(async () => {
    if (!selectedTokenConfig || !amount) return;
    const success = await wrap(selectedTokenConfig, amount);
    if (success) setAmount("");
  }, [selectedTokenConfig, amount, wrap]);

  const handleUnwrap = useCallback(async () => {
    if (!selectedTokenConfig || !amount) return;
    const success = await unwrap(selectedTokenConfig, amount);
    if (success) setAmount("");
  }, [selectedTokenConfig, amount, unwrap]);

  // Validation
  const parsedAmount = parseFloat(amount) || 0;
  const hasDecryptedBalance = !isWrap && decryptedAmounts[cSelectedSymbol] !== undefined;
  const maxAmountStr = isWrap
    ? (selectedToken?.formatted ?? "0")
    : (decryptedAmounts[cSelectedSymbol] ?? "0");
  const maxAmount = parseFloat(maxAmountStr) || 0;
  // Only check over-balance if we know the balance (wrap always, unwrap only if decrypted)
  const isOverBalance = (isWrap || hasDecryptedBalance) && parsedAmount > maxAmount;
  // For unwrap: require decrypted balance before allowing submission
  const needsDecrypt = !isWrap && !hasDecryptedBalance && parsedAmount > 0;
  const isValidAmount = parsedAmount > 0 && !isOverBalance && !needsDecrypt;

  const cTokenSymbol = `c${selectedToken?.symbol ?? "USDC"}`;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value && isProcessing) return; setOpen(value); }}>
      <DialogContent
        className="max-h-[90vh] max-w-[calc(100%-2rem)] gap-2.5 overflow-y-auto overflow-x-hidden rounded-[40px] border-modal-border bg-modal-bg px-6 py-[26px] shadow-[0px_2px_4px_0px_rgba(116,142,255,0.22)] duration-300 no-scrollbar data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8 motion-reduce:data-[state=open]:slide-in-from-bottom-0 motion-reduce:data-[state=closed]:slide-out-to-bottom-0 md:px-10 sm:max-w-[620px]"
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (isProcessing) e.preventDefault(); }}
        onInteractOutside={(e) => { if (isProcessing) e.preventDefault(); }}
      >
        {/* Content */}
        <div className="flex min-w-0 w-full flex-col items-center gap-[26px]">
          {/* Header + Close */}
          <div className="relative w-full text-center">
            <DialogTitle className="font-mulish text-[26px] font-bold leading-10 text-text-heading md:text-[34px]">
              Convert Assets
            </DialogTitle>
            <DialogDescription className="mt-2 font-mulish text-sm leading-6 text-text-body md:text-base">
              {isWrap ? "Make your assets confidential" : "Return your assets to public"}
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
          <div className="flex w-full flex-col gap-[26px] rounded-[32px] border border-surface-border bg-surface p-5 backdrop-blur-sm md:px-10 md:py-5">
            {/* Tabs */}
            <div className="flex items-start justify-between">
              <button
                type="button"
                onClick={() => setActiveTab("wrap")}
                disabled={isProcessing}
                className={`flex w-[48%] cursor-pointer items-center justify-center rounded-2xl py-3.5 font-mulish text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isWrap
                    ? "border border-surface-border bg-surface text-text-heading"
                    : "text-text-muted hover:text-text-body"
                }`}
              >
                Wrap
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unwrap")}
                disabled={isProcessing}
                className={`flex w-[48%] cursor-pointer items-center justify-center rounded-2xl py-3.5 font-mulish text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  !isWrap
                    ? "border border-surface-border bg-surface text-text-heading"
                    : "text-text-muted hover:text-text-body"
                }`}
              >
                Unwrap
              </button>
            </div>

            {/* Amount label + balance */}
            <div className="flex flex-col gap-2 text-xs md:flex-row md:items-center md:justify-between md:gap-0">
              <span className="font-mulish font-bold tracking-[1.2px] text-text-muted">
                {isWrap ? "Amount to Wrap" : "Amount to Unwrap"}
              </span>
              <div className="flex items-center gap-1.5 font-mulish">
                <span className="text-text-body">
                  {isWrap ? "Public Asset :" : "Confidential Asset :"}
                </span>
                {isWrap ? (
                  <span className="text-text-heading">
                    {selectedToken ? `${selectedToken.formatted} ${selectedToken.symbol}` : "0"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-text-heading">
                    <EncryptedBalance
                      symbol={cSelectedSymbol}
                      display={getConfidentialDisplay(cSelectedSymbol)}
                      decryptingSymbol={decryptingSymbol}
                      onDecrypt={handleDecryptBalance}
                    />
                  </span>
                )}
              </div>
            </div>

            {/* Input area */}
            <div className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface px-5 py-[17px]">
              <div className="flex items-center justify-between">
                {/* Token selector */}
                <div className="relative">
                  <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-token-selector-border bg-token-selector-bg px-3 py-1.5 transition-opacity hover:opacity-80"
                    aria-label="Select token"
                    aria-expanded={dropdownOpen}
                  >
                    {selectedToken && (
                      <Image
                        src={selectedToken.icon}
                        alt=""
                        width={20}
                        height={20}
                        className="size-5"
                      />
                    )}
                    <span className="font-mulish text-sm font-bold text-text-heading">
                      {isWrap ? selectedToken?.symbol : cTokenSymbol}
                    </span>
                    <span aria-hidden="true" className="material-icons text-[14px]! text-text-body">
                      expand_more
                    </span>
                  </button>

                  {/* Dropdown */}
                  {dropdownOpen && (
                    <div
                      ref={dropdownRef}
                      role="listbox"
                      aria-label="Select token"
                      className={`absolute left-0 top-full z-50 mt-1 origin-top-left animate-[dropdown-in_150ms_ease-out] motion-reduce:animate-none rounded-xl border border-surface-border bg-modal-bg p-2 shadow-lg ${
                        isWrap ? "min-w-[160px]" : "min-w-[220px]"
                      }`}
                    >
                      {wrappableTokens.map((token) => {
                        const cSymbol = `c${token.symbol}`;
                        const confidentialDisplay = getConfidentialDisplay(cSymbol);
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
                              width={20}
                              height={20}
                              className="size-5"
                            />
                            <span className="font-mulish text-sm font-bold text-text-heading">
                              {isWrap ? token.symbol : cSymbol}
                            </span>
                            {isWrap ? (
                              <span className="ml-auto font-mulish text-xs text-text-body">
                                {token.formatted}
                              </span>
                            ) : (
                              <span className="ml-auto flex items-center gap-1.5 font-mulish text-xs text-text-body">
                                <EncryptedBalance
                                  symbol={cSymbol}
                                  display={confidentialDisplay}
                                  decryptingSymbol={decryptingSymbol}
                                  onDecrypt={handleDecryptBalance}
                                  showSymbol={false}
                                  iconSize="text-[14px]!"
                                />
                              </span>
                            )}
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
                  className={`ml-6 min-w-0 flex-1 bg-transparent text-right font-mulish text-2xl font-bold leading-9 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:rounded placeholder:text-text-muted md:text-[30px] ${
                    isOverBalance ? "text-tx-error-text" : "text-text-heading"
                  }`}
                  aria-label="Amount"
                  aria-invalid={isOverBalance || needsDecrypt}
                  aria-describedby={isOverBalance ? "wrap-balance-error" : needsDecrypt ? "wrap-decrypt-hint" : undefined}
                />
              </div>
              {isOverBalance && (
                <p id="wrap-balance-error" className="pl-1 font-mulish text-xs text-tx-error-text">
                  Insufficient balance
                </p>
              )}
              {needsDecrypt && (
                <p id="wrap-decrypt-hint" className="pl-1 font-mulish text-xs text-decrypt-warning">
                  Decrypt your balance first to continue
                </p>
              )}

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
            </div>

            {/* Transaction details */}
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mulish text-text-muted">You will receive</span>
                <span className="font-mulish font-medium text-text-heading">
                  {isWrap ? `1:1 ${cTokenSymbol}` : `1:1 ${selectedToken?.symbol}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mulish text-text-muted">Estimated Gas Fee</span>
                <span className="font-mulish text-text-body">{estimatedFee ?? "..."} ETH</span>
              </div>
            </div>

            {/* Error message */}
            {currentError && !isFinalizeError && (
              <ErrorMessage error={currentError} onRetry={isWrap ? resetWrap : resetUnwrap} />
            )}
            {currentError && isFinalizeError && (
              <div className="flex flex-col gap-2 rounded-xl border border-tx-error-text/30 bg-tx-error-bg px-4 py-3">
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="material-icons text-[18px]! text-tx-error-text">
                    warning
                  </span>
                  <p className="min-w-0 flex-1 font-mulish text-xs text-tx-error-text">
                    Your tokens have been unwrapped but the finalization failed. Your tokens are in transit — click below to retry and recover them.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryFinalize}
                  className="cursor-pointer self-end rounded-lg bg-tx-error-text px-4 py-1.5 font-mulish text-xs font-bold text-primary-foreground transition-opacity hover:opacity-80"
                >
                  Retry Finalize
                </button>
              </div>
            )}

            {/* CTA */}
            <button
              type="button"
              disabled={!isValidAmount || isProcessing}
              onClick={isWrap ? handleWrap : handleUnwrap}
              className="mx-auto flex w-[150px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 shadow-[0px_2px_4px_0px_rgba(71,37,244,0.2)] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 md:w-[215px] md:px-5 md:py-3"
            >
              {isProcessing ? (
                <>
                  <span aria-hidden="true" className="material-icons animate-spin motion-reduce:animate-none text-[16px]! text-primary-foreground md:text-[20px]!">
                    sync
                  </span>
                  <span className="font-mulish text-sm font-bold text-primary-foreground md:text-lg">
                    {isWrap
                      ? (wrapStep === "approving" ? "Approving..." : "Wrapping...")
                      : (unwrapStep === "encrypting" ? "Encrypting..." : unwrapStep === "unwrapping" ? "Unwrapping..." : "Finalizing...")}
                  </span>
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="material-icons text-[16px]! text-primary-foreground md:text-[20px]!">
                    account_balance_wallet
                  </span>
                  <span className="font-mulish text-sm font-bold text-primary-foreground md:text-lg">
                    {isWrap ? "Wrap Assets" : "Unwrap Assets"}
                  </span>
                </>
              )}
            </button>

            {/* Progress tracker */}
            <ProgressTracker
              currentStep={isWrap ? wrapStep : unwrapStep}
              steps={isWrap ? WRAP_STEPS : UNWRAP_STEPS}
            />

            {/* Success status on confirmed */}
            {isWrap && wrapStep === "confirmed" && wrapTxHash && (
              <TxSuccessStatus message="Wrap Complete" txHash={wrapTxHash} />
            )}
            {!isWrap && unwrapStep === "confirmed" && finalizeTxHash && (
              <TxSuccessStatus message="Unwrap Complete" txHash={finalizeTxHash} />
            )}

            {/* How it works */}
            <InfoCard>
              {isWrap
                ? "Wrapping moves your tokens from the public Ethereum ledger into Confidential Token's private vault. Once wrapped, your balance and transfers are only visible to you."
                : "Unwrapping moves your confidential tokens back to the public Ethereum ledger. Once unwrapped, your balance and transfers are visible on-chain."}
            </InfoCard>
          </div>

          {/* Function called */}
          {devMode && (
            <CodeSection code={isWrap ? WRAP_CODE : UNWRAP_CODE} />
          )}
        </div>

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
