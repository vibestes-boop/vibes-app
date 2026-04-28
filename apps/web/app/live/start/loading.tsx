import { Skeleton } from '@/components/ui/skeleton';

export default function LiveStartLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <Skeleton className="mb-6 h-8 w-36" />
      <Skeleton className="mb-2 h-4 w-64" />
      {/* Mode tabs */}
      <div className="mt-8 flex gap-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-full" />
        ))}
      </div>
      {/* Setup card */}
      <div className="mt-6 rounded-xl border p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-1/3 rounded-lg" />
      </div>
    </div>
  );
}
