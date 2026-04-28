import { Skeleton } from '@/components/ui/skeleton';

export default function GuildDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 lg:px-6">
      {/* Guild hero */}
      <div className="mb-8 rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2 pt-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="mt-4 space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Leaderboard */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
        {/* Sidebar info */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-20" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
