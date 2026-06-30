import type { DelegatedViewEntry, DelegatedViewTab } from "@/lib/delegated-view";
import { EXPLORER_BASE_URL } from "@/lib/config";
import { truncateAddress } from "@/lib/utils";

// ── Shared helpers ─────────────────────────────────────────────────

function formatTimestamp(seconds: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}

function truncateHandle(handle: string): string {
  if (handle.length <= 14) return handle;
  return `${handle.slice(0, 8)}...${handle.slice(-4)}`;
}

function TokenLabel({ entry }: { entry: DelegatedViewEntry }) {
  const symbol = entry.token?.symbol ?? "Sealed";
  return (
    <span className="font-inter text-sm font-bold text-text-heading">
      {symbol}
    </span>
  );
}

function StatusBadge({ entry }: { entry: DelegatedViewEntry }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-inter text-[10px] font-bold uppercase tracking-wider ${
        entry.isActive
          ? "bg-tx-success-bg text-tx-success-text"
          : "bg-tx-pending-bg text-tx-pending-text"
      }`}
    >
      {entry.isActive ? "Active" : "Outdated"}
    </span>
  );
}

function ExplorerTxLink({ txHash }: { txHash: string }) {
  return (
    <a
      href={`${EXPLORER_BASE_URL}/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-inter text-xs font-bold text-primary transition-colors hover:text-primary-hover"
    >
      Etherscan
      <span aria-hidden="true" className="material-icons text-[14px]!">
        north_east
      </span>
    </a>
  );
}

// ── Props ──────────────────────────────────────────────────────────

interface DelegatedViewTableProps {
  entries: DelegatedViewEntry[];
  tab: DelegatedViewTab;
  decryptedValues: Record<string, string>;
  decryptingHandle: string | null;
  onDecrypt: (handleId: string, decimals?: number) => void;
}

// ── Columns ────────────────────────────────────────────────────────

const SHARED_COLUMNS = [
  "Token",
  "Status",
  "Shared by",
  "Handle",
  "Value",
  "Date",
  "Details",
] as const;

const GRANTS_COLUMNS = [
  "Token",
  "Status",
  "Viewer",
  "Handle",
  "Date",
  "Details",
] as const;

// ── Component ──────────────────────────────────────────────────────

