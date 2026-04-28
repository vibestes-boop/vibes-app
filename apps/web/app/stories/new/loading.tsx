import { Skeleton } from '@/components/ui/skeleton';

// Loading skeleton für /stories/new — Story-Creator.

export default function NewStoryLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 lg:px-6">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Upload area */}
      <Skeleton className="mb-6 h-64 w-full rounded-2xl" />

      {/* Controls row */}
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 flex-1 rounded-lg" />
      </div>

      {/* Publish button */}
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}
