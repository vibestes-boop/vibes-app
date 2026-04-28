import { Skeleton } from '@/components/ui/skeleton';

export default function ReplayLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 lg:px-8">
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Video player area */}
        <div>
          <Skeleton className="aspect-video w-full rounded-xl" />

          {/* Clip marker chips */}
          <div className="mt-3 flex gap-2 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full shrink-0" />
            ))}
          </div>
        </div>

        {/* Sidebar meta */}
        <div className="space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
