"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFaucetModal } from "@/components/modals/faucet-modal-provider";

export function EmptyPortfolio() {
  const { setOpen } = useFaucetModal();

  return (
    <Card className="flex flex-1 flex-col items-center justify-center rounded-[32px] border-surface-border bg-surface px-5 py-12 backdrop-blur-sm md:px-10 md:py-24">
      <div className="flex flex-col items-center gap-[29px]">
        <div className="flex size-20 items-center justify-center rounded-full border border-surface-border bg-asset-icon-bg">
          <span aria-hidden="true" className="material-icons text-[36px]! text-text-muted">
            account_balance_wallet
          </span>
        </div>

        <h2 className="font-mulish text-2xl font-bold text-text-heading">
          Your portfolio is empty
        </h2>

        <p className="max-w-sm text-center font-mulish text-base leading-[26px] text-text-body">
          To explore the Confidential Token demo, you first need testnet assets
          to cover gas and wrap into confidential tokens.
        </p>

        <Button
          onClick={() => setOpen(true)}
          className="h-auto cursor-pointer rounded-xl bg-primary px-5 py-3 font-mulish text-lg font-bold text-primary-foreground shadow-[0px_2px_4px_0px_rgba(71,37,244,0.2)] hover:bg-primary-hover"
        >
          <span aria-hidden="true" className="material-icons text-[20px]!">
            account_balance_wallet
          </span>
          Go to Faucets
        </Button>
      </div>
    </Card>
  );
}
