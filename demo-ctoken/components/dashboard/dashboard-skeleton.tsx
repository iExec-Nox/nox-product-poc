import { Skeleton } from "@/components/ui/skeleton";
import { PortfolioHeader } from "./portfolio-header";

export function DashboardSkeleton() {
  return (
    <>
      <PortfolioHeader />
      <div className="flex items-start gap-[22px] px-10">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[32px] border border-surface-border bg-surface py-24 backdrop-blur-sm">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <Skeleton className="h-96 w-[290px] shrink-0 rounded-3xl" />
      </div>
    </>
  );
}
