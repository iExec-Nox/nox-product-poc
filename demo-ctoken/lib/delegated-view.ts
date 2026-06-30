// ── Tabs ───────────────────────────────────────────────────────────

export type DelegatedViewTab = "shared" | "grants";

export const DELEGATED_VIEW_TABS: {
  label: string;
  value: DelegatedViewTab;
}[] = [
  { label: "Shared with me", value: "shared" },
  { label: "My grants", value: "grants" },
];

// ── Token info ─────────────────────────────────────────────────────

export interface TokenInfo {
  symbol: string;
  decimals: number;
}

// ── Entry type ─────────────────────────────────────────────────────

export interface DelegatedViewEntry {
  id: string;
  handleId: string;
  counterparty: string;
  token: TokenInfo | null;
  isActive: boolean;
  timestamp: number;
  txHash: string;
}

// ── CSV Export ──────────────────────────────────────────────────────

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatTimestampForExport(seconds: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}

export function exportToCsv(
  entries: DelegatedViewEntry[],
  tab: DelegatedViewTab,
  decryptedValues: Record<string, string>,
) {
  const isShared = tab === "shared";

  const headers = isShared
    ? ["Token", "Status", "Shared by", "Handle", "Value", "Date", "Tx Hash"]
    : ["Token", "Status", "Viewer", "Handle", "Date", "Tx Hash"];

  const rows = entries.map((entry) => {
    const token = entry.token?.symbol ?? "Sealed";
    const status = entry.isActive ? "Active" : "Outdated";
    const date = formatTimestampForExport(entry.timestamp);
    if (isShared) {
      const value = decryptedValues[entry.handleId] ?? "Encrypted";
      return [token, status, entry.counterparty, entry.handleId, value, date, entry.txHash];
    }
    return [token, status, entry.counterparty, entry.handleId, date, entry.txHash];
  });

  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `delegated-view-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
