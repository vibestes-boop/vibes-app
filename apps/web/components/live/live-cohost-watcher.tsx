'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// -----------------------------------------------------------------------------
// LiveCoHostWatcher — v1.w.UI.145
//
// Problem: `coHostId` und `coHostName` auf der /live/[id]-Page sind SSR-Props.
// Wenn ein CoHost NACH dem Page-Load des Viewers hinzukommt oder geht, bleibt
// der `LiveVideoPlayer` mit veralteten Werten (null / alter coHostId), und:
//  • Neuer CoHost: duet-slot bleibt unsichtbar (LiveKit TrackSubscribed-Event
//    greift nicht weil `coHostId && participant.identity === coHostId` false ist).
//  • CoHost revoked: duet-slot bleibt sichtbar wenn coHostId noch aus SSR stammt.
//
// Fix: Diese Komponente subscribed auf `live_cohosts INSERT/UPDATE` für die
// Session und ruft `router.refresh()` auf. Dadurch re-fetcht der App-Router
// alle Server-Components und `LiveVideoPlayer` bekommt den neuen `coHostId`
// als Prop. Der Player-useEffect (depends on coHostId) re-läuft, reconnectet
// zum LiveKit-Room und attacht den CoHost-Track im duet-slot.
//
// 1,5s-Debounce: INSERT + ggf. darauf folgender UPDATE kommen oft in kurzen
// Burst (Request → Approve). Mehrere schnelle Events → ein Refresh.
//
// Kein Watcher wenn `ended=true`: Session-Seite wird sowieso bald redirected.
// -----------------------------------------------------------------------------

interface LiveCoHostWatcherProps {
  sessionId: string;
  ended: boolean;
}

export function LiveCoHostWatcher({ sessionId, ended }: LiveCoHostWatcherProps) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ended) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const scheduleRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.refresh();
        debounceRef.current = null;
      }, 1500);
    };

    const channel = supabase
      .channel(`live-cohost-watcher-${sessionId}`)
      // CoHost genehmigt → neuer Teilnehmer auf der Bühne
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_cohosts',
          filter: `session_id=eq.${sessionId}`,
        },
        () => scheduleRefresh(),
      )
      // CoHost revoked / andere State-Änderungen
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_cohosts',
          filter: `session_id=eq.${sessionId}`,
        },
        () => scheduleRefresh(),
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [sessionId, ended, router]);

  return null;
}
