import { Skeleton } from '@/components/ui/skeleton';

// Loading skeleton für /s/[storyId] — Story-Detail-View.
// Spiegelt das Layout: zentrierter 9:16-Viewer + Autor-Zeile unten.

export default function StoryDetailLoading() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Story 9:16 card */}
        <Skeleton className="aspect-[9/16] w-full rounded-2xl" />

        {/* Author row */}
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
