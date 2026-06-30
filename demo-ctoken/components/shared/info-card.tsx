import type { ReactNode } from "react";

interface InfoCardProps {
  children: ReactNode;
  className?: string;
}

export function InfoCard({ children, className }: InfoCardProps) {
  return (
    <div className={`flex w-full gap-4 rounded-2xl border border-surface-border bg-surface px-3 py-2.5 backdrop-blur-sm md:p-6 ${className ?? ""}`}>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary md:size-10">
        <span aria-hidden="true" className="material-icons text-[14px]! text-primary-foreground md:text-[24px]!">
          info
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mulish text-sm font-bold text-text-heading">How it works</p>
        <p className="mt-1 font-mulish text-xs leading-[19.5px] text-text-body">
          {children}
        </p>
      </div>
    </div>
  );
}
