import { Skeleton } from '@/components/ui/skeleton';
import { Coins } from 'lucide-react';

export default function CoinShopLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:px-6">
      {/* Header */}
      <div className="mb-8 text-center space-y-2">
        <div className="flex justify-center">
          <Coins className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <Skeleton className="mx-auto h-8 w-40" />
        <Skeleton className="mx-auto h-4 w-64" />
      </div>

      {/* Current balance */}
      <Skeleton className="mx-auto mb-8 h-12 w-44 rounded-2xl" />

      {/* Tier cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
