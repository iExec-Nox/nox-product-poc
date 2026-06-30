"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useFaucetModal } from "./faucet-modal-provider";
import { FaucetCard } from "./faucet-card";
import { CONFIG } from "@/lib/config";

export function FaucetModal() {
  const { open, setOpen } = useFaucetModal();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-h-[90dvh] max-w-[calc(100%-2rem)] gap-2.5 overflow-y-auto scrollbar-none rounded-[40px] border-modal-border bg-modal-bg p-[30px] shadow-[0px_2px_4px_0px_rgba(116,142,255,0.22)] duration-300 data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8 motion-reduce:data-[state=open]:slide-in-from-bottom-0 motion-reduce:data-[state=closed]:slide-out-to-bottom-0 sm:max-w-[714px] sm:p-10"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="relative flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-0 right-0 cursor-pointer font-mulish text-xl text-text-heading transition-opacity hover:opacity-70"
            aria-label="Close"
          >
            X
          </button>
          <div className="relative size-[35px] overflow-hidden rounded-[10px] sm:size-16 sm:rounded-xl">
            <Image
              src="/nox-icon.png"
              alt=""
              fill
              className="object-cover"
            />
          </div>

          <DialogTitle className="font-mulish text-[26px] font-bold leading-10 text-text-heading sm:text-[34px]">
            Faucets
          </DialogTitle>

          <DialogDescription className="max-w-[448px] text-center font-mulish text-xs leading-[26px] text-text-body sm:text-base">
            Confidential transactions require testnet assets. Request tokens
            below to start exploring Confidential Token.
          </DialogDescription>
        </div>

        {/* Faucets — single grouped list */}
        <div className="mt-2.5 flex flex-col gap-6 sm:flex-row">
          <FaucetCard
            name="Faucet USDC"
            category="Assets"
            description="Used for private wrapping"
            icon="/faucet-usdc.svg"
            mintLabel="Mint USDC"
            href={CONFIG.urls.faucets.usdc}
          />
          <FaucetCard
            name="Faucet ETH"
            category="Gas"
            description="Required to pay transaction fees on Ethereum Sepolia"
            icon="/icon-eth.svg"
            mintLabel="Mint ETH"
            href={CONFIG.urls.faucets.eth}
          />
          <FaucetCard
            name="Faucet RLC"
            category="Assets"
            description="Used for private wrapping"
            icon="/faucet-usdc.svg"
            mintLabel="Mint RLC"
            href={CONFIG.urls.faucets.rlc}
          />
        </div>

        {/* Limits warning */}
        <div className="flex items-center justify-center gap-2 text-text-muted">
          <span aria-hidden="true" className="material-icons text-[14px]!">info</span>
          <p className="font-mulish text-xs font-medium">
            Limits: 0.1 ETH / 100 USDC per 24 hours
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
