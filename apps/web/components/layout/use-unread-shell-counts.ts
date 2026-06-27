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

export function useUnreadShellCounts(
  viewerId: string | null,
  initialCounts: UnreadShellCounts = EMPTY_COUNTS,
) {
  const [afterFirstPaint, setAfterFirstPaint] = useState(false);
  const queryClient = useQueryClient();

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
    const channel = client
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
    return () => {
      client.removeChannel(channel);
    };
  }, [viewerId, queryClient]);

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
