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
  Settings,
  BarChart3,
  UserRound,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpenConsentSettingsButton } from '@/components/consent/consent-banner';

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
];

const SECONDARY_NAV: NavItem[] = [
  { label: 'Shop', href: '/shop' as Route, icon: ShoppingBag },
  { label: 'Pods', href: '/guilds' as Route, icon: Users },
  { label: 'Creator Studio', href: '/studio' as Route, icon: BarChart3, requiresAuth: true },
];

export function FeedSidebar({ viewerId }: { viewerId: string | null }) {
  const pathname = usePathname();
  const isActive = (href: Route) => pathname === href;

  return (
    <div className="sticky top-0 flex h-[100dvh] flex-col gap-4 p-4">
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
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              aria-disabled={disabled}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors',
                active
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                disabled && 'pointer-events-none opacity-40',
              )}
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Secondary Nav */}
      <div className="flex flex-col gap-1.5">
        <h2 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Mehr
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
      </div>

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
