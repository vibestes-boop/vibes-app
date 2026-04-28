'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUnreadNotificationCount } from '@/app/actions/notifications';
import { createClient } from '@/lib/supabase/client';
import { glassPillBase } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// NotifBellPill — Glass-Pill-Link zu /notifications mit Unread-Badge.
//
// v1.w.UI.93 — Realtime-Upgrade:
//   - Supabase postgres_changes INSERT auf notifications WHERE
//     recipient_id=eq.{viewerId} → invalidiert ['unread-notifs'] sofort.
//   - 60s-Polling bleibt als Fallback (Realtime-Disconnect, Tab-Hintergrund).
//   - channelRef verhindert Doppel-Subscriptions in React Strict-Mode.
//   - viewerId null → kein Channel (Anon-User, kein Realtime nötig).
// -----------------------------------------------------------------------------

function formatBadge(n: number): string {
  if (n >= 100) return '99+';
  return n.toString();
}

interface NotifBellPillProps {
  initialCount: number;
  viewerId: string | null;
}

export function NotifBellPill({ initialCount, viewerId }: NotifBellPillProps) {
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  useEffect(() => {
    if (!viewerId) return;

    const client = createClient();

    // Cleanup vorheriger Channel (Strict-Mode-Remount-Schutz)
    if (channelRef.current) {
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = client
      .channel(`notif-bell-${viewerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${viewerId}`,
        },
        () => {
          // Neue Notification → Badge sofort neu laden
          void qc.invalidateQueries({ queryKey: ['unread-notifs'] });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [viewerId, qc]);

  const { data: count = initialCount } = useQuery({
    queryKey: ['unread-notifs'],
    queryFn: () => getUnreadNotificationCount(),
    initialData: initialCount,
    refetchInterval: 60_000,
    staleTime: 50_000,
  });

  return (
    <Link
      href="/notifications"
      aria-label={
        count > 0
          ? `Benachrichtigungen — ${count} ungelesen`
          : 'Benachrichtigungen'
      }
      className={cn(
        glassPillBase,
        'pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-full',
      )}
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
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
