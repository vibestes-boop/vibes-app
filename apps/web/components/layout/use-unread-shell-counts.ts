'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getUnreadShellCounts,
  type UnreadShellCounts,
} from '@/app/actions/unread-counts';
import { createClient } from '@/lib/supabase/client';

const EMPTY_COUNTS: UnreadShellCounts = {
  dms: 0,
  notifications: 0,
};

// -----------------------------------------------------------------------------
// Kosten-Optimierung: EINE geteilte Realtime-Subscription statt drei.
//
// `useUnreadShellCounts` läuft pro Seite mehrfach (Bell-Pill + DM-Pill +
// Sidebar). Früher öffnete JEDE Instanz einen eigenen notifications-Realtime-
// Kanal → jeder eingeloggte User hielt 3 identische Subscriptions offen, jede
// Notification wurde 3× zugestellt (3× Concurrent-Connections + 3× Messages).
//
// Jetzt: die Realtime-Subscription lebt EINMAL in `useUnreadShellRealtime`
// (aufgerufen einmal in AppAuthShell). Die Consumer lesen nur noch die — ohnehin
// per Query-Key deduplizierte — Query. Realtime pro User: 3 → 1.
// -----------------------------------------------------------------------------

/**
 * Query-Read der Shell-Zähler (DMs + Notifications). KEINE Realtime-Subscription
 * mehr — die lebt zentral in `useUnreadShellRealtime`. Beliebig oft aufrufbar.
 */
export function useUnreadShellCounts(
  viewerId: string | null,
  initialCounts: UnreadShellCounts = EMPTY_COUNTS,
) {
  const [afterFirstPaint, setAfterFirstPaint] = useState(false);

  useEffect(() => {
    if (!viewerId) {
      setAfterFirstPaint(false);
      return;
    }
    const timeout = window.setTimeout(() => setAfterFirstPaint(true), 1_500);
    return () => window.clearTimeout(timeout);
  }, [viewerId]);

  return useQuery({
    queryKey: ['unread-shell-counts'],
    queryFn: () => getUnreadShellCounts(),
    enabled: Boolean(viewerId) && afterFirstPaint,
    initialData: initialCounts,
    staleTime: 60_000,
    // Realtime hält den Badge aktuell → Poll nur als Sicherheitsnetz (5 statt 2 Min).
    refetchInterval: 300_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * EINE zentrale Realtime-Subscription für die Shell-Zähler. Genau EINMAL pro
 * eingeloggter Session aufrufen (AppAuthShell). Neue Notification/DM (beides
 * erzeugt eine notifications-Zeile, DMs mit type='dm') → geteilte Query
 * invalidieren, alle Pills/Sidebar aktualisieren sich.
 */
export function useUnreadShellRealtime(viewerId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!viewerId) return;
    const client = createClient();
    // Realtime ist optional — Fehler dürfen die Shell NIE crashen (try/catch).
    let channel: ReturnType<typeof client.channel> | null = null;
    try {
      channel = client
        .channel(`shell-counts-${viewerId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${viewerId}`,
          },
          () => {
            void queryClient.invalidateQueries({ queryKey: ['unread-shell-counts'] });
          },
        )
        .subscribe();
    } catch {
      // Realtime nicht verfügbar → der 5-Min-Poll hält den Badge trotzdem aktuell.
    }
    return () => {
      try {
        if (channel) client.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [viewerId, queryClient]);
}
