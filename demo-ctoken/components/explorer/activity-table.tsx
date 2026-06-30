import type { ActivityEntry } from "@/lib/activity";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/activity";
import { EXPLORER_BASE_URL } from "@/lib/config";

const COLUMNS = ["Action", "Asset", "Amount", "Time", "Details"] as const;

interface ActivityTableProps {
  entries: ActivityEntry[];
}

export function ActivityTable({ entries }: ActivityTableProps) {
  return (
    <>
      {/* Mobile: card layout */}
      <div className="flex flex-col gap-3 md:hidden">
        {entries.map((entry) => (
          <ActivityCard key={entry.id} entry={entry} />
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden w-full overflow-hidden rounded-2xl border border-surface-border bg-surface backdrop-blur-sm md:block">
        <table className="w-full">
          <caption className="sr-only">Transaction history</caption>
          <thead>
            <tr className="border-b border-surface-border">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className={`px-6 py-4 font-inter text-xs font-bold uppercase tracking-wider text-text-muted ${
                    col === "Amount" || col === "Details"
                      ? "text-right"
                      : col === "Time"
                        ? "text-center"
                        : "text-left"
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {entries.map((entry) => (
              <ActivityTableRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ActivityCard({ entry }: { entry: ActivityEntry }) {
  const config = ACTIVITY_TYPE_CONFIG[entry.type];

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-4 backdrop-blur-sm">
      {/* Row 1: Action + Asset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-8 items-center justify-center rounded-lg ${config.iconBg}`}
          >
            <span
              aria-hidden="true"
              className={`material-icons text-[16px]! ${config.iconColor}`}
            >
              {config.icon}
            </span>
          </div>
          <span className="font-inter text-sm font-bold text-text-heading">
            {config.label}
          </span>
        </div>
        <span className="font-inter text-sm font-medium text-text-body">
          {entry.asset}
        </span>
      </div>

      {/* Row 2: Amount + Time + Etherscan */}
      <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
        <span className="font-inter text-sm font-medium text-text-heading">
          {entry.amount}
        </span>
        <span className="font-inter text-xs text-text-muted">
          {entry.timestamp}
        </span>
        <a
          href={`${EXPLORER_BASE_URL}/tx/${entry.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-inter text-xs font-bold text-primary transition-colors hover:text-primary-hover"
        >
          Etherscan
          <span aria-hidden="true" className="material-icons text-[14px]!">north_east</span>
        </a>
      </div>
    </div>
  );
}

function ActivityTableRow({ entry }: { entry: ActivityEntry }) {
  const config = ACTIVITY_TYPE_CONFIG[entry.type];

  return (
    <tr className="bg-surface/50 transition-colors hover:bg-surface">
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 items-center justify-center rounded-lg ${config.iconBg}`}
          >
            <span
              aria-hidden="true"
              className={`material-icons text-[18px]! ${config.iconColor}`}
            >
              {config.icon}
            </span>
          </div>
          <span className="font-inter text-sm font-bold text-text-heading">
            {config.label}
          </span>
        </div>
      </td>
      <td className="px-6 py-5">
        <span className="font-inter text-sm font-medium text-text-body">
          {entry.asset}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        <span className="font-inter text-sm font-medium text-text-heading">
          {entry.amount}
        </span>
      </td>
      <td className="px-6 py-5 text-center">
        <span className="font-inter text-sm text-text-muted">
          {entry.timestamp}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        <a
          href={`${EXPLORER_BASE_URL}/tx/${entry.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-inter text-xs font-bold text-primary transition-colors hover:text-primary-hover"
        >
          Etherscan
          <span aria-hidden="true" className="material-icons text-[14px]!">north_east</span>
        </a>
      </td>
    </tr>
  );
}
