import { Skeleton } from '@/components/ui/skeleton';

// Skeleton for /studio/analytics — Creator Analytics
// Layout: KPI strip | views chart | follower chart | top posts grid
export default function StudioAnalyticsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-6 lg:px-8">
      <Skeleton className="h-8 w-44" />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>

      {/* Second chart */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>

      {/* Top posts */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="aspect-[9/16] w-full rounded-lg" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
