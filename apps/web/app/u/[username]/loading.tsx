import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/u/[username]` Loading-State.
 *
 * Public Profile — öffentliche SEO-Page aus Phase 2. Struktur: Cover-Banner,
 * Avatar-Halo overlapping-bottom-left, Bio + Counts, dann Tab-Strip, dann
 * 3-Col Post-Grid. Weil diese Seite auch externe Traffic-Quellen hat (Google,
 * Social-Share-Clicks), zählt das Skeleton hier besonders für perceived-
 * performance + Core-Web-Vitals.
 */
export default function UserProfileLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-12">
      {/* Cover-Banner */}
      <Skeleton className="mb-0 h-40 w-full rounded-none sm:h-52 sm:rounded-b-xl" />

      {/* Avatar + Bio-Row (Avatar überlappt Banner) */}
      <div className="relative -mt-10 flex flex-col items-center gap-3 px-4 sm:-mt-14 sm:flex-row sm:items-end sm:gap-5">
        <Skeleton className="h-24 w-24 shrink-0 rounded-full ring-4 ring-background sm:h-28 sm:w-28" />
        <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>

      {/* Count-Row (Posts / Follower / Following) */}
      <div className="mt-6 flex justify-center gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Bio-Paragraph */}
      <div className="mt-5 flex flex-col items-center gap-2 px-2">
        <Skeleton className="h-3 w-full max-w-md" />
        <Skeleton className="h-3 w-3/4 max-w-md" />
      </div>

      {/* Tab-Strip */}
      <div className="mt-8 flex justify-center gap-1 border-b border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-8 w-16" />
        ))}
      </div>

      {/* Post-Grid (3 Spalten) */}
      <div className="mt-4 grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[9/16] w-full rounded-none sm:rounded-md" />
        ))}
      </div>
    </main>
  );
}
