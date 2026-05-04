'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getUnreadDmCount } from '@/app/actions/messages';
import { glassPillBase } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// DmInboxPill — Glass-Pill-Link zu /messages mit Unread-Badge.
//
// v1.w.UI.246 — Global header badges stay polling-only. Realtime DM channels
// are reserved for `/messages`, where instant delivery matters and the user is
// already in the messaging workflow. Keeping the global shell off WebSockets
// removes the Supabase browser SDK from the home feed's first-load JS.
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
  const { data: count = initialCount } = useQuery({
    queryKey: ['unread-dms'],
    queryFn: () => getUnreadDmCount(),
    enabled: !!viewerId,
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