export function DelegatedViewTable({
  entries,
  tab,
  decryptedValues,
  decryptingHandle,
  onDecrypt,
}: DelegatedViewTableProps) {
  return (
    <>
      {/* Mobile: card layout */}
      <div className="flex flex-col gap-3 md:hidden">
        {entries.map((entry) => (
          <MobileCard
            key={entry.id}
            entry={entry}
            tab={tab}
            decryptedValues={decryptedValues}
            decryptingHandle={decryptingHandle}
            onDecrypt={onDecrypt}
          />
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden w-full overflow-hidden rounded-2xl border border-surface-border bg-surface backdrop-blur-sm md:block">
        <table className="w-full">
          <caption className="sr-only">
            {tab === "shared"
              ? "Handles shared with you"
              : "Viewer access you have granted"}
          </caption>
          <thead>
            <tr className="border-b border-surface-border">
              {(tab === "shared" ? SHARED_COLUMNS : GRANTS_COLUMNS).map(
                (col) => (
                  <th
                    key={col}
                    scope="col"
                    className={`px-6 py-4 font-inter text-xs font-bold uppercase tracking-wider text-text-muted ${
                      col === "Details" || col === "Value"
                        ? "text-right"
                        : col === "Date"
                          ? "text-center"
                          : "text-left"
                    }`}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {entries.map((entry) =>
              tab === "shared" ? (
                <SharedRow
                  key={entry.id}
                  entry={entry}
                  decryptedValues={decryptedValues}
                  decryptingHandle={decryptingHandle}
                  onDecrypt={onDecrypt}
                />
              ) : (
                <GrantsRow key={entry.id} entry={entry} />
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Desktop rows ───────────────────────────────────────────────────

function SharedRow({
  entry,
  decryptedValues,
  decryptingHandle,
  onDecrypt,
}: {
  entry: DelegatedViewEntry;
  decryptedValues: Record<string, string>;
  decryptingHandle: string | null;
  onDecrypt: (handleId: string, decimals?: number) => void;
}) {
  const isDecrypting = decryptingHandle === entry.handleId;
  const decrypted = decryptedValues[entry.handleId];

  return (
    <tr className="bg-surface/50 transition-colors hover:bg-surface">
      <td className="px-6 py-5">
        <TokenLabel entry={entry} />
      </td>
      <td className="px-6 py-5">
        <StatusBadge entry={entry} />
      </td>
      <td className="px-6 py-5">
        <span className="font-inter text-sm font-medium text-text-body">
          {truncateAddress(entry.counterparty)}
        </span>
      </td>
      <td className="px-6 py-5">
        <span className="font-mono text-xs text-text-body">
          {truncateHandle(entry.handleId)}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        {decrypted ? (
          <span className="font-inter text-sm font-medium text-text-heading">
            {decrypted}
            {entry.token && (
              <span className="ml-1 text-xs text-text-muted">
                {entry.token.symbol}
              </span>
            )}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onDecrypt(entry.handleId, entry.token?.decimals)}
            disabled={isDecrypting}
            className="inline-flex cursor-pointer items-center gap-1 font-inter text-xs font-bold text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Decrypt handle ${truncateHandle(entry.handleId)}`}
          >
            {isDecrypting ? (
              <span
                aria-hidden="true"
                className="material-icons animate-spin text-[16px]!"
              >
                sync
              </span>
            ) : (
              <>
                <span className="text-text-muted">******</span>
                <span
                  aria-hidden="true"
                  className="material-icons text-[16px]!"
                >
                  visibility
                </span>
              </>
            )}
          </button>
        )}
      </td>
      <td className="px-6 py-5 text-center">
        <span className="font-inter text-sm text-text-muted">
          {formatTimestamp(entry.timestamp)}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        <ExplorerTxLink txHash={entry.txHash} />
      </td>
    </tr>
  );
}

function GrantsRow({ entry }: { entry: DelegatedViewEntry }) {
  return (
    <tr className="bg-surface/50 transition-colors hover:bg-surface">
      <td className="px-6 py-5">
        <TokenLabel entry={entry} />
      </td>
      <td className="px-6 py-5">
        <StatusBadge entry={entry} />
      </td>
      <td className="px-6 py-5">
        <span className="font-inter text-sm font-medium text-text-body">
          {truncateAddress(entry.counterparty)}
        </span>
      </td>
      <td className="px-6 py-5">
        <span className="font-mono text-xs text-text-body">
          {truncateHandle(entry.handleId)}
        </span>
      </td>
      <td className="px-6 py-5 text-center">
        <span className="font-inter text-sm text-text-muted">
          {formatTimestamp(entry.timestamp)}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        <ExplorerTxLink txHash={entry.txHash} />
      </td>
    </tr>
  );
}

// ── Mobile card ────────────────────────────────────────────────────

function MobileCard({
  entry,
  tab,
  decryptedValues,
  decryptingHandle,
  onDecrypt,
}: {
  entry: DelegatedViewEntry;
  tab: DelegatedViewTab;
  decryptedValues: Record<string, string>;
  decryptingHandle: string | null;
  onDecrypt: (handleId: string, decimals?: number) => void;
}) {
  const isDecrypting = decryptingHandle === entry.handleId;
  const decrypted = decryptedValues[entry.handleId];

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-4 backdrop-blur-sm">
      {/* Row 1: Token + Status + Counterparty */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TokenLabel entry={entry} />
          <StatusBadge entry={entry} />
        </div>
        <span className="font-inter text-sm font-medium text-text-body">
          {truncateAddress(entry.counterparty)}
        </span>
      </div>

      {/* Row 2: Handle + Value (shared) */}
      <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
        <span className="font-mono text-xs text-text-body">
          {truncateHandle(entry.handleId)}
        </span>

        {tab === "shared" && (
          <>
            {decrypted ? (
              <span className="font-inter text-sm font-medium text-text-heading">
                {decrypted}
                {entry.token && (
                  <span className="ml-1 text-xs text-text-muted">
                    {entry.token.symbol}
                  </span>
                )}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onDecrypt(entry.handleId, entry.token?.decimals)}
                disabled={isDecrypting}
                className="inline-flex cursor-pointer items-center gap-1 font-inter text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Decrypt handle ${truncateHandle(entry.handleId)}`}
              >
                {isDecrypting ? (
                  <span
                    aria-hidden="true"
                    className="material-icons animate-spin text-[16px]!"
                  >
                    sync
                  </span>
                ) : (
                  <>
                    <span className="text-text-muted">******</span>
                    <span
                      aria-hidden="true"
                      className="material-icons text-[16px]!"
                    >
                      visibility
                    </span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Row 3: Date + Etherscan */}
      <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
        <span className="font-inter text-xs text-text-muted">
          {formatTimestamp(entry.timestamp)}
        </span>
        <ExplorerTxLink txHash={entry.txHash} />
      </div>
    </div>
  );
}
