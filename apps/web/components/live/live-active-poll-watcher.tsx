'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { LivePollPanel } from './live-poll-panel';
import type { ActiveLivePollSSR } from '@/lib/data/live';
import { glassSurface } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// LiveActivePollWatcher — v1.w.UI.143
//
// Problem: Die live viewer page rendert LivePollPanel nur wenn `activePoll` bei
// SSR bereits existierte. Startet der Host NACH dem Page-Load eine Umfrage,
// sehen bereits aufgerufene Viewer sie nie — weil kein Client-seitiger
// INSERT-Listener existierte.
//
// Fix: Diese Komponente hält den Poll-State client-seitig und subscribed auf:
//   • live_polls INSERT (session_id filter) → neue Umfrage erscheint sofort
//   • live_polls UPDATE (session_id filter) → wenn closed_at gesetzt wird,
//     zeigt LivePollPanel noch 8s das "Beendet"-Badge, dann wird die Karte
//     ausgeblendet
//
// Positionierung: dieselbe wie die bisherige statische Block
// (absolute right-3 top-28) — kein Layout-Regressions-Risiko.
//
// Wichtig: LivePollPanel hat eine eigene UPDATE-Sub auf `id=eq.{poll.id}` für
// Vote-Count-Updates. Der Watcher subscribed auf session_id-level (breiterer
// Filter) und kümmert sich nur um Lifecycle (Erscheinen / Verschwinden).
// Zwei unabhängige Channels — kein Konflikt.
// -----------------------------------------------------------------------------

interface LiveActivePollWatcherProps {
  sessionId: string;
  initialPoll: ActiveLivePollSSR | null;
  viewerId: string | null;
  ended: boolean;
}

export function LiveActivePollWatcher({
  sessionId,
  initialPoll,
  viewerId,
  ended,
}: LiveActivePollWatcherProps) {
  const [currentPoll, setCurrentPoll] = useState<ActiveLivePollSSR | null>(initialPoll);

  // Ref for the dismiss-timer so we can clear it on unmount / fast re-open
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ended) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel(`live-poll-watcher-${sessionId}`)
      // ── INSERT: Host startet eine neue Umfrage ─────────────────────────
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_polls',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            question: string;
            options: string[];
            created_at: string;
            closed_at: string | null;
          };
          // Vote-Counts starten bei 0 (niemand hat noch abgestimmt).
          // LivePollPanel's eigene UPDATE-Sub übernimmt ab hier.
          const options = Array.isArray(row.options) ? row.options : [];
          const poll: ActiveLivePollSSR = {
            id: row.id,
            question: row.question ?? '',
            options,
            created_at: row.created_at,
            closed_at: row.closed_at ?? null,
            vote_counts: options.map(() => 0),
            total_votes: 0,
            my_vote_index: null,
          };
          // Evtl. laufenden Dismiss-Timer canceln (Host hat sofort neue Poll)
          if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = null;
          }
          setCurrentPoll(poll);
        },
      )
      // ── UPDATE: Umfrage wird geschlossen ──────────────────────────────
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_polls',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; closed_at: string | null };
          if (row.closed_at) {
            // closed_at gesetzt → Panel zeigt noch "Beendet"-Badge,
            // nach 8s wird es ausgeblendet (Viewer sieht Ergebnis kurz).
            setCurrentPoll((prev) => {
              if (!prev || prev.id !== row.id) return prev;
              return { ...prev, closed_at: row.closed_at };
            });
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = setTimeout(() => {
              setCurrentPoll((prev) => (prev?.id === row.id ? null : prev));
              dismissTimerRef.current = null;
            }, 8000);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [sessionId, ended]);

  if (!currentPoll || ended) return null;

  return (
    <div className="absolute right-3 top-28 w-64 max-w-[55%]">
      <div className={cn(glassSurface, 'rounded-2xl p-1 shadow-elevation-2')}>
        <div className="[&_h3]:text-white [&_.rounded-xl]:bg-transparent [&_.rounded-xl]:!border-0 [&_.rounded-xl]:!p-2">
          <LivePollPanel
            sessionId={sessionId}
            poll={currentPoll}
            viewerId={viewerId}
          />
        </div>
      </div>
    </div>
  );
}
