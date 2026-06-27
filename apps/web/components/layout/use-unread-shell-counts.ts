'use client';

import { useEffect, useRef, useState } from 'react';
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

export function useUnreadShellCounts(
  viewerId: string | null,
  initialCounts: UnreadShellCounts = EMPTY_COUNTS,
) {
  const [afterFirstPaint, setAfterFirstPaint] = useState(false);
  const queryClient = useQueryClient();
  // Eindeutiger Channel-Name PRO Hook-Instanz. Der Hook läuft auf einer Seite
  // mehrfach (Bell-Pill + DM-Pill + Sidebar); ein geteilter Name → Supabase ruft
  // `.on()` auf einem schon subscribten Channel → wirft „cannot add postgres_changes
  // callbacks after subscribe()" und crasht die Seite. Random-Suffix verhindert das.
  const channelName = useRef(`shell-counts-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!viewerId) {
      setAfterFirstPaint(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setAfterFirstPaint(true);
    }, 1_500);

    return () => window.clearTimeout(timeout);
  }, [viewerId]);

  // Realtime: neue Benachrichtigung → Badge sofort aktualisieren (statt erst beim
  // 120-Sek-Poll). Ohne das blieb der Glocken-Zähler leer, obwohl ein Ping da war.
  useEffect(() => {
    if (!viewerId) return;
    const client = createClient();
    // Realtime ist optional — Fehler dürfen die Shell NIE crashen (try/catch).
    let channel: ReturnType<typeof client.channel> | null = null;
    try {
      channel = client
        .channel(channelName)
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
      // Realtime nicht verfügbar → der 120-Sek-Poll hält den Badge trotzdem aktuell.
    }
    return () => {
      try {
        if (channel) client.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [viewerId, queryClient, channelName]);

  return useQuery({
    queryKey: ['unread-shell-counts'],
    queryFn: () => getUnreadShellCounts(),
    enabled: Boolean(viewerId) && afterFirstPaint,
    initialData: initialCounts,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
  });
}
