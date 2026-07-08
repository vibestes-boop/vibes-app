'use client';

import { useState } from 'react';
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
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpenConsentSettingsButton } from '@/components/consent/consent-banner';
import { FollowedAccountsSection } from '@/components/feed/followed-accounts-section';
import { MoreMenu } from '@/components/layout/more-menu';
import type { FollowedAccount } from '@/lib/data/feed';
import { useUnreadShellCounts } from '@/components/layout/use-unread-shell-counts';
import { useNotificationsDrawer } from '@/lib/notifications-drawer-store';
import { useI18n } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';
import { useRouter } from 'next/navigation';

// -----------------------------------------------------------------------------
// FeedSidebar — linke Navigation auf Desktop-Feed-Seiten.
//
// v1.w.UI.10 Layout-Reset: Von 17 Einträgen auf 5 Primary + 3 Secondary
// runterkompaktiert. Power-User-Items (Entwürfe, Geplant, Mein Shop,
// Live-Studio, Gemerkt, Coin-Shop, Bezahlungen) leben jetzt im Avatar-
// Dropdown im SiteHeader, nicht mehr permanent hier.
//
// Prominenter „Posten"-CTA sitzt oben im Sidebar-Stack als Primary-Action-Pill
// (entspricht Short-Videos „+ Upload" auf Desktop). Damit fällt die DesktopNav
// Pill-Row im SiteHeader weg — keine Doppel-Navigation mehr.
//
// v1.w.UI.Short-Video-Mehr: Clicking "Mehr" collapses sidebar to icon-only mode
// and slides in a settings panel beside the icon strip.
// -----------------------------------------------------------------------------

interface NavItem {
  /** i18n-Key — wird am Renderpunkt via t() aufgelöst (Modul-Konstante kann nicht selbst übersetzen). */
  labelKey: TranslationKey;
  href: Route;
  icon: typeof Home;
  requiresAuth?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { labelKey: 'feed.forYou', href: '/' as Route, icon: Home },
  { labelKey: 'feed.followingTab', href: '/following' as Route, icon: UserRound, requiresAuth: true },
  { labelKey: 'feed.friends', href: '/friends' as Route, icon: Users, requiresAuth: true },
  { labelKey: 'nav.explore', href: '/explore' as Route, icon: Compass },
  { labelKey: 'nav.live', href: '/live' as Route, icon: Radio },
  { labelKey: 'nav.messages', href: '/messages' as Route, icon: MessageCircle, requiresAuth: true },
  // Benachrichtigungen wird als Drawer-Button gerendert (kein href)
];

const SECONDARY_NAV: NavItem[] = [
  { labelKey: 'nav.shop', href: '/shop' as Route, icon: ShoppingBag },
  { labelKey: 'sidebar.pods', href: '/guilds' as Route, icon: Users },
  { labelKey: 'sidebar.womenOnlyZone', href: '/woz' as Route, icon: ShieldCheck, requiresAuth: true },
  { labelKey: 'nav.studio', href: '/studio' as Route, icon: BarChart3, requiresAuth: true },
];

