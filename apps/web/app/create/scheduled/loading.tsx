import { Skeleton } from '@/components/ui/skeleton';

export default function ScheduledLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
      <Skeleton className="mb-6 h-5 w-28" />
      <Skeleton className="mb-2 h-8 w-44" />
      <Skeleton className="mb-8 h-4 w-48" />

      {/* Status filter chips */}
      <div className="mb-6 flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>

      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
            <Skeleton className="h-16 w-12 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex gap-2 shrink-0">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
