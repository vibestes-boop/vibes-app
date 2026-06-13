'use client';

// -----------------------------------------------------------------------------
// MobileBottomNav — 5-Slot-Tab-Bar am unteren Viewport-Rand, nur sichtbar
// unterhalb `md` (< 768px).
//
// Slot-Reihenfolge (TikTok-Parität, v1.w.UI.39):
//   Home | Explore | Create (Center) | Inbox | Profil
//
// „Inbox" ersetzt den früheren „Shop"-Slot. Shop bleibt über die FeedSidebar
// auf Desktop und über das Profil-Menü auf Mobile erreichbar — für die
// Bottom-Tab-Bar ist der Engagement-Loop (Benachrichtigungen + DMs) wertvoller
// als ein Commerce-Einstieg, der ohne aktive Session kaum genutzt wird.
//
// Unread-Badge: kombiniert Notifs + DMs, aber bewusst clientseitig nach dem
// ersten Paint. So blockieren Count-RPCs nicht den initialen Root-Layout-Render.
// Badge erscheint als roter Dot über dem Inbox-Icon (Instagram-Pattern) — keine
// Zahl auf Mobile, zu wenig Platz bei kleinen Icons. Screen-Reader bekommt die
// Zahl über aria-label.
//
// Auth-Gating: Create + Inbox + Profil sind authOnly.
// Logged-out: Home | Explore | Shop (fallback für anonyme Discovery)
//
// Safe-Area: `pb-[env(safe-area-inset-bottom)]` respektiert iOS-Home-Indicator.
// -----------------------------------------------------------------------------

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  PlusSquare,
  Bell,
  User as UserIcon,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';
import { useUnreadShellCounts } from '@/components/layout/use-unread-shell-counts';
import { useNotificationsDrawer } from '@/lib/notifications-drawer-store';

type Slot = {
  href: string;
  labelKey: TranslationKey;
  icon: typeof Home;
  authOnly?: boolean;
  /** "Create" ist der zentrale Primary-Slot, visuell hervorgehoben. */
  primary?: boolean;
  /** Slot bekommt einen Unread-Badge-Dot wenn unreadCount > 0. */
  hasBadge?: boolean;
  /** Wenn gesetzt, wird statt einem Link ein Button gerendert. */
  isDrawer?: boolean;
};

// Authed-Reihenfolge: Home | Explore | Create | Inbox | Profil
const SLOTS_AUTHED: Slot[] = [
  { href: '/',              labelKey: 'nav.feed',    icon: Home },
  { href: '/explore',       labelKey: 'nav.explore', icon: Compass },
  { href: '/create',        labelKey: 'nav.create',  icon: PlusSquare,  authOnly: true, primary: true },
  { href: '/notifications', labelKey: 'nav.inbox',   icon: Bell,        authOnly: true, hasBadge: true, isDrawer: true },
  { href: '/profile',       labelKey: 'nav.profile', icon: UserIcon,    authOnly: true },
];

// Logged-out: Home | Explore | Shop (3 Slots — Create + Inbox + Profil sind sinnlos)
const SLOTS_ANON: Slot[] = [
  { href: '/',        labelKey: 'nav.feed',    icon: Home },
  { href: '/explore', labelKey: 'nav.explore', icon: Compass },
  { href: '/shop',    labelKey: 'nav.shop',    icon: ShoppingBag },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/profile') {
    return pathname === '/profile' || pathname === '/onboarding' || pathname.startsWith('/u/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({
  isAuthed,
}: {
  isAuthed: boolean | null;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { data: unreadCounts } = useUnreadShellCounts(isAuthed === true ? 'mobile' : null);
  const unreadCount = unreadCounts.dms + unreadCounts.notifications;
  const { toggleDrawer: toggleNotifications, open: notifDrawerOpen } = useNotificationsDrawer();

  const slots = isAuthed === false
    ? SLOTS_ANON
    : SLOTS_AUTHED;

  return (
    <nav
      aria-label={t('nav.main')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 md:hidden',
        'pb-[env(safe-area-inset-bottom)]',
        'border-t border-border/60 bg-background/90 backdrop-blur-lg',
      )}
    >
      <ul className="flex items-stretch justify-around">
        {slots.map((slot) => {
          const Icon = slot.icon;
          const active = isActive(pathname, slot.href);
          const label = t(slot.labelKey);
          const showBadge = slot.hasBadge && unreadCount > 0;

          const isDrawerActive = slot.isDrawer && notifDrawerOpen;
          const effectiveActive = slot.isDrawer ? isDrawerActive : active;
          const sharedClassName = cn(
            'flex h-14 flex-col items-center justify-center gap-0.5',
            'transition-colors duration-fast ease-out-expo',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            slot.primary
              ? 'text-foreground'
              : effectiveActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
          );
          const innerContent = slot.primary ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-elevation-2">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : (
            <>
              <span className="relative">
                <Icon
                  className={cn(
                    'h-5 w-5',
                    effectiveActive ? 'stroke-[2.25]' : 'stroke-[1.75]',
                  )}
                  aria-hidden="true"
                />
                {showBadge && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand-purple ring-2 ring-background"
                  />
                )}
              </span>
              <span className={cn('text-[10px] leading-none', effectiveActive ? 'font-semibold' : 'font-medium')}>
                {label}
              </span>
            </>
          );

          return (
            <li key={slot.href} className="flex-1">
              {slot.isDrawer ? (
                <button
                  type="button"
                  onClick={toggleNotifications}
                  aria-label={showBadge ? `${label} (${unreadCount > 99 ? '99+' : unreadCount} ungelesen)` : label}
                  className={cn(sharedClassName, 'w-full')}
                >
                  {innerContent}
                </button>
              ) : (
                <Link
                  href={slot.href as Route}
                  aria-current={effectiveActive ? 'page' : undefined}
                  aria-label={showBadge ? `${label} (${unreadCount > 99 ? '99+' : unreadCount} ungelesen)` : label}
                  className={sharedClassName}
                >
                  {innerContent}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
