'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getUnreadDmCount } from '@/app/actions/messages';
import { glassPillBase } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// DmInboxPill — Glass-Pill-Link zu /messages mit Unread-Badge (v1.w.UI.75).
//
// Client Component: pollt getUnreadDmCount alle 30s via TanStack Query
// (identisches Interval wie FeedSidebar). `initialCount` kommt vom Server
// (TopRightActions) für sofortiges Render ohne Hydration-Flicker.
//
// Badge-Logik:
//   - 0 → kein Badge (pill sieht sauber aus)
//   - 1–9 → Zahl anzeigen
//   - 10–99 → Zahl anzeigen
//   - 100+ → „99+" (verhindert Layout-Shift bei großem Count)
//
// Position des Badges: absolute top-0 right-0 – klassisches Notification-
// Dot-Pattern, gleiche Größe wie MobileBottomNav-Badge.
// -----------------------------------------------------------------------------

function formatBadge(n: number): string {
  if (n >= 100) return '99+';
  return n.toString();
}

interface DmInboxPillProps {
  initialCount: number;
}

export function DmInboxPill({ initialCount }: DmInboxPillProps) {
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
