"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DevModeToggle } from "@/components/shared/dev-mode-toggle";
import { Button } from "@/components/ui/button";
import { useFaucetModal } from "@/components/modals/faucet-modal-provider";
import { CONFIG } from "@/lib/config";
import { useState } from "react";

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Activity", href: "/activity" },
  { label: "Delegated View", href: "/delegated-view" },
] as const;

export function MobileMenu() {
  const pathname = usePathname();
  const { setOpen: setFaucetOpen } = useFaucetModal();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center justify-center md:hidden"
          aria-label="Open menu"
        >
          <span className="material-icons text-[22px]! text-text-heading">
            menu
          </span>
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="border-surface-border bg-background p-0">
        <SheetHeader className="border-b border-surface-border px-5 py-4">
          <SheetTitle className="font-mulish text-sm font-bold text-text-heading">
            Menu
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-4 py-3">
          {NAV_LINKS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 font-mulish text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-surface text-text-heading"
                    : "text-text-body hover:bg-surface hover:text-text-heading"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setFaucetOpen(true);
            }}
            className="cursor-pointer rounded-lg px-3 py-2.5 text-left font-mulish text-sm font-medium text-text-body transition-colors hover:bg-surface hover:text-text-heading"
          >
            Faucet
          </button>
        </nav>

        <div className="border-t border-surface-border px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mulish text-xs font-medium text-text-muted">
              Theme
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="border-t border-surface-border px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mulish text-xs font-medium text-text-muted">
              Dev Mode
            </span>
            <DevModeToggle />
          </div>
        </div>

        <div className="mt-auto border-t border-surface-border px-4 py-4">
          <Button
            asChild
            className="w-full rounded-xl bg-primary px-3 py-2 font-mulish text-sm font-bold text-primary-foreground shadow-[0px_2px_4px_0px_rgba(71,37,244,0.2)] hover:bg-primary-hover"
          >
            <Link href={CONFIG.urls.contact} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              Contact us
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
