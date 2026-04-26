'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getUnreadNotificationCount } from '@/app/actions/notifications';
import { glassPillBase } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// NotifBellPill — Glass-Pill-Link zu /notifications mit Unread-Badge (v1.w.UI.76).
//
// Analoges Muster zu DmInboxPill (v1.w.UI.75):
//   - Server rendert initialCount für flicker-freies erstes Paint.
//   - Client pollt alle 60s (Notifications weniger zeitkritisch als DMs —
//     identisches Interval + staleTime wie FeedSidebar).
//   - Badge-Format: 0 → kein Badge, 1–99 → Zahl, 100+ → „99+".
// -----------------------------------------------------------------------------

function formatBadge(n: number): string {
  if (n >= 100) return '99+';
  return n.toString();
}

interface NotifBellPillProps {
  initialCount: number;
}

export function NotifBellPill({ initialCount }: NotifBellPillProps) {
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
