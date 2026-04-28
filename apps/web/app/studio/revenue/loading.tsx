import { Skeleton } from '@/components/ui/skeleton';

// Skeleton for /studio/revenue — Earnings & Payouts
export default function StudioRevenueLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-6 lg:px-8">
      <Skeleton className="h-8 w-36" />

      {/* Balance hero */}
      <div className="rounded-xl border bg-card p-6 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Revenue breakdown grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Transactions list */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
            <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
