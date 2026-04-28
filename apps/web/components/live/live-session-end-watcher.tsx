'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// -----------------------------------------------------------------------------
// LiveSessionEndWatcher — v1.w.UI.144
//
// Problem: `ended` auf der /live/[id]-Page ist ein SSR-Prop (session.status
// wird einmalig beim Page-Render gecheckt). Wenn der Host den Stream beendet
// während ein Viewer bereits auf der Page ist, bleibt `ended = false` für
// immer — Chat-Compose, Action-Bar und Gift-Goal bleiben sichtbar obwohl der
// Stream tot ist. Der LiveVideoPlayer zeigt zwar ein "Stream beendet"-Overlay
// (via LiveKit-RoomEvent.Disconnected), aber das ist ein isolierter State im
// Video-Player; die umgebende Page-Shell weiß davon nichts.
//
// Fix: Diese Komponente subscribed auf `live_sessions UPDATE` für die spezi-
// fische Session. Sobald `status !== 'active'` (oder `ended_at` gesetzt) wird,
// ruft sie `router.refresh()` auf.
//
// `router.refresh()` im App Router:
//  • Re-fetcht alle Server-Components der aktuellen Route ohne Navigation.
//  • Client-States (Scroll-Position, Modal-Open) bleiben erhalten.
//  • Die Server-Components holen den neuen session-Status → `ended = true` →
//    alle `!ended &&`-Conditions kollabieren korrekt.
//
// 1s-Debounce: Supabase Realtime kann den Event minimal vor dem DB-Commit
// pushen (race). Kurzer Delay gibt der DB Zeit zu commiten, damit `router
// .refresh()` den neuen Status auch wirklich sieht.
// -----------------------------------------------------------------------------

interface LiveSessionEndWatcherProps {
  sessionId: string;
  /** Wenn bereits vom SSR als beendet erkannt: kein Channel nötig. */
  alreadyEnded: boolean;
}

export function LiveSessionEndWatcher({ sessionId, alreadyEnded }: LiveSessionEndWatcherProps) {
  const router = useRouter();

  useEffect(() => {
    if (alreadyEnded) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`live-session-end-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as { status?: string; ended_at?: string | null };
          const isEnded = row.status !== 'active' || Boolean(row.ended_at);
          if (isEnded) {
            // 1s Debounce — lässt DB-Commit durchwandern bevor wir re-fetchen.
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
              router.refresh();
            }, 1000);
          }
        },
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [sessionId, alreadyEnded, router]);

  return null;
}
