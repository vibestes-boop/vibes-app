// -----------------------------------------------------------------------------
// /woz — Loading skeleton.
// v1.w.UI.213
// -----------------------------------------------------------------------------

export default function WozLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
        <div className="flex flex-col gap-1.5">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="ml-auto h-6 w-24 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Post grid skeleton — 3-col */}
      <div className="grid grid-cols-3 gap-0.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[9/16] animate-pulse bg-muted"
          />
        ))}
      </div>
    </main>
  );
}
