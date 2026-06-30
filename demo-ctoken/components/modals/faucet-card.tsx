import Image from "next/image";

interface FaucetCardProps {
  name: string;
  category?: string;
  description: React.ReactNode;
  icon: string;
  mintLabel: string;
  href: string;
  subtitle?: string;
  warning?: string;
}

export function FaucetCard({
  name,
  category,
  description,
  icon,
  mintLabel,
  href,
  subtitle,
  warning,
}: FaucetCardProps) {
  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-surface-border bg-surface px-[30px] py-5">
      {/* Top content — grows to push button to the bottom */}
      <div className="flex flex-1 flex-col items-center gap-[18px]">
        <div className="flex size-[35px] items-center justify-center rounded-[10px] bg-primary sm:size-12 sm:rounded-xl">
          <Image src={icon} alt="" width={28} height={28} className="size-5 sm:size-7" />
        </div>

        <p className="text-center font-mulish text-sm font-bold leading-7 text-text-heading sm:text-lg">
          {name}
        </p>

        {category && (
          <p className="text-center font-mulish text-xs font-medium tracking-[0.3px] text-text-muted sm:text-sm">
            {category}
          </p>
        )}

        <p className="text-center font-mulish text-xs leading-5 text-text-body sm:text-sm">
          {description}
        </p>
      </div>

      {/* Button — always aligned at the same position across sibling cards */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-[18px] w-full cursor-pointer rounded-xl bg-primary px-[10px] py-2 text-center font-mulish text-sm font-bold leading-7 text-primary-foreground shadow-[0px_2px_4px_0px_rgba(71,37,244,0.2)] hover:bg-primary-hover sm:px-5 sm:py-2.5 sm:text-[15px]"
      >
        {mintLabel}
      </a>

      {/* Subtitle — always rendered when provided to keep cards aligned */}
      {subtitle !== undefined && (
        <p className={`mt-2 text-center font-mulish text-[10px] leading-5 sm:text-xs ${subtitle.trim() ? "text-text-body" : "invisible"}`}>
          {subtitle || "\u00A0"}
        </p>
      )}

      {warning && (
        <p className="mt-4 text-center font-mulish text-xs font-medium tracking-[0.3px] text-tx-error-text sm:text-sm">
          {warning}
        </p>
      )}
    </div>
  );
}
