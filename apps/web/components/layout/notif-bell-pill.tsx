'use client';

import { Bell } from 'lucide-react';
import { glassPillBase } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';
import { useUnreadShellCounts } from '@/components/layout/use-unread-shell-counts';
import { useNotificationsDrawer } from '@/lib/notifications-drawer-store';

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
  const { t } = useI18n();
  const { data: counts } = useUnreadShellCounts(viewerId, {
    dms: 0,
    notifications: initialCount,
  });
  const count = counts.notifications;

  const { toggleDrawer } = useNotificationsDrawer();

  return (
    <button
      type="button"
      onClick={toggleDrawer}
      aria-label={
        count > 0
          ? t('notif.unreadCountAria', { count })
          : t('notif.title')
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
          className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-brand-purple px-1 text-[10px] font-bold leading-none text-white"
          style={{ minHeight: '16px' }}
        >
          {formatBadge(count)}
        </span>
      )}
    </button>
  );
}
