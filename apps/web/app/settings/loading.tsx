import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      {/* Header */}
      <Skeleton className="mb-8 h-8 w-36" />

      {/* Nav sections */}
      {[5, 3, 2].map((count, gi) => (
        <div key={gi} className="mb-6">
          <Skeleton className="mb-2 h-3 w-24" />
          <div className="rounded-xl border divide-y divide-border overflow-hidden">
            {[...Array(count)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
