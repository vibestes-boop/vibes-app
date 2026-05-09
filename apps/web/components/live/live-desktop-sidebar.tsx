import Link from 'next/link';
import type { Route } from 'next';
import {
  ArrowLeft,
  Coins,
  Compass,
  MoreHorizontal,
  Radio,
  Sparkles,
  Video,
  Wrench,
} from 'lucide-react';

import { FollowedAccountsSection } from '@/components/feed/followed-accounts-section';
import type { FollowedAccount } from '@/lib/data/feed';
import { cn } from '@/lib/utils';

interface LiveDesktopSidebarProps {
  followedAccounts: FollowedAccount[];
  viewerId: string | null;
  coinBalance: number | null;
}

const navItems = [
  { href: '/live', label: 'LIVE entdecken', icon: Radio },
  { href: '/live/start', label: 'LIVE gehen', icon: Video },
  { href: '/studio/live', label: 'Creator-Tools', icon: Wrench },
  { href: '/explore', label: 'Entdecken', icon: Compass },
] as const;

export function LiveDesktopSidebar({
  followedAccounts,
  viewerId,
  coinBalance,
}: LiveDesktopSidebarProps) {
  return (
    <aside className="hidden h-[100dvh] min-h-0 w-full shrink-0 flex-col border-r bg-background px-5 py-6 xl:sticky xl:top-0 xl:flex">
      <Link
        href={'/live' as Route}
        className="mb-7 inline-flex items-center gap-3 text-2xl font-black tracking-tight text-foreground"
        aria-label="Serlo Live"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <span>Serlo Live</span>
      </Link>

      <Link
        href={'/' as Route}
        className="mb-5 inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Zurück
      </Link>

      <nav aria-label="Live Navigation" className="flex flex-col gap-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const href =
            item.href === '/live/start' && !viewerId
              ? (`/login?next=${encodeURIComponent(item.href)}` as Route)
              : (item.href as Route);

          return (
            <Link
              key={item.href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
          Mehr
        </button>
      </nav>

      <Link
        href={(viewerId ? '/coin-shop' : '/login?next=%2Fcoin-shop') as Route}
        className={cn(
          'mt-7 flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-3 text-sm font-bold text-white shadow-elevation-1 transition hover:bg-rose-600',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500',
        )}
      >
        <Coins className="h-4 w-4" aria-hidden="true" />
        <span>Münzen holen</span>
        {typeof coinBalance === 'number' && (
          <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] tabular-nums">
            {coinBalance.toLocaleString('de-DE')}
          </span>
        )}
      </Link>

      <div className="my-6 h-px bg-border" />

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {viewerId ? (
          <FollowedAccountsSection initial={followedAccounts} />
        ) : (
          <div className="rounded-lg bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
            Melde dich an, um deine gefolgten Lives und Creator schneller zu finden.
          </div>
        )}
      </div>
    </aside>
  );
}
