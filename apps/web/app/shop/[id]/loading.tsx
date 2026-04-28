import { Skeleton } from '@/components/ui/skeleton';

// Skeleton for /shop/[id] — Product Detail
// Layout: image carousel hero | seller card | description | stock bar | reviews | sticky BuyBar
export default function ProductDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left — image carousel */}
        <div>
          <Skeleton className="aspect-square w-full rounded-2xl" />
          {/* thumbnail strip */}
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-14 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Right — meta */}
        <div className="flex flex-col gap-5">
          {/* Title + price */}
          <div className="space-y-2">
            <Skeleton className="h-7 w-3/4" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-5 w-16 opacity-50" />
            </div>
          </div>

          {/* Rating row */}
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-4 rounded-sm" />
            ))}
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Seller card */}
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>

          {/* Stock bar */}
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>

          {/* Info pills */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      </div>

      {/* Reviews section */}
      <div className="mt-12 space-y-4">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border p-4">
            <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-3 w-3 rounded-sm" />
                  ))}
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>

      {/* Sticky BuyBar stub */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
