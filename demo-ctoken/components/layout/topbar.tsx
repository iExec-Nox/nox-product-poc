"use client";

import { useFaucetModal } from "@/components/modals/faucet-modal-provider";

export function Topbar() {
  const { setOpen } = useFaucetModal();

  return (
    <div className="flex w-full items-center justify-center gap-2 border-b border-topbar-border bg-background px-5 py-3 text-[11px] font-medium backdrop-blur-sm md:text-xs lg:text-sm">
      <span className="text-text-muted">Running on Ethereum Sepolia Testnet</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer text-text-heading underline"
      >
        Get Test Tokens
      </button>
    </div>
  );
}
