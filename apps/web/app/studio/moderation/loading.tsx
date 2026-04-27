import { Skeleton } from '@/components/ui/skeleton';

// Skeleton for /studio/moderation — Chat Moderation panel
export default function StudioModerationLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6 lg:px-8">
      <Skeleton className="h-8 w-36" />

      {/* Global toggle card */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>

      {/* Word list card */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Recent violations */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border p-3">
            <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
