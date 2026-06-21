'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { CoinIcon } from '@/components/ui/coin-icon';
import { ArrowLeft, Radio, Video, Wrench, PlayCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// -----------------------------------------------------------------------------
// LiveBrowseSidebar — Short-Video-style Left-Sidebar für /live Browse-Pages.
//
// Enthält:
//  • Zurück-Button (zum Feed)
//  • LIVE entdecken (Index)
//  • LIVE gehen (Start)
//  • Creator-Tools (Studio)
//  • Münzen holen CTA
//  • Gefolgte Accounts die gerade live sind
//  • Vorgeschlagene Live-Creator*innen
// -----------------------------------------------------------------------------

export type LiveSidebarSession = {
  id: string;
  host_id: string;
  host_username: string | null;
  host_display_name: string | null;
  host_avatar_url: string | null;
  viewer_count: number | null;
  title: string | null;
};

interface LiveBrowseSidebarProps {
  isAuthed: boolean;
  liveSessions: LiveSidebarSession[];
}

export function LiveBrowseSidebar({ isAuthed, liveSessions }: LiveBrowseSidebarProps) {
  const pathname = usePathname();
  const [showAll, setShowAll] = useState(false);

  const navItems = [
    { label: 'LIVE entdecken', href: '/live' as Route, icon: Radio },
    { label: 'LIVE gehen', href: (isAuthed ? '/live/start' : '/login?next=/live/start') as Route, icon: Video },
    { label: 'Creator-Tools', href: '/studio' as Route, icon: Wrench },
    { label: 'Replays', href: '/live/replays' as Route, icon: PlayCircle },
  ];

  const displayedSessions = showAll ? liveSessions : liveSessions.slice(0, 5);

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto px-2 py-4">
      {/* Zurück */}
      <Link
        href={'/' as Route}
        className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        <span>Zurück</span>
      </Link>

      {/* Nav Items */}
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href === '/live' && pathname === '/live');
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors',
              active
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {active && (
              <span aria-hidden="true" className="absolute left-0 h-5 w-[3px] rounded-r-full bg-brand-purple" />
            )}
            <Icon className={cn('h-6 w-6 shrink-0', active && 'text-foreground')} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      {/* Münzen-CTA */}
      <Link
        href={'/coin-shop' as Route}
        className="mx-1 mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-85"
      >
        <CoinIcon className="h-4 w-4" />
        Münzen holen
      </Link>

      {/* Live-Sessions von gefolgten/aktiven Creatorn */}
      {liveSessions.length > 0 && (
        <div className="mt-4 flex flex-col gap-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Jetzt live
          </p>
          {displayedSessions.map((s) => {
            const name = s.host_display_name ?? s.host_username ?? 'Unbekannt';
            const initial = name.slice(0, 1).toUpperCase();
            const viewers = s.viewer_count ?? 0;
            return (
              <Link
                key={s.id}
                href={`/live/${s.id}` as Route}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60"
              >
                {/* Avatar + roter Live-Ring */}
                <span className="relative shrink-0">
                  {s.host_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.host_avatar_url}
                      alt={name}
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-red-500 ring-offset-1 ring-offset-background"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[13px] font-bold text-muted-foreground ring-2 ring-red-500 ring-offset-1 ring-offset-background">
                      {initial}
                    </span>
                  )}
                  {/* Kleiner roter Dot unten rechts */}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 ring-1 ring-background">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{name}</p>
                  {s.host_username && (
                    <p className="truncate text-[11px] text-muted-foreground">@{s.host_username}</p>
                  )}
                </div>

                {/* Viewer Count */}
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {viewers >= 1000 ? `${(viewers / 1000).toFixed(1)}K` : viewers}
                </span>
              </Link>
            );
          })}

          {liveSessions.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAll && 'rotate-180')} />
              {showAll ? 'Weniger anzeigen' : `Alle anzeigen (${liveSessions.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
