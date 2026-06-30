import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard | Nox",
  description: "Your confidential token portfolio",
};

export default function DashboardPage() {
  return (
    <div className="min-h-[60vh]">
      <DashboardContent />
    </div>
  );
}
