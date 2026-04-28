import { Skeleton } from '@/components/ui/skeleton';

export default function ShopAnalyticsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      {/* Header */}
      <Skeleton className="mb-8 h-8 w-52" />

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Revenue chart area */}
      <div className="mb-6 rounded-xl border p-5">
        <Skeleton className="mb-4 h-5 w-36" />
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>

      {/* Top products table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <Skeleton className="h-5 w-36" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
