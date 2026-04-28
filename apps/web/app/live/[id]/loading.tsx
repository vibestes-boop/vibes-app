import { Skeleton } from '@/components/ui/skeleton';

// Spiegelt die Overlay-Architektur von /live/[id]/page.tsx:
// Dunkler Hintergrund, zentrierte 9:16 Video-Fläche, Overlay-Elemente.
export default function LiveViewerLoading() {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0b0b10]">
      <div className="absolute inset-0 flex items-center justify-center md:p-4">
        <div className="relative h-full w-full max-h-full md:aspect-[9/16] md:h-full md:w-auto md:max-w-full md:overflow-hidden md:rounded-2xl">
          {/* Video canvas placeholder */}
          <Skeleton className="absolute inset-0 rounded-none md:rounded-2xl bg-zinc-900" />

          {/* Top gradient */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />

          {/* Top bar: back + report */}
          <div className="absolute inset-x-3 top-3 flex items-center justify-between">
            <Skeleton className="h-8 w-8 rounded-full bg-white/10" />
            <Skeleton className="h-7 w-16 rounded-full bg-white/10" />
          </div>

          {/* LIVE badge + viewer count */}
          <div className="absolute left-3 top-14 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-14 rounded bg-red-600/60" />
              <Skeleton className="h-5 w-16 rounded-full bg-white/10" />
            </div>
            {/* Host pill */}
            <Skeleton className="h-9 w-44 rounded-full bg-white/10" />
            {/* Title */}
            <Skeleton className="h-4 w-56 rounded bg-white/10" />
          </div>

          {/* Chat overlay — bottom left */}
          <div className="absolute bottom-20 left-3 flex flex-col gap-2 w-2/3">
            {[80, 64, 72, 56].map((w, i) => (
              <Skeleton key={i} className="h-7 rounded-full bg-white/10" style={{ width: `${w}%` }} />
            ))}
          </div>

          {/* Action bar — bottom right */}
          <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-full bg-white/10" />
            ))}
          </div>

          {/* Input bar — bottom */}
          <div className="absolute inset-x-3 bottom-4 left-3 right-16">
            <Skeleton className="h-9 w-full rounded-full bg-white/10" />
          </div>

          {/* Bottom gradient */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      </div>
    </div>
  );
}
