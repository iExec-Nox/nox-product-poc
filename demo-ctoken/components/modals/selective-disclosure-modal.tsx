"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSelectiveDisclosureModal } from "./selective-disclosure-modal-provider";
import { useDevMode } from "@/hooks/use-dev-mode";
import { confidentialTokens } from "@/lib/tokens";
import { useAddViewer } from "@/hooks/use-add-viewer";
import { NOX_COMPUTE_ADDRESS } from "@/lib/nox-compute-abi";
import { isAddress } from "viem";
import { ProgressTracker, type ProgressStep } from "@/components/shared/step-indicator";
import { CodeSection } from "@/components/shared/code-section";
import { InfoCard } from "@/components/shared/info-card";
import { TxSuccessStatus } from "@/components/shared/tx-success-status";
import { ErrorMessage } from "@/components/shared/error-message";

type ScopeType = "full" | "specific";

const ADD_VIEWER_CODE = `// 1. Read the balance handle
const handle = await publicClient.readContract({
  address: cTokenAddress,
  abi: confidentialTokenAbi,
  functionName: 'confidentialBalanceOf',
  args: [userAddress],
});

// 2. Grant viewer access on NoxCompute
await walletClient.writeContract({
  address: '${NOX_COMPUTE_ADDRESS}',
  abi: noxComputeAbi,
  functionName: 'addViewer',
  args: [handle, viewerAddress],
});`;

const DISCLOSURE_STEPS: ProgressStep[] = [
  { key: "reading-handle", icon: "search", label: "Read Handle" },
  { key: "granting", icon: "sync", label: "Grant Access" },
  { key: "confirmed", icon: "verified", label: "Confirmed" },
];

