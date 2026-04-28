import { Skeleton } from '@/components/ui/skeleton';

export default function MerchantShopLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      {/* Breadcrumb */}
      <Skeleton className="mb-6 h-4 w-32" />
      {/* Merchant header */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      {/* Product grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
