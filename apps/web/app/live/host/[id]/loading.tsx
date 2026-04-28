import { Skeleton } from '@/components/ui/skeleton';

// LiveHostDeck: 9:16 preview left + sidebar right
export default function LiveHostLoading() {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0b0b10]">
      <div className="grid h-full grid-cols-1 md:grid-cols-[1fr_320px]">
        {/* Video preview */}
        <div className="relative flex items-center justify-center bg-black">
          <Skeleton className="absolute inset-0 rounded-none bg-zinc-900" />
          {/* Host controls overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-12 rounded-full bg-white/10" />
            ))}
          </div>
        </div>

        {/* Control panel */}
        <div className="hidden md:flex flex-col gap-4 bg-[#131318] border-l border-white/5 p-4">
          {/* Session info */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 bg-white/10" />
            <Skeleton className="h-3 w-24 bg-white/10" />
          </div>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg bg-white/5" />
            ))}
          </div>
          {/* Chat */}
          <div className="flex-1 space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-lg bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
