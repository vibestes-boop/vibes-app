'use client';

// -----------------------------------------------------------------------------
// MobileBottomNav — 5-Slot-Tab-Bar am unteren Viewport-Rand, nur sichtbar
// unterhalb `md` (< 768px).
//
// Slot-Reihenfolge — Parität mit der nativen App-Bottom-Nav (lib/tabBarStore):
//   Feed | Guild | Create (Center) | Shop | Profil
//
// In der App sind Slot 2 (Guild) + Slot 4 (Shop) user-anpassbar; Slot 1/3/5
// (Feed/Create/Profil) sind fest. Diese Defaults (Guild + Shop) spiegeln wir
// hier 1:1. Die per-Account-Anpassung wird im nächsten Schritt DB-gesynct, dann
// rendert das Web Slot 2/4 aus derselben Config wie die App.
//
// Notifications („Inbox") sind aus der Bottom-Tab-Bar raus (in der App ebenfalls
// kein Default-Slot) — auf Web weiterhin über die Glocke in der Kopfzeile
// erreichbar.
//
// Auth-Gating: Create + Shop + Profil sind authOnly.
// Logged-out: Feed | Explore | Shop (Fallback für anonyme Discovery).
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
  Users,
  User as UserIcon,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

type Slot = {
  href: string;
  labelKey: TranslationKey;
  icon: typeof Home;
  authOnly?: boolean;
  /** "Create" ist der zentrale Primary-Slot, visuell hervorgehoben. */
  primary?: boolean;
};

// Authed-Reihenfolge: Feed | Guild | Create | Shop | Profil (App-Default-Parität)
const SLOTS_AUTHED: Slot[] = [
  { href: '/',        labelKey: 'nav.feed',    icon: Home },
  { href: '/guilds',  labelKey: 'nav.guilds',  icon: Users },
  { href: '/create',  labelKey: 'nav.create',  icon: PlusSquare,  authOnly: true, primary: true },
  { href: '/shop',    labelKey: 'nav.shop',    icon: ShoppingBag, authOnly: true },
  { href: '/profile', labelKey: 'nav.profile', icon: UserIcon,    authOnly: true },
];

// Logged-out: Feed | Explore | Shop (3 Slots — Create + Profil sind sinnlos)
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

          const sharedClassName = cn(
            'flex h-14 flex-col items-center justify-center gap-0.5',
            'transition-colors duration-fast ease-out-expo',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            slot.primary
              ? 'text-foreground'
              : active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
          );
          const innerContent = slot.primary ? (
            // Serlo-Marken-Plus (Pink→Lila), konsistent mit der nativen
            // App-Bottom-Nav (NICHT TikToks cyan/rot — Trade-Dress).
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-rose to-brand-purple text-white shadow-elevation-2">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : (
            <>
              <Icon
                className={cn('h-5 w-5', active ? 'stroke-[2.25]' : 'stroke-[1.75]')}
                aria-hidden="true"
              />
              <span className={cn('text-[10px] leading-none', active ? 'font-semibold' : 'font-medium')}>
                {label}
              </span>
            </>
          );

          return (
            <li key={slot.href} className="flex-1">
              <Link
                href={slot.href as Route}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                className={sharedClassName}
              >
                {innerContent}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
