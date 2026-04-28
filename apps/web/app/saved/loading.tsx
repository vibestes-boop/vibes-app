import { Skeleton } from '@/components/ui/skeleton';

export default function SavedLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded" />
        <Skeleton className="h-8 w-40" />
      </div>

      {/* 3-column post grid — 9:16 cells */}
      <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
        {[...Array(18)].map((_, i) => (
          <Skeleton key={i} className="aspect-[9/16] w-full rounded-none sm:rounded" />
        ))}
      </div>
    </div>
  );
}
