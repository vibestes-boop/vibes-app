'use client';

// -----------------------------------------------------------------------------
// MobileBottomNav — 5-Slot-Tab-Bar am unteren Viewport-Rand, nur sichtbar
// unterhalb `md` (< 768px).
//
// Warum: Die existierende Hamburger-Nav (`MobileNav` in site-header.tsx) ist
// die Standard-Pattern aus Desktop-Web-Design, aber auf Mobile-Social-Apps
// (TikTok, Instagram, Twitter, YouTube) ist eine persistente Bottom-Bar
// unverhandelbar. Grund: Daumen-Reachability. Der obere Header ist auf 6"+
// Phones mit einer Hand nicht erreichbar, während das untere Drittel im
// natürlichen Daumen-Arc liegt. Jede Social-App mit nennenswerter DAU hat
// genau dieses Pattern.
//
// Active-State: Prefix-Match identisch zur Desktop-Nav (`isActive()` in
// main-nav.tsx), damit `/shop/123` auch weiterhin den Shop-Tab markiert.
//
// Auth-Gating: Der "Create" Center-Slot ist nur sichtbar wenn `isAuthed`;
// unauthentifizierte Visitors sehen 4 Slots (Feed als Landing → Explore,
// Shop, Live, Profile). Das ist bewusst schlanker statt dem User einen
// disabled-Plus-Button zu zeigen, der nach einem Login-Flow riecht.
//
// Safe-Area: `pb-[env(safe-area-inset-bottom)]` respektiert iOS-Home-Indicator-
// Bereich. Der Content-Wrapper im `layout.tsx` muss dementsprechend
// `pb-[calc(4rem+env(safe-area-inset-bottom))]` bekommen, damit letzte Scroll-
// Content-Zeile nicht unter der Tab-Bar verschwindet. Das handeln wir oben im
// Layout.
// -----------------------------------------------------------------------------

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  PlusSquare,
  ShoppingBag,
  User as UserIcon,
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

const SLOTS: Slot[] = [
  { href: '/',        labelKey: 'nav.feed',    icon: Home },
  { href: '/explore', labelKey: 'nav.explore', icon: Compass },
  { href: '/create',  labelKey: 'nav.create',  icon: PlusSquare, authOnly: true, primary: true },
  { href: '/shop',    labelKey: 'nav.shop',    icon: ShoppingBag },
  { href: '/profile', labelKey: 'nav.profile', icon: UserIcon, authOnly: true },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({
  isAuthed,
  profileHref,
}: {
  isAuthed: boolean;
  /**
   * Profile-Slot verlinkt bei authentifizierten Usern auf `/u/<username>`
   * (eigenes Profil). Fallback `/onboarding` falls `username` null ist
   * (Account ohne abgeschlossenen Onboarding-Flow).
   */
  profileHref: string;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  const visible = SLOTS.filter((s) => !s.authOnly || isAuthed).map((s) =>
    s.href === '/profile' ? { ...s, href: profileHref } : s,
  );

  return (
    <nav
      aria-label={t('nav.main')}
      className={cn(
        // Positionierung: fixed unten, nur unterhalb md sichtbar
        'fixed inset-x-0 bottom-0 z-40 md:hidden',
        // Safe-Area für iOS-Home-Indicator
        'pb-[env(safe-area-inset-bottom)]',
        // Glas-Effekt mit Border-Top (Theme-aware via `bg-background/90`)
        'border-t border-border/60 bg-background/90 backdrop-blur-lg',
      )}
    >
      <ul className="flex items-stretch justify-around">
        {visible.map((slot) => {
          const Icon = slot.icon;
          const active = isActive(pathname, slot.href);
          const label = t(slot.labelKey);
          return (
            <li key={slot.href} className="flex-1">
              <Link
                href={slot.href as Route}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5',
                  'transition-colors duration-fast ease-out-expo',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  slot.primary
                    ? 'text-foreground'
                    : active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {slot.primary ? (
                  // Zentraler "Create"-Slot: gefüllter Primary-Button statt Icon-nur.
                  // Visuell identifiziert als "Aktion, nicht Ziel" — wie der Desktop-
                  // CTA im SiteHeader.
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-elevation-2">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                ) : (
                  <>
                    <Icon
                      className={cn(
                        'h-5 w-5',
                        active ? 'stroke-[2.25]' : 'stroke-[1.75]',
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        'text-[10px] leading-none',
                        active ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {label}
                    </span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
