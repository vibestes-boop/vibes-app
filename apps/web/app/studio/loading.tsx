import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/studio` Loading-State.
 *
 * Creator-Dashboard-Landing (v1.w.9). Drei KPI-Karten oben + zwei breite
 * Chart-/Tabellen-Blöcke darunter + ein Sub-Navigation-Strip. Rendert schnell
 * weg weil `/studio/page.tsx` auf mehrere Aggregate-RPCs parallel wartet
 * (views, watch-time, revenue, schedule) — Skeleton ist dort besonders wichtig.
 */
export default function StudioLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Sub-Nav (Tabs) */}
      <div className="mb-6 flex gap-2 border-b border-border pb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20" />
        ))}
      </div>

      {/* KPI-Grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Chart-Row + Table-Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4 lg:col-span-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
