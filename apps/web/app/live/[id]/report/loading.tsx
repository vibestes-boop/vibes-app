import { Skeleton } from '@/components/ui/skeleton';

export default function LiveReportLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Skeleton className="mb-6 h-5 w-20" />
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-8 h-4 w-56" />
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-10 w-full rounded-lg" />
    </div>
  );
}
