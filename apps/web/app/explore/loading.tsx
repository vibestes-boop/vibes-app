import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/explore` Loading-State.
 *
 * Drei Sektionen wie die echte Seite:
 *  1. Trending-Hashtags — 2×4 Kacheln (lg:4-cols)
 *  2. Accounts entdecken — 4 Avatar-Karten
 *  3. Populäre Posts — 2×3 Video-Kacheln (lg:6-cols)
 */
export default function ExploreLoading() {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* Trending Hashtags */}
      <section className="mb-12">
        <Skeleton className="mb-4 h-6 w-48" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <Skeleton className="h-10 w-10 flex-shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Accounts entdecken */}
      <section className="mb-12">
        <Skeleton className="mb-4 h-6 w-52" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Populäre Posts */}
      <section>
        <Skeleton className="mb-4 h-6 w-40" />
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="aspect-[9/16] w-full rounded-xl" />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
