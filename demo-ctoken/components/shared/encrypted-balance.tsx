interface EncryptedBalanceProps {
  symbol: string;
  display: string | null;
  decryptingSymbol: string | null;
  onDecrypt: (symbol: string) => void;
  showSymbol?: boolean;
  iconSize?: string;
}

export function EncryptedBalance({
  symbol,
  display,
  decryptingSymbol,
  onDecrypt,
  showSymbol = true,
  iconSize = "text-[12px]!",
}: EncryptedBalanceProps) {
  if (display !== null) {
    return <>{showSymbol ? `${display} ${symbol}` : display}</>;
  }

  return (
    <>
      <span>{showSymbol ? `****** ${symbol}` : "******"}</span>
      {decryptingSymbol === symbol ? (
        <span
          className={`material-icons animate-spin text-text-muted motion-reduce:animate-none ${iconSize}`}
        >
          sync
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDecrypt(symbol);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              onDecrypt(symbol);
            }
          }}
          className="cursor-pointer transition-opacity hover:opacity-70"
          aria-label={`Reveal ${symbol} balance`}
        >
          <span className={`material-icons text-primary ${iconSize}`}>
            visibility
          </span>
        </button>
      )}
    </>
  );
}
