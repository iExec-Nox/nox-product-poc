import { EXPLORER_BASE_URL } from "@/lib/config";

interface ExplorerLinkProps {
  txHash: string;
  label?: string;
  className?: string;
}

export function ExplorerLink({
  txHash,
  label = "View on Etherscan",
  className,
}: ExplorerLinkProps) {
  return (
    <a
      href={`${EXPLORER_BASE_URL}/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-mulish text-sm font-medium text-primary hover:underline ${className ?? ""}`}
    >
      {label}
      <span className="material-icons text-[14px]!">open_in_new</span>
    </a>
  );
}
