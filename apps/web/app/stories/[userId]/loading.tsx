import { Skeleton } from '@/components/ui/skeleton';

// Loading skeleton für /stories/[userId] — Story-Viewer (fullscreen).
// Der eigentliche Viewer ist ein schwarzes Overlay — wir zeigen eine
// mittig zentrierte Lade-Indikation auf dunklem Grund.

export default function StoryViewerLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* 9:16 story card */}
      <div className="relative h-full max-h-[100dvh] w-full max-w-sm">
        <Skeleton className="h-full w-full rounded-none opacity-20" />

        {/* Top author strip */}
        <div className="absolute left-0 right-0 top-4 flex items-center gap-3 px-4">
          <Skeleton className="h-9 w-9 rounded-full opacity-40" />
          <Skeleton className="h-3 w-28 opacity-40" />
        </div>

        {/* Progress bar */}
        <Skeleton className="absolute left-4 right-4 top-2 h-1 rounded-full opacity-30" />
      </div>
    </div>
  );
}
