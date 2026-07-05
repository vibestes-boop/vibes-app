'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Aktualisiert die (Server-)Seite regelmäßig via router.refresh() — re-rendert
// die Server-Component mit frischen Daten, ohne vollen Page-Reload. Für die
// Live-Feed-Admin-Seite, damit sie echten "Live"-Charakter hat.
export function AutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        router.refresh();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, paused]);

  return (
    <button
      type="button"
      onClick={() => setPaused((p) => !p)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
      aria-pressed={paused}
    >
      <span
        className={
          paused
            ? 'h-2 w-2 rounded-full bg-muted-foreground'
            : 'h-2 w-2 animate-pulse rounded-full bg-emerald-500'
        }
      />
      {paused ? 'Pausiert' : `Live · alle ${Math.round(intervalMs / 1000)}s`}
    </button>
  );
}
