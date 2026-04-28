import { Skeleton } from '@/components/ui/skeleton';

// Loading skeleton for /coin-shop/success — shown while the order status is
// being fetched from the DB (getMyCoinOrderBySession + getUser).

export default function CoinShopSuccessLoading() {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-10 lg:py-16">
      {/* Status icon + heading */}
      <header className="mb-8 flex flex-col items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
      </header>

      {/* Order summary card */}
      <div className="rounded-2xl border border-border bg-card p-6">
        {/* Product row */}
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>

        {/* Detail rows */}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* CTA buttons */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
