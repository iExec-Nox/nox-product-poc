"use client";

import { useAppKitAccount } from "@reown/appkit/react";
import { useDisconnect } from "wagmi";
import { useConnectWallet } from "@/hooks/use-connect-wallet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const { connect } = useConnectWallet();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  function handleCopyAddress() {
    if (address) navigator.clipboard.writeText(address);
  }

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 rounded-lg border border-primary-alpha-border bg-primary-alpha-18 p-[9px] text-center text-text-heading hover:bg-primary-alpha-18 hover:opacity-90"
          >
            <span aria-hidden="true" className="material-icons text-lg! leading-7">wallet</span>
            <span className="whitespace-nowrap font-mulish text-sm font-bold leading-5">
              {formatAddress(address)}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[150px] rounded-[7px] bg-dropdown-bg p-[10px]"
        >
          <DropdownMenuItem
            onClick={handleCopyAddress}
            className="cursor-pointer gap-2 font-mulish text-xs font-semibold leading-5 text-dropdown-text"
          >
            <span aria-hidden="true" className="material-icons text-[14px]!">content_copy</span>
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => disconnect()}
            className="cursor-pointer gap-2 font-mulish text-xs font-semibold leading-5 text-dropdown-text"
          >
            <span aria-hidden="true" className="material-icons text-[14px]!">logout</span>
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      onClick={connect}
      className="rounded-lg border border-primary-alpha-border bg-primary px-2 py-1 font-mulish text-xs font-bold text-primary-foreground hover:bg-primary-hover md:px-3.5 md:py-[10px] md:text-sm"
    >
      Try It Now
    </Button>
  );
}
