import Image from "next/image";

interface TokenRowProps {
  name: string;
  symbol: string;
  icon: string;
  formatted: string;
  usdValue?: string;
}

export function TokenRow({
  name,
  symbol,
  icon,
  formatted,
  usdValue,
}: TokenRowProps) {
  return (
    <div className="flex items-center justify-between border-t border-row-divider px-6 py-5">
      <div className="flex items-center gap-4 md:gap-6">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary">
          <Image
            src={icon}
            alt={`${name} icon`}
            width={18}
            height={18}
            className="size-4.5 object-contain"
          />
        </div>
        <div>
          <p className="font-mulish text-base font-bold leading-6 text-text-heading">
            {name}
          </p>
          <p className="font-mulish text-xs font-medium leading-4 text-text-body">
            {symbol}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mulish text-base font-bold leading-7 text-text-heading md:text-lg">
          {formatted} {symbol}
        </p>
        {usdValue && (
          <p className="font-mulish text-sm leading-5 text-text-body">
            {usdValue}
          </p>
        )}
      </div>
    </div>
  );
}
