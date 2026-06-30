import type { TokenBalance } from "@/hooks/use-token-balances";
import type { TokenPrices } from "@/hooks/use-token-prices";
import { toFloat, formatUsd } from "@/lib/format";
import { EXPLORER_BASE_URL } from "@/lib/config";
import { Card } from "@/components/ui/card";
import { TokenRow } from "./token-row";

interface PublicAssetsProps {
  balances: TokenBalance[];
  prices: TokenPrices;
  address?: string;
}

export function PublicAssets({ balances, prices, address }: PublicAssetsProps) {
  const tokensWithBalance = balances.filter((b) => b.balance > 0n);

  return (
    <Card className="gap-0 rounded-3xl border-asset-list-border bg-asset-list-bg py-0 shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="material-icons text-[18px]! text-primary">
            public
          </span>
          <p className="font-mulish text-sm font-bold tracking-[1.4px] text-text-heading">
            Public Assets
          </p>
        </div>
        {address ? (
          <a
            href={`${EXPLORER_BASE_URL}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mulish text-xs text-text-body transition-colors hover:text-primary"
          >
            Visible to explorers
            <span aria-hidden="true" className="material-icons text-[12px]!">open_in_new</span>
          </a>
        ) : (
          <p className="font-mulish text-xs text-text-body">
            Visible to explorers
          </p>
        )}
      </div>

      {/* Token rows */}
      {tokensWithBalance.length > 0 ? (
        tokensWithBalance.map((token) => {
          const price = prices[token.symbol];
          const usdValue = price
            ? formatUsd(toFloat(token.balance, token.decimals) * price)
            : undefined;
          return (
            <TokenRow
              key={token.symbol}
              name={token.name}
              symbol={token.symbol}
              icon={token.icon}
              formatted={token.formatted}
              usdValue={usdValue}
            />
          );
        })
      ) : (
        <div className="border-t border-row-divider px-6 py-8 text-center">
          <p className="font-mulish text-sm text-text-muted">
            No public assets detected.
          </p>
        </div>
      )}
    </Card>
  );
}
