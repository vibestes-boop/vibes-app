import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/search` Loading-State.
 *
 * Matches the search page layout:
 *  - Sticky search-box placeholder
 *  - Tab-bar (All / Users / Posts / Hashtags)
 *  - Mixed result rows: 3 user pills + 6 post thumbnails + 4 hashtag chips
 */
export default function SearchLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      {/* Search bar */}
      <Skeleton className="mb-6 h-11 w-full rounded-full" />

      {/* Tab bar */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* User results */}
      <section className="mb-8">
        <Skeleton className="mb-3 h-5 w-24" />
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 flex-shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </li>
          ))}
        </ul>
      </section>

      {/* Post results */}
      <section className="mb-8">
        <Skeleton className="mb-3 h-5 w-20" />
        <ul className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="aspect-[9/16] w-full rounded-lg" />
            </li>
          ))}
        </ul>
      </section>

      {/* Hashtag results */}
      <section>
        <Skeleton className="mb-3 h-5 w-28" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
