import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/shop` Loading-State.
 *
 * Matches das Katalog-Layout: Filter-Sidebar links (hidden auf Mobile),
 * Produkt-Grid rechts. Grid-Cols: 2 (Mobile) → 3 (md) → 4 (lg) — identisch
 * zum tatsächlichen Layout aus Phase 4. Jede Produkt-Card hat Cover + Titel +
 * Preis als drei Skeleton-Zeilen.
 */
export default function ShopLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Header-Row: Titel + Such-Input */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full max-w-sm rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Filter-Sidebar (desktop only) */}
        <aside className="hidden flex-col gap-4 lg:flex">
          <Skeleton className="h-5 w-24" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
          <Skeleton className="mt-4 h-5 w-20" />
          <Skeleton className="h-10 w-full" />
        </aside>

        {/* Produkt-Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
