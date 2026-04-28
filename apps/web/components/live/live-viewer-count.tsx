'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Users } from 'lucide-react';
import { glassSurfaceDense } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// LiveViewerCount — realtime viewer count badge for the live viewer overlay.
//
// v1.w.UI.141: The /live/[id] page was rendering session.viewer_count from SSR
// which never updated as viewers joined/left. This component subscribes to
// live_sessions UPDATE on the specific row and reflects count changes live.
//
// Positionierung: inline-flex pill (glassSurfaceDense) — mounted by the parent
// inside the Top-Left-Stack, replacing the static count span.
// -----------------------------------------------------------------------------

interface LiveViewerCountProps {
  sessionId: string;
  initialCount: number;
  /** v1.w.UI.195 — when provided, the pill is rendered as a button that opens the audience modal */
  onClick?: () => void;
}

export function LiveViewerCount({ sessionId, initialCount, onClick }: LiveViewerCountProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel(`live-session-count-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as { viewer_count?: number };
          if (typeof row.viewer_count === 'number') {
            setCount(row.viewer_count);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const cls = cn(
    glassSurfaceDense,
    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-white shadow-elevation-1',
    onClick && 'cursor-pointer hover:bg-white/20 transition-colors',
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} aria-label="Zuschauer*innen anzeigen">
        <Users className="h-3 w-3" aria-hidden="true" />
        {count.toLocaleString('de-DE')}
      </button>
    );
  }

  return (
    <span className={cls}>
      <Users className="h-3 w-3" aria-hidden="true" />
      {count.toLocaleString('de-DE')}
    </span>
  );
}
