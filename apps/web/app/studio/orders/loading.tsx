import { Skeleton } from '@/components/ui/skeleton';

// Skeleton for /studio/orders — Order management (buyer + seller)
export default function StudioOrdersLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6 lg:px-8">
      {/* Header + tabs */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>

      {/* Order rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
          <Skeleton className="h-14 w-14 flex-shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
