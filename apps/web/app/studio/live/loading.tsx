import { Skeleton } from '@/components/ui/skeleton';

// Skeleton for /studio/live — Live session history + active stream card
export default function StudioLiveLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-6 lg:px-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Active session banner (conditional) */}
      <div className="rounded-xl border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Session history */}
      <Skeleton className="h-5 w-28" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border p-3">
            <Skeleton className="h-20 w-32 flex-shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
              <div className="flex gap-3 pt-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
