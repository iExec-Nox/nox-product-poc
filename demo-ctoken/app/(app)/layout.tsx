import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Footer } from "@/components/layout/footer";
import { WalletGuard } from "@/components/shared/wallet-guard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletGuard>
      <div className="flex min-h-screen flex-col">
        <DashboardHeader />
        <main className="mx-auto w-full max-w-7xl flex-1">{children}</main>
        <Footer />
      </div>
    </WalletGuard>
  );
}
