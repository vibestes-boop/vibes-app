'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  Users,
  Radio,
  MessageCircle,
  ShoppingBag,
  Bookmark,
  Hash,
  Settings,
  Store,
  PlusCircle,
  FileText,
  Clock,
  BarChart3,
  Coins,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpenConsentSettingsButton } from '@/components/consent/consent-banner';

// -----------------------------------------------------------------------------
// FeedSidebar — linke Navigation auf Desktop-Feed-Seiten.
// Rein strukturell — die einzelnen Ziele müssen nicht zwingend existieren;
// /messages, /live, /shop etc. kommen in späteren Phasen.
// -----------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: Route;
  icon: typeof Home;
  requiresAuth?: boolean;
  phase?: string; // "kommt in Phase X" — als Tooltip angezeigt, Button bleibt klickbar mit 404
}

const NAV: NavItem[] = [
  { label: 'Feed',        href: '/' as Route,            icon: Home },
  { label: 'Explore',     href: '/explore' as Route,     icon: Compass },
  { label: 'Pods',        href: '/guilds' as Route,      icon: Users },
  { label: 'Folge ich',   href: '/following' as Route,   icon: Users, phase: 'Phase 4', requiresAuth: true },
  { label: 'Live',        href: '/live' as Route,        icon: Radio },
  { label: 'Messages',    href: '/messages' as Route,    icon: MessageCircle, requiresAuth: true },
  { label: 'Post erstellen', href: '/create' as Route,   icon: PlusCircle, requiresAuth: true },
  { label: 'Entwürfe',    href: '/create/drafts' as Route, icon: FileText, requiresAuth: true },
  { label: 'Geplant',     href: '/create/scheduled' as Route, icon: Clock, requiresAuth: true },
  { label: 'Shop',        href: '/shop' as Route,        icon: ShoppingBag },
  { label: 'Creator Studio', href: '/studio' as Route,   icon: BarChart3, requiresAuth: true },
  { label: 'Mein Shop',   href: '/studio/shop' as Route, icon: Store, requiresAuth: true },
  { label: 'Live-Studio', href: '/studio/live' as Route, icon: Radio, requiresAuth: true },
  { label: 'Gemerkt',     href: '/shop/saved' as Route,  icon: Bookmark, requiresAuth: true },
  { label: 'Coin-Shop',   href: '/coin-shop' as Route,   icon: Coins },
  { label: 'Bezahlungen', href: '/settings/billing' as Route, icon: Receipt, requiresAuth: true },
  { label: 'Trending',    href: '/explore' as Route,     icon: Hash },
];

export function FeedSidebar({ viewerId }: { viewerId: string | null }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 flex h-[calc(100dvh-var(--site-header-h,64px))] flex-col gap-1 p-4">
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const disabled = item.requiresAuth && !viewerId;
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              aria-disabled={disabled}
              title={item.phase ? `${item.label} — ${item.phase}` : item.label}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                disabled && 'pointer-events-none opacity-40',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {viewerId && (
          <Link
            href={'/settings' as Route}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span>Einstellungen</span>
          </Link>
        )}

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-3 text-[11px] text-muted-foreground/80">
          <Link href={'/imprint' as Route} className="hover:text-foreground hover:underline">
            Impressum
          </Link>
          <Link href={'/privacy' as Route} className="hover:text-foreground hover:underline">
            Datenschutz
          </Link>
          <Link href={'/terms' as Route} className="hover:text-foreground hover:underline">
            AGB
          </Link>
          <OpenConsentSettingsButton className="hover:text-foreground hover:underline">
            Cookie-Einstellungen
          </OpenConsentSettingsButton>
        </div>
      </div>
    </div>
  );
}
