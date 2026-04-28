'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// -----------------------------------------------------------------------------
// LivePageRefresher — unsichtbare Client-Component auf /live.
//
// Hält die Stream-Liste frisch ohne Full-Page-Reload:
//   1. postgres_changes INSERT auf live_sessions → neuer Stream gestartet
//   2. postgres_changes UPDATE auf live_sessions → Stream ended / Viewer-Count
//      geändert (Supabase sendet das Update wenn updated_at sich ändert)
//   3. 30s-Interval als Fallback (Realtime disconnected, Hintergrund-Tab)
//
// `router.refresh()` in Next.js App Router re-fetcht alle Server-Components
// der aktuellen Route ohne Client-State zu verlieren.
//
// Debounce 2s: mehrere schnelle Events (z.B. Viewer-Count-Spike) werden
// zu einem einzigen Refresh zusammengefasst.
// -----------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000;
const DEBOUNCE_MS = 2_000;

interface LivePageRefresherProps {
  /** Anzahl aktuell bekannter Sessions — wenn sich die ändert, sofort refreshen */
  sessionCount: number;
}

export function LivePageRefresher({ sessionCount: _ }: LivePageRefresherProps) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  const scheduleRefresh = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.refresh();
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    const client = createClient();

    // Cleanup falls Strict-Mode doppelt mountet
    if (channelRef.current) {
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = client
      .channel('live-sessions-discovery')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_sessions' },
        () => scheduleRefresh(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions' },
        () => scheduleRefresh(),
      )
      .subscribe();

    channelRef.current = channel;

    // Fallback-Polling
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearInterval(interval);
      client.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
