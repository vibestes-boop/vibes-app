// Loading skeleton for /admin overview
export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Stat grid skeleton */}
      <section>
        <div className="mb-3 h-3 w-32 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="h-8 w-8 rounded-lg bg-muted" />
              <div className="h-6 w-16 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>

      {/* Quick links skeleton */}
      <section>
        <div className="mb-3 h-3 w-28 rounded bg-muted" />
        <div className="grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="mt-0.5 h-8 w-8 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-3 w-36 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
