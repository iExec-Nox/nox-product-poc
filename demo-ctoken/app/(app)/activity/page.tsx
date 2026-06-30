import type { Metadata } from "next";
import { ExplorerContent } from "@/components/explorer/explorer-content";

export const metadata: Metadata = {
  title: "Activity | Nox",
  description: "Monitor your confidential transactions on Ethereum",
};

export default function ExplorerPage() {
  return (
    <div className="min-h-[60vh]">
      <ExplorerContent />
    </div>
  );
}
