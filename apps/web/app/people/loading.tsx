import { Skeleton } from '@/components/ui/skeleton';

// -----------------------------------------------------------------------------
// /people loading skeleton — v1.w.UI.120
// -----------------------------------------------------------------------------

export default function PeopleLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-8 w-52" />
      </div>

      {/* Card grid */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {[...Array(24)].map((_, i) => (
          <li key={i}>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="w-full space-y-1.5">
                <Skeleton className="mx-auto h-3.5 w-24" />
                <Skeleton className="mx-auto h-3 w-16" />
                <Skeleton className="mx-auto h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
