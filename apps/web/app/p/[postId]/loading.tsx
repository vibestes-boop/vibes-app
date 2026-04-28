import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/p/[postId]` Loading-State.
 *
 * Desktop: two-col grid — video player left, info panel right.
 * Mobile: stacked (video → info → comments).
 * Matches the lg:grid-cols-[1fr_360px] layout of the actual post detail page.
 */
export default function PostDetailLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: video player */}
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-[9/16] w-full max-h-[75vh] rounded-2xl sm:aspect-video sm:max-h-none" />
        </div>

        {/* Right: info panel */}
        <div className="flex flex-col gap-4">
          {/* Author card */}
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <Skeleton className="h-11 w-11 flex-shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>

          {/* Caption */}
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-1.5 pt-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>

          {/* Comments header */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>

          {/* Comment rows */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className={`h-4 ${i % 2 === 0 ? 'w-4/5' : 'w-3/5'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
