import { Skeleton } from '@/components/ui/skeleton';
import { Bookmark } from 'lucide-react';

// Skeleton for /shop/saved — Saved Products page
export default function SavedProductsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 lg:px-8">
      {/* Back + Header */}
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-muted-foreground/40" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
