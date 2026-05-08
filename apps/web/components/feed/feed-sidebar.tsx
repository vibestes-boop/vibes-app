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
  BarChart3,
  UserRound,
  Plus,
  Bell,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpenConsentSettingsButton } from '@/components/consent/consent-banner';
import { FollowedAccountsSection } from '@/components/feed/followed-accounts-section';
import { MoreMenu } from '@/components/layout/more-menu';
import type { FollowedAccount } from '@/lib/data/feed';
import { useUnreadShellCounts } from '@/components/layout/use-unread-shell-counts';

// -----------------------------------------------------------------------------
// FeedSidebar — linke Navigation auf Desktop-Feed-Seiten.
//
// v1.w.UI.10 Layout-Reset: Von 17 Einträgen auf 5 Primary + 3 Secondary
// runterkompaktiert. Power-User-Items (Entwürfe, Geplant, Mein Shop,
// Live-Studio, Gemerkt, Coin-Shop, Bezahlungen) leben jetzt im Avatar-
// Dropdown im SiteHeader, nicht mehr permanent hier.
//
// Prominenter „Posten"-CTA sitzt oben im Sidebar-Stack als Primary-Action-Pill
// (entspricht TikToks „+ Upload" auf Desktop). Damit fällt die DesktopNav
// Pill-Row im SiteHeader weg — keine Doppel-Navigation mehr.
// -----------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: Route;
  icon: typeof Home;
  requiresAuth?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'Für dich', href: '/' as Route, icon: Home },
  { label: 'Folge ich', href: '/following' as Route, icon: UserRound, requiresAuth: true },
  { label: 'Entdecken', href: '/explore' as Route, icon: Compass },
  { label: 'Live', href: '/live' as Route, icon: Radio },
  { label: 'Messages', href: '/messages' as Route, icon: MessageCircle, requiresAuth: true },
  { label: 'Benachrichtigungen', href: '/notifications' as Route, icon: Bell, requiresAuth: true },
];

const SECONDARY_NAV: NavItem[] = [
  { label: 'Shop', href: '/shop' as Route, icon: ShoppingBag },
  { label: 'Pods', href: '/guilds' as Route, icon: Users },
  { label: 'Women-Only Zone', href: '/woz' as Route, icon: ShieldCheck, requiresAuth: true },
  { label: 'Creator Studio', href: '/studio' as Route, icon: BarChart3, requiresAuth: true },
];

export function FeedSidebar({
  viewerId,
  followedAccounts,
  viewerIsAdmin = false,
}: {
  viewerId: string | null;
  /**
   * SSR-gefetchte Top-N gefolgte Accounts für den Sidebar-Bottom-Slot (TikTok-
   * Parity v1.w.UI.11 Phase B). Wenn null/undefined: Sektion wird nicht
   * gerendert (Logged-out, oder Page hat den Prefetch nicht durchgereicht).
   */
  followedAccounts?: FollowedAccount[];
  viewerIsAdmin?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: Route) => pathname === href;

  const { data: unreadCounts } = useUnreadShellCounts(viewerId);
  const unreadDms = unreadCounts.dms;
  const unreadNotifs = unreadCounts.notifications;

  return (
    <div className="sticky top-0 flex h-[100dvh] flex-col gap-4 overflow-y-auto p-4">
      {/*
       * Brand-Logo ganz oben — seit v1.w.UI.11 ersetzt die Sidebar den globalen
       * SiteHeader auf xl+. Logo sitzt da wo bisher im Header „Serlo" stand
       * (font-serif, tracking-tight), klick führt zurück zum Feed.
       */}
      <Link
        href={'/' as Route}
        aria-label="Serlo — zur Startseite"
        className="px-3 pt-1 font-serif text-2xl font-medium tracking-tight text-foreground hover:text-foreground/80"
      >
        Serlo
      </Link>

      {/* Upload-CTA — ersetzt die frühere DesktopNav-Pill-Row im Header */}
      <Link
        href={'/create' as Route}
        aria-disabled={!viewerId}
        aria-label="Neuen Post erstellen"
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-white shadow-elevation-1 transition-colors',
          'hover:bg-brand-gold/90',
          !viewerId && 'pointer-events-none opacity-40',
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        <span>Posten</span>
      </Link>

      {/* Primary Nav */}
      <nav className="flex flex-col gap-1" aria-label="Hauptnavigation">
        {PRIMARY_NAV.map((item) => {
          const disabled = item.requiresAuth && !viewerId;
          const active = isActive(item.href);
          const Icon = item.icon;
          const isMessages = item.href === '/messages';
          const isNotifs = item.href === '/notifications';
          const badgeCount = isMessages ? unreadDms : isNotifs ? unreadNotifs : 0;
          const badgeLabel = badgeCount > 99 ? '99+' : badgeCount;
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              aria-disabled={disabled}
              aria-current={active ? 'page' : undefined}
              aria-label={
                badgeCount > 0
                  ? `${item.label} (${badgeLabel} ungelesen)`
                  : item.label
              }
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors',
                active
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                disabled && 'pointer-events-none opacity-40',
              )}
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {badgeCount > 0 && (
                <span
                  aria-hidden="true"
                  className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-gold px-1.5 text-[11px] font-semibold leading-none text-white"
                >
                  {badgeLabel}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Secondary Nav */}
      <div className="flex flex-col gap-1.5">
        <h2 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Weiteres
        </h2>
        <nav className="flex flex-col gap-0.5" aria-label="Weitere Bereiche">
          {SECONDARY_NAV.map((item) => {
            const disabled = item.requiresAuth && !viewerId;
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                aria-disabled={disabled}
                aria-current={active ? 'page' : undefined}
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
        {/* v1.w.UI.246 — Admin-Panel-Link wird serverseitig entschieden. */}
        {viewerId && viewerIsAdmin && (
          <Link
            href={'/admin' as Route}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span>Admin-Panel</span>
          </Link>
        )}
      </div>

      {/*
       * „Konten, denen ich folge" — TikTok-Parity-Sektion (v1.w.UI.11 Phase B).
       * Nur für eingeloggte Viewer, nur wenn die Page den Prefetch durchreicht.
       * Sitzt konstruktiv ZWISCHEN Secondary-Nav und dem `mt-auto`-Footer,
       * damit sie bei kurzen Viewports mit dem Nav scrollt (Sidebar ist jetzt
       * `overflow-y-auto`) und bei großen Viewports bündig unter „Creator
       * Studio" klebt statt ans Footer-Ende gesaugt zu werden.
       */}
      {viewerId && followedAccounts && (
        <FollowedAccountsSection initial={followedAccounts} />
      )}

      <div className="mt-auto flex flex-col gap-1">
        {/*
         * v1.w.UI.12 — „Mehr"-Panel ersetzt den früheren Settings-Quicklink.
         * Öffnet ein Dropdown nach oben mit Einstellungen, Coins,
         * Darkmode-Toggle und Abmelden. Logged-out-Viewer sehen keinen
         * Trigger — sign-out hätte keinen Sinn und Coins wären auch leer.
         */}
        {viewerId && <MoreMenu />}

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
