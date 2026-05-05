'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { glassPillBase } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';
import { useUnreadShellCounts } from '@/components/layout/use-unread-shell-counts';

// -----------------------------------------------------------------------------
// NotifBellPill — Glass-Pill-Link zu /notifications mit Unread-Badge.
//
// v1.w.UI.246 — Global header badges stay polling-only. Notifications still
// refresh regularly, while realtime subscriptions stay scoped to pages that
// actually need live updates. This keeps the home feed's global shell free of
// WebSockets and the Supabase browser SDK on first load.
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
  const { data: counts } = useUnreadShellCounts(viewerId, {
    dms: 0,
    notifications: initialCount,
  });
  const count = counts.notifications;

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