export function SelectiveDisclosureModal() {
  const { open, setOpen } = useSelectiveDisclosureModal();
  const { enabled: devMode } = useDevMode();
  const { step, error, txEntries, grant, reset } = useAddViewer();

  const [viewerAddress, setViewerAddress] = useState("");
  const [scope, setScope] = useState<ScopeType>("specific");
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(
    new Set(),
  );

  const isProcessing = step === "reading-handle" || step === "granting";

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value && isProcessing) return;
      if (!value) {
        setViewerAddress("");
        setScope("specific");
        setSelectedTokens(new Set());
        reset();
      }
      setOpen(value);
    },
    [setOpen, reset, isProcessing],
  );

  const handleScopeChange = useCallback((newScope: ScopeType) => {
    setScope(newScope);
    if (newScope === "full") {
      setSelectedTokens(new Set(confidentialTokens.map((t) => t.symbol)));
    } else {
      setSelectedTokens(new Set());
    }
  }, []);

  const toggleToken = useCallback(
    (symbol: string) => {
      if (scope === "full") return;
      setSelectedTokens((prev) => {
        const next = new Set(prev);
        if (next.has(symbol)) {
          next.delete(symbol);
        } else {
          next.add(symbol);
        }
        return next;
      });
    },
    [scope],
  );

  const handleGrant = useCallback(async () => {
    const tokensToGrant = confidentialTokens.filter((t) =>
      selectedTokens.has(t.symbol),
    );
    const success = await grant(viewerAddress, tokensToGrant);
    if (success) {
      setViewerAddress("");
      setSelectedTokens(new Set());
    }
  }, [viewerAddress, selectedTokens, grant]);

  const isValidAddress = isAddress(viewerAddress);
  const hasTokenSelected = selectedTokens.size > 0;
  const canGrant = isValidAddress && hasTokenSelected && !isProcessing;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-[calc(100%-2rem)] gap-[18px] overflow-y-auto overflow-x-hidden rounded-[32px] border-modal-border bg-modal-bg px-6 py-[34px] shadow-[0px_2px_4px_0px_rgba(116,142,255,0.22)] duration-300 no-scrollbar data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8 motion-reduce:data-[state=open]:slide-in-from-bottom-0 motion-reduce:data-[state=closed]:slide-out-to-bottom-0 sm:max-w-[850px]"
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (isProcessing) e.preventDefault(); }}
        onInteractOutside={(e) => { if (isProcessing) e.preventDefault(); }}
      >
        {/* Header + Close */}
        <div className="relative w-full text-center">
          <DialogTitle className="font-mulish text-[32px] font-bold leading-10 tracking-[-0.9px] text-text-heading md:text-[36px]">
            Selective Disclosure
          </DialogTitle>
          <DialogDescription className="mt-4 font-mulish text-lg leading-[29.25px] text-text-body">
            Grant third parties the ability to audit your confidential
            transactions without giving up control of your assets.
          </DialogDescription>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
            className="absolute top-0 right-0 cursor-pointer font-mulish text-xl text-text-heading transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Close"
          >
            X
          </button>
        </div>

        {/* Add a New Viewer — glass card */}
        <div className="flex w-full flex-col gap-5 rounded-3xl border border-surface-border bg-surface p-5 backdrop-blur-sm md:gap-[35px]">
          <div className="flex items-center justify-between">
            <h3 className="font-mulish text-xl font-bold text-text-heading">
              Add a New Viewer
            </h3>
            <span
              aria-hidden="true"
              className="material-icons text-[16px]! text-primary md:hidden"
            >
              visibility
            </span>
          </div>

          <div className="flex flex-col items-center gap-[26px]">
            {/* Viewer Address */}
            <div className="flex w-full flex-col gap-[11px]">
              <label
                htmlFor="viewer-address"
                className="font-mulish text-sm font-bold text-text-body"
              >
                Viewer Address
              </label>
              <div className="flex h-[50px] w-full items-center gap-2 rounded-xl border border-surface-border bg-surface px-4 transition-colors focus-within:ring-2 focus-within:ring-primary/50">
                <input
                  id="viewer-address"
                  type="text"
                  placeholder="0x..."
                  value={viewerAddress}
                  onChange={(e) => setViewerAddress(e.target.value)}
                  disabled={isProcessing || step === "confirmed"}
                  className="min-w-0 flex-1 bg-transparent font-mulish text-base text-text-heading outline-none placeholder:text-text-heading/60 disabled:opacity-50"
                />
                {viewerAddress.length > 0 && (
                  <span
                    aria-label={isValidAddress ? "Valid address" : "Invalid address"}
                    className={`material-icons text-[24px]! ${
                      isValidAddress ? "text-tx-success-text" : "text-tx-error-text"
                    }`}
                  >
                    {isValidAddress ? "check_circle" : "cancel"}
                  </span>
                )}
              </div>
            </div>

            {/* Scope of Access */}
            <div className="flex w-full flex-col gap-[15px]">
              <span className="font-mulish text-sm font-bold text-text-body">
                Scope of Access
              </span>

              <div
                className="flex flex-col gap-5 md:grid md:grid-cols-2"
                role="radiogroup"
                aria-label="Scope of access"
              >
                {/* Full Portfolio */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={scope === "full"}
                  onClick={() => handleScopeChange("full")}
                  disabled={isProcessing || step === "confirmed"}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-[17px] backdrop-blur-sm transition-colors disabled:cursor-default disabled:opacity-50 ${
                    scope === "full"
                      ? "border-primary bg-primary-alpha-18"
                      : "border-surface-border bg-surface"
                  }`}
                >
                  <div
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                      scope === "full"
                        ? "border-primary bg-primary"
                        : "border-surface-border"
                    }`}
                  >
                    {scope === "full" && (
                      <div className="size-2 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-mulish text-sm font-bold text-text-heading">
                      Full Portfolio
                    </p>
                    <p className="font-mulish text-xs text-text-muted">
                      Access all confidential history
                    </p>
                  </div>
                </button>

                {/* Specific Token */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={scope === "specific"}
                  onClick={() => handleScopeChange("specific")}
                  disabled={isProcessing || step === "confirmed"}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-[17px] backdrop-blur-sm transition-colors disabled:cursor-default disabled:opacity-50 ${
                    scope === "specific"
                      ? "border-primary bg-primary-alpha-18"
                      : "border-surface-border bg-surface"
                  }`}
                >
                  <div
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                      scope === "specific"
                        ? "border-primary bg-primary"
                        : "border-surface-border"
                    }`}
                  >
                    {scope === "specific" && (
                      <div className="size-2 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-mulish text-sm font-bold text-text-heading">
                      Specific Token
                    </p>
                    <p className="font-mulish text-xs text-text-muted">
                      Select one asset only
                    </p>
                  </div>
                </button>
              </div>

              {/* Token list */}
              <div className="flex flex-col gap-2">
                <span className="font-mulish text-sm font-bold text-text-body">
                  Select Token to be disclosed
                </span>

                {confidentialTokens.map((token) => {
                  const isChecked = selectedTokens.has(token.symbol);
                  return (
                    <button
                      key={token.symbol}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => toggleToken(token.symbol)}
                      disabled={
                        scope === "full" ||
                        isProcessing ||
                        step === "confirmed"
                      }
                      className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-surface-border bg-surface px-[17px] py-2 transition-colors hover:opacity-80 disabled:cursor-default disabled:opacity-70"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex size-4 shrink-0 items-center justify-center border ${
                            isChecked
                              ? "border-primary bg-primary"
                              : "border-surface-border"
                          }`}
                        >
                          {isChecked && (
                            <span
                              aria-hidden="true"
                              className="material-icons text-[12px]! text-primary-foreground"
                            >
                              check
                            </span>
                          )}
                        </div>
                        <span className="font-mulish text-base text-text-heading/60">
                          {token.symbol}
                        </span>
                      </div>
                      <span className="font-mulish text-sm text-text-heading/60">
                        {token.address && token.address !== "0x..."
                          ? `${token.address.slice(0, 6)}...${token.address.slice(-4)}`
                          : "0x12Z456...."}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              disabled={!canGrant}
              onClick={handleGrant}
              className="flex w-[181px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-[18px] py-3 shadow-[0px_2px_4px_0px_rgba(71,37,244,0.2)] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isProcessing ? (
                <>
                  <span
                    aria-hidden="true"
                    className="material-icons animate-spin text-[16px]! text-primary-foreground motion-reduce:animate-none"
                  >
                    sync
                  </span>
                  <span className="font-mulish text-base font-bold text-primary-foreground">
                    {step === "reading-handle"
                      ? "Reading..."
                      : "Granting..."}
                  </span>
                </>
              ) : (
                <span className="font-mulish text-base font-bold text-primary-foreground">
                  Grant Access
                </span>
              )}
            </button>

            {/* Error message */}
            {step === "error" && error && (
              <ErrorMessage error={error} onRetry={reset} />
            )}

            {/* Progress tracker */}
            <ProgressTracker currentStep={step} steps={DISCLOSURE_STEPS} />

            {/* Success status on confirmed */}
            {step === "confirmed" && txEntries.length > 0 && (
              <div className="flex flex-col gap-1">
                {txEntries.map(({ hash, symbol }) => (
                  <TxSuccessStatus
                    key={hash}
                    message={`${symbol} Access Granted`}
                    txHash={hash}
                  />
                ))}
              </div>
            )}
          </div>

          {/* How it works — inside glass card on mobile */}
          <InfoCard className="backdrop-blur-lg md:p-3!">
            Selective disclosure shares a handle or balance at a given
            moment. The recipient can access data tied to that specific
            state only.
          </InfoCard>
        </div>

        {/* Function called */}
        {devMode && <CodeSection code={ADD_VIEWER_CODE} language="typescript" />}

        {/* Security Note */}
        <div className="flex w-full items-start gap-3 rounded-xl bg-modal-bg p-2.5 backdrop-blur-sm">
          <span
            aria-hidden="true"
            className="material-icons shrink-0 text-[24px]! text-tx-pending-text"
          >
            info
          </span>
          <div className="flex flex-col gap-1 py-0.5 text-xs md:flex-row md:items-center md:gap-2.5">
            <span className="font-mulish font-bold text-text-heading">
              Security Note:
            </span>
            <span className="font-mulish text-text-body">
              Access is tied to the current handle state at the time of
              disclosure. Any subsequent transaction that updates the handle
              invalidates prior access.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
