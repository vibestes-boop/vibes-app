import { Skeleton } from '@/components/ui/skeleton';

/**
 * Root `/` Loading-State.
 *
 * Dient zwei UI-Pfaden gleichzeitig: LandingPage (logged-out) und HomeFeedShell
 * (logged-in). Weil die Auth-Abfrage in `page.tsx` passiert und der Branch erst
 * nach dem getUser()-RTT entschieden wird, ist das Skeleton absichtlich
 * neutral — eine zentrale Hero-Fläche + drei „Feed-Card"-Placeholder.
 * Mismatch zum finalen Layout wird durch den schnellen Auth-RTT (<100ms im
 * Happy-Path) kaschiert.
 */
export default function HomeLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Optionaler Story-Strip (nur logged-in) */}
      <div className="mb-6 flex gap-3 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-16 shrink-0 rounded-full" />
        ))}
      </div>

      {/* Feed-Cards (9:16 zentriert) */}
      <div className="mx-auto flex flex-col items-center gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex w-full max-w-sm flex-col gap-3">
            {/* Video-Body */}
            <Skeleton className="aspect-[9/16] w-full rounded-xl" />
            {/* Caption + Meta */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
