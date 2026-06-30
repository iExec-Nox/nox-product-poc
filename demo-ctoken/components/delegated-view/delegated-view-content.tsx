"use client";

import { useMemo, useState } from "react";
import { DelegatedViewTable } from "./delegated-view-table";
import { useDelegatedView } from "@/hooks/use-delegated-view";
import { useDecryptHandle } from "@/hooks/use-decrypt-handle";
import { useDevMode } from "@/hooks/use-dev-mode";
import { CodeSection } from "@/components/shared/code-section";
import { InfoCard } from "@/components/shared/info-card";
import {
  DELEGATED_VIEW_TABS,
  exportToCsv,
  type DelegatedViewTab,
} from "@/lib/delegated-view";

const ITEMS_PER_PAGE = 10;

const DEV_CODE_SHARED = `// Query the Nox subgraph for VIEWER grants where I am the viewer
const { handleRoles } = await querySubgraph(\`
  query sharedWithMe($me: Bytes!) {
    handleRoles(where: { account: $me, role: VIEWER }) {
      handle { id }
      grantedBy
      blockTimestamp
      transactionHash
    }
  }
\`, { me: myAddress.toLowerCase() });

// Resolve token by matching handle to current balances
const handle = await publicClient.readContract({
  address: cTokenAddress,
  abi: confidentialTokenAbi,
  functionName: "confidentialBalanceOf",
  args: [grantorAddress],
});`;

const DEV_CODE_GRANTS = `// Query the Nox subgraph for VIEWER grants I made
const { handleRoles } = await querySubgraph(\`
  query myGrants($me: Bytes!) {
    handleRoles(where: { grantedBy: $me, role: VIEWER }) {
      handle { id }
      account
      blockTimestamp
      transactionHash
    }
  }
\`, { me: myAddress.toLowerCase() });

// Active = handle matches current confidentialBalanceOf
const currentHandle = await publicClient.readContract({
  address: cTokenAddress,
  abi: confidentialTokenAbi,
  functionName: "confidentialBalanceOf",
  args: [myAddress],
});`;

function TableSkeleton() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-surface-border bg-surface backdrop-blur-sm">
      <div className="divide-y divide-surface-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-6 py-5">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-surface-border" />
            <div className="h-4 w-20 animate-pulse rounded bg-surface-border" />
            <div className="h-4 w-24 animate-pulse rounded bg-surface-border" />
            <div className="ml-auto h-4 w-20 animate-pulse rounded bg-surface-border" />
            <div className="h-4 w-28 animate-pulse rounded bg-surface-border" />
            <div className="h-4 w-16 animate-pulse rounded bg-surface-border" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: DelegatedViewTab }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-surface-border bg-surface py-16 backdrop-blur-sm">
      <span
        aria-hidden="true"
        className="material-icons text-[48px]! text-text-muted/40"
      >
        {tab === "shared" ? "visibility" : "share"}
      </span>
      <p className="mt-4 font-inter text-sm font-medium text-text-muted">
        {tab === "shared"
          ? "No one has shared handle access with you yet."
          : "You haven't granted viewer access to anyone yet."}
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 py-16">
      <span
        aria-hidden="true"
        className="material-icons text-[48px]! text-red-400/60"
      >
        error_outline
      </span>
      <p className="mt-4 font-inter text-sm font-medium text-red-400">
        Failed to load delegated view
      </p>
      <p className="mt-1 max-w-md text-center font-inter text-xs text-text-muted">
        {message}
      </p>
    </div>
  );
}

export function DelegatedViewContent() {
  const { sharedWithMe, myGrants, isLoading, error } = useDelegatedView();
  const { decryptedValues, decryptingHandle, decrypt } = useDecryptHandle();
  const { enabled: devMode } = useDevMode();
  const [activeTab, setActiveTab] = useState<DelegatedViewTab>("shared");
  const [page, setPage] = useState(1);

  const entries = activeTab === "shared" ? sharedWithMe : myGrants;

  const totalPages = Math.max(1, Math.ceil(entries.length / ITEMS_PER_PAGE));
  const paginated = useMemo(
    () =>
      entries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [entries, page],
  );

  function handleTabChange(tab: DelegatedViewTab) {
    setActiveTab(tab);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-6 md:gap-10 md:px-10 md:py-10 lg:px-[114px]">
      {/* Header */}
      <div>
        <h1 className="font-anybody text-2xl font-bold leading-9 tracking-tight text-text-heading md:text-[30px]">
          Delegated View
        </h1>
        <p className="mt-1 font-inter text-sm text-text-body md:mt-2">
          View and manage ACL delegations for your confidential token handles.
        </p>
      </div>

      {/* Tabs + Export */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {DELEGATED_VIEW_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={`cursor-pointer rounded-lg px-4 py-2 font-inter text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-text-body hover:text-text-heading"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => exportToCsv(entries, activeTab, decryptedValues)}
          disabled={entries.length === 0}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border bg-surface px-4 py-2 font-inter text-sm font-medium text-text-body backdrop-blur-sm transition-colors hover:text-text-heading disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Export current view as CSV"
        >
          <span aria-hidden="true" className="material-icons text-[18px]!">
            download
          </span>
          <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : entries.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <>
          <DelegatedViewTable
            entries={paginated}
            tab={activeTab}
            decryptedValues={decryptedValues}
            decryptingHandle={decryptingHandle}
            onDecrypt={decrypt}
          />

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="font-inter text-xs font-medium text-text-muted">
              Showing {paginated.length} of {entries.length} entries
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="cursor-pointer p-1 text-text-muted transition-colors hover:text-text-heading disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span
                  aria-hidden="true"
                  className="material-icons text-[24px]!"
                >
                  chevron_left
                </span>
              </button>

              <span className="flex min-w-[30px] items-center justify-center rounded border border-surface-border bg-surface px-3 py-1 font-inter text-xs font-medium text-text-heading backdrop-blur-sm">
                {page}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="cursor-pointer p-1 text-text-muted transition-colors hover:text-text-heading disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span
                  aria-hidden="true"
                  className="material-icons text-[24px]!"
                >
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Dev mode */}
      {devMode && (
        <div className="flex flex-col gap-4">
          <InfoCard>
            The Delegated View reads <code className="font-mono text-xs">VIEWER</code> roles
            from the Nox subgraph, then resolves each handle to a token
            via <code className="font-mono text-xs">confidentialBalanceOf</code> on
            each cToken. If the handle matches the current balance, the grant is
            marked <strong>Active</strong>; otherwise <strong>Outdated</strong>.
          </InfoCard>
          <CodeSection
            code={activeTab === "shared" ? DEV_CODE_SHARED : DEV_CODE_GRANTS}
            language="typescript"
          />
        </div>
      )}
    </div>
  );
}
