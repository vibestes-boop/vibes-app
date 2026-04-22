import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/live` Loading-State.
 *
 * Katalog-Seite für alle aktiven Live-Streams. Grid mit Live-Card-Thumbnails
 * (16:9 Landscape, weil Stream-Player-Previews breit sind — anders als der
 * 9:16-Feed). Streamer-Info (Avatar + Username) unter jedem Thumb.
 */
export default function LiveLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
