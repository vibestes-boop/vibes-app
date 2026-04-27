import { Skeleton } from '@/components/ui/skeleton';

export default function DraftsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
      <Skeleton className="mb-6 h-5 w-28" />
      <Skeleton className="mb-2 h-8 w-36" />
      <Skeleton className="mb-8 h-4 w-48" />

      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
            <Skeleton className="h-16 w-12 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex gap-2 shrink-0">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
