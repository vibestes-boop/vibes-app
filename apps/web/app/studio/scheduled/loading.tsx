import { Skeleton } from '@/components/ui/skeleton';

// Skeleton for /studio/scheduled — Scheduled posts queue
export default function StudioScheduledLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6 lg:px-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Scheduled post rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
          <Skeleton className="h-16 w-12 flex-shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