export type SidebarViewerProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export function FeedSidebar({
  viewerId,
  viewerProfile,
  followedAccounts,
  viewerIsAdmin = false,
  railCollapsible = false,
}: {
  viewerId: string | null;
  /** Profil-Daten für den Profil-Button mit Avatar. */
  viewerProfile?: SidebarViewerProfile | null;
  /**
   * SSR-gefetchte Top-N gefolgte Accounts für den Sidebar-Bottom-Slot (Short-Video-
   * Parity v1.w.UI.11 Phase B). Wenn null/undefined: Sektion wird nicht
   * gerendert (Logged-out, oder Page hat den Prefetch nicht durchgereicht).
   */
  followedAccounts?: FollowedAccount[];
  viewerIsAdmin?: boolean;
  /**
   * v1.w.UI.x — Schmale-Rail-Modus: Sidebar startet icon-only (w-20) und klappt
   * beim Hover als Overlay auf. Gesetzt auf Seiten mit eigener zweiter Sidebar
   * (Shop-Katalog mit Filter-Spalte), damit nicht zwei breite Sidebars kollidieren.
   */
  railCollapsible?: boolean;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: Route) => pathname === href;
  const [hovered, setHovered] = useState(false);

  const { data: unreadCounts } = useUnreadShellCounts(viewerId);
  const unreadDms = unreadCounts.dms;
  const unreadNotifs = unreadCounts.notifications;
  const { toggleDrawer: toggleNotifications, open: notifDrawerOpen } = useNotificationsDrawer();

  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = () => setMoreOpen(false);
  const toggleMore = () => setMoreOpen((v) => !v);

  // Visuell icon-only, wenn entweder das Mehr-Panel offen ist ODER der Schmale-
  // Rail-Modus aktiv ist und gerade NICHT gehovert wird (Hover klappt auf).
  const iconOnly = moreOpen || (railCollapsible && !hovered);

  return (
    <div
      onMouseEnter={railCollapsible ? () => setHovered(true) : undefined}
      onMouseLeave={railCollapsible ? () => setHovered(false) : undefined}
      className={cn(
      // Icon-Strip-Modus: Sidebar wird w-20 (80px) schmal, behält aber p-4 + px-3
      // der Items bei — Icons bleiben EXAKT an derselben Position (kein Springen).
      'sticky top-0 flex h-[100dvh] flex-col gap-2 overflow-y-auto p-4 transition-all duration-200',
      // Schmale-Rail-Modus (Shop): feste Breiten + Overlay (z-40, bg, border),
      // damit das Aufklappen den Content NICHT verschiebt. Sonst: nur Mehr-Panel.
      railCollapsible
        ? cn('z-40 border-r border-border bg-card', iconOnly ? 'w-20' : 'w-[260px] shadow-elevation-2')
        : (moreOpen && 'w-20 bg-card'),
    )}>
      {/*
       * Brand-Logo ganz oben — seit v1.w.UI.11 ersetzt die Sidebar den globalen
       * SiteHeader auf xl+. Im Icon-Strip-Modus bleibt nur das „S" stehen —
       * gleiche Klassen, gleiche Position (das S von „Serlo" bewegt sich nicht).
       */}
      <Link
        href={'/' as Route}
        aria-label={t('sidebar.homeAria')}
        className="px-3 pt-1 font-serif text-2xl font-medium tracking-tight text-foreground hover:text-foreground/80"
      >
        {iconOnly ? 'S' : 'Serlo'}
      </Link>

      {/* Suchfeld — im Icon-Strip-Modus nur das Lupen-Icon an identischer
          Stelle (h-9 = Input-Höhe, px-3 + h-4-Icon = Position des Input-Icons) */}
      {iconOnly ? (
        <Link
          href={'/search' as Route}
          aria-label={t('sidebar.searchAria')}
          className="flex h-9 items-center rounded-lg px-3 text-foreground hover:bg-muted/60"
        >
          <span className="flex w-8 shrink-0 justify-center">
            <Search className="h-4 w-4" />
          </span>
        </Link>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim();
            if (q) router.push(`/search?q=${encodeURIComponent(q)}` as Route);
          }}
          className="relative"
        >
          {/* left-5: Icon-Mitte auf derselben Achse wie die w-8-Icon-Slots der Nav-Zeilen */}
          <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            placeholder={t('sidebar.searchPlaceholder')}
            defaultValue=""
            className="h-9 w-full rounded-lg bg-muted/60 pl-12 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </form>
      )}

      {/* Upload-CTA — schwarzes Plus-Quadrat (identisch in beiden Modi),
          daneben „Posten" als Label statt durchgezogener Button (Short-Video-Stil) */}
      <Link
        href={'/create' as Route}
        aria-disabled={!viewerId}
        aria-label={t('sidebar.newPostAria')}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted/60',
          !viewerId && 'pointer-events-none opacity-40',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-elevation-1">
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </span>
        {!iconOnly && <span>{t('sidebar.post')}</span>}
      </Link>

      {/* Primary Nav — inkl. Benachrichtigungen (Drawer) + Profil (Avatar) */}
      <nav className="flex flex-col gap-0.5" aria-label={t('nav.main')}>
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
              key={`${item.labelKey}-${item.href}`}
              href={item.href}
              aria-disabled={disabled}
              aria-current={active ? 'page' : undefined}
              aria-label={
                badgeCount > 0
                  ? `${t(item.labelKey)} (${badgeLabel} ${t('sidebar.unread')})`
                  : t(item.labelKey)
              }
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors',
                // Short-Video-Stil: Items schwarz, aktives Item in Brand-Farbe
                active
                  ? 'font-semibold text-brand-purple'
                  : 'text-foreground hover:bg-muted/60',
                disabled && 'pointer-events-none opacity-40',
              )}
            >
              {active && !iconOnly && (
                <span aria-hidden="true" className="absolute left-0 h-5 w-[3px] rounded-r-full bg-brand-purple" />
              )}
              {/* w-8-Icon-Slot: alle Icons (verschiedene Größen) auf einer Mittelachse */}
              <span className="flex w-8 shrink-0 justify-center">
                <Icon className="h-6 w-6" />
              </span>
              {!iconOnly && <span className="flex-1 truncate">{t(item.labelKey)}</span>}
              {!iconOnly && badgeCount > 0 && (
                <span
                  aria-hidden="true"
                  className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-purple px-1.5 text-[11px] font-semibold leading-none text-white"
                >
                  {badgeLabel}
                </span>
              )}
            </Link>
          );
        })}

        {/* Benachrichtigungen — Drawer-Button, gleiche Höhe wie Nav-Links */}
        {viewerId && (
          <button
            type="button"
            onClick={toggleNotifications}
            aria-label={unreadNotifs > 0 ? `${t('sidebar.notifications')} (${unreadNotifs} ${t('sidebar.unread')})` : t('sidebar.notifications')}
            className={cn(
              'relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors',
              notifDrawerOpen
                ? 'font-semibold text-brand-purple'
                : 'text-foreground hover:bg-muted/60',
            )}
          >
            {notifDrawerOpen && !iconOnly && (
              <span aria-hidden="true" className="absolute left-0 h-5 w-[3px] rounded-r-full bg-brand-purple" />
            )}
            <span className="flex w-8 shrink-0 justify-center">
              <Bell className="h-6 w-6" />
            </span>
            {!iconOnly && <span className="flex-1 truncate text-left">{t('sidebar.notifications')}</span>}
            {!iconOnly && unreadNotifs > 0 && (
              <span
                aria-hidden="true"
                className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-purple px-1.5 text-[11px] font-semibold leading-none text-white"
              >
                {unreadNotifs > 99 ? '99+' : unreadNotifs}
              </span>
            )}
          </button>
        )}

        {/* Profil-Button mit Avatar */}
        {viewerId && (
          <Link
            href={viewerProfile?.username ? `/u/${viewerProfile.username}` as Route : '/onboarding' as Route}
            aria-current={pathname.startsWith('/u/') || pathname === '/profile' ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors',
              pathname.startsWith('/u/') || pathname === '/profile'
                ? 'font-semibold text-brand-purple'
                : 'text-foreground hover:bg-muted/60',
            )}
          >
            {(pathname.startsWith('/u/') || pathname === '/profile') && !iconOnly && (
              <span aria-hidden="true" className="absolute left-0 h-5 w-[3px] rounded-r-full bg-brand-purple" />
            )}
            <span className="flex w-8 shrink-0 justify-center">
              {viewerProfile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewerProfile.avatar_url}
                  alt={viewerProfile.display_name ?? viewerProfile.username ?? t('nav.profile')}
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground ring-1 ring-border">
                  {(viewerProfile?.display_name ?? viewerProfile?.username ?? '?').slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            {!iconOnly && <span className="flex-1 truncate">{t('nav.profile')}</span>}
          </Link>
        )}

        {/* Mehr-Button — direkt unter Profil */}
        {viewerId && (
          <MoreMenu open={moreOpen} onToggle={toggleMore} onClose={closeMore} />
        )}
      </nav>

      {/* Secondary Nav — im Icon-Strip-Modus nur Icons; der Header bleibt als
          unsichtbarer Platzhalter stehen, damit nichts vertikal verrutscht */}
      <div className="flex flex-col gap-1.5">
        <h2 className={cn(
          'px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80',
          iconOnly && 'invisible',
        )}>
          {t('sidebar.moreSection')}
        </h2>
        <nav className="flex flex-col gap-0.5" aria-label={t('sidebar.moreAreasAria')}>
          {SECONDARY_NAV.map((item) => {
            const disabled = item.requiresAuth && !viewerId;
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.labelKey}-${item.href}`}
                href={item.href}
                aria-disabled={disabled}
                aria-current={active ? 'page' : undefined}
                aria-label={t(item.labelKey)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'font-semibold text-brand-purple'
                    : 'text-foreground hover:bg-muted',
                  disabled && 'pointer-events-none opacity-40',
                )}
              >
                <span className="flex w-8 shrink-0 justify-center">
                  <Icon className="h-5 w-5" />
                </span>
                {!iconOnly && <span className="truncate">{t(item.labelKey)}</span>}
              </Link>
            );
          })}
        </nav>
        {/* v1.w.UI.246 — Admin-Panel-Link wird serverseitig entschieden. */}
        {viewerId && viewerIsAdmin && (
          <Link
            href={'/admin' as Route}
            aria-label={t('sidebar.adminPanel')}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-foreground hover:bg-muted',
            )}
          >
            <span className="flex w-8 shrink-0 justify-center">
              <ShieldCheck className="h-5 w-5" />
            </span>
            {!iconOnly && <span>{t('sidebar.adminPanel')}</span>}
          </Link>
        )}
      </div>

      {/*
       * „Konten, denen ich folge" — Short-Video-Parity-Sektion (v1.w.UI.11 Phase B).
       * Nur für eingeloggte Viewer, nur wenn die Page den Prefetch durchreicht.
       * Hidden when more panel is open.
       */}
      {viewerId && followedAccounts && !iconOnly && (
        <FollowedAccountsSection initial={followedAccounts} />
      )}

      <div className="mt-auto flex flex-col gap-1">
        {!iconOnly && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 text-[11px] text-muted-foreground/80">
            <Link href={'/imprint' as Route} className="hover:text-foreground hover:underline">
              Impressum
            </Link>
            <Link href={'/privacy' as Route} className="hover:text-foreground hover:underline">
              Datenschutz
            </Link>
            <Link href={'/terms' as Route} className="hover:text-foreground hover:underline">
              AGB
            </Link>
            <Link href={'/support' as Route} className="hover:text-foreground hover:underline">
              Support
            </Link>
            <OpenConsentSettingsButton className="hover:text-foreground hover:underline">
              Cookie-Einstellungen
            </OpenConsentSettingsButton>
          </div>
        )}
      </div>
    </div>
  );
}
