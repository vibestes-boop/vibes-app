'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUnreadDmCount } from '@/app/actions/messages';
import { createClient } from '@/lib/supabase/client';
import { glassPillBase } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// DmInboxPill — Glass-Pill-Link zu /messages mit Unread-Badge.
//
// v1.w.UI.96 — Realtime-Upgrade (analog NotifBellPill v1.w.UI.93):
//   - sendDirectMessage() broadcastet nach erfolgreichem INSERT auf
//     Channel `user-inbox-{recipientId}` ein `new_dm`-Event.
//   - DmInboxPill abonniert diesen persönlichen Channel und invalidiert
//     ['unread-dms'] sofort → Badge-Update ohne 30s-Warten.
//   - 30s-Polling bleibt als Fallback (Reconnect, Hintergrund-Tab).
//   - viewerId null → kein Channel (Anon-User).
// -----------------------------------------------------------------------------

function formatBadge(n: number): string {
  if (n >= 100) return '99+';
  return n.toString();
}

interface DmInboxPillProps {
  initialCount: number;
  viewerId: string | null;
}

export function DmInboxPill({ initialCount, viewerId }: DmInboxPillProps) {
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  useEffect(() => {
    if (!viewerId) return;

    const client = createClient();

    // Strict-Mode-Schutz: alten Channel erst entfernen
    if (channelRef.current) {
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = client
      .channel(`user-inbox-${viewerId}`)
      .on('broadcast', { event: 'new_dm' }, () => {
        // Neues DM eingegangen → Badge sofort neu laden
        void qc.invalidateQueries({ queryKey: ['unread-dms'] });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [viewerId, qc]);

  const { data: count = initialCount } = useQuery({
    queryKey: ['unread-dms'],
    queryFn: () => getUnreadDmCount(),
    initialData: initialCount,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  return (
    <Link
      href="/messages"
      aria-label={
        count > 0
          ? `Nachrichten — ${count} ungelesen`
          : 'Nachrichten'
      }
      className={cn(
        glassPillBase,
        'pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-full',
      )}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
          style={{ minHeight: '16px' }}
        >
          {formatBadge(count)}
        </span>
      )}
    </Link>
  );
}
