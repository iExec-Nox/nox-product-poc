import { ExplorerLink } from "./explorer-link";

interface TxSuccessStatusProps {
  message: string;
  txHash: string;
}

export function TxSuccessStatus({ message, txHash }: TxSuccessStatusProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-2" role="status" aria-live="polite">
      <div className="size-2.5 rounded-full bg-tx-success-text opacity-70" />
      <span className="font-mulish text-sm font-medium text-text-body">
        {message}
      </span>
      <span className="text-text-muted">·</span>
      <ExplorerLink txHash={txHash} label="View on Etherscan" className="text-xs" />
    </div>
  );
}
