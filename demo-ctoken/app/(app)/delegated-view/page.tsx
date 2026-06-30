import type { Metadata } from "next";
import { DelegatedViewContent } from "@/components/delegated-view/delegated-view-content";

export const metadata: Metadata = {
  title: "Delegated View | Nox",
  description: "View and manage ACL delegations for your confidential tokens",
};

export default function DelegatedViewPage() {
  return (
    <div className="min-h-[60vh]">
      <DelegatedViewContent />
    </div>
  );
}
