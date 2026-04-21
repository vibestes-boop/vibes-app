'use client';

// Main-Navigation for the SiteHeader. Split into two exported pieces so the
// SiteHeader can place the mobile hamburger on the left of the logo and the
// desktop inline nav to the right of it (conventional layout on both
// breakpoints). Both share the same NAV_ITEMS source-of-truth.
//
// Active-state is derived from `usePathname()` — a prefix match so that e.g.
// `/shop/123` and `/shop/saved` both mark "Shop" active. Exact match for
// `/` (Feed) only, otherwise any non-root path would highlight Feed.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Menu,
  Home,
  Compass,
  ShoppingBag,
  Radio,
  MessageCircle,
  Plus,
  Users,
  LayoutDashboard,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { useI18n } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

type NavItem = {
  href: string;
  /** i18n-Key — wird zur Laufzeit via `t(labelKey)` resolved. */
  labelKey: TranslationKey;
  icon: typeof Home;
  /** If true, only show when authenticated. */
  authOnly?: boolean;
  /**
   * If true, NICHT in der Desktop-Inline-Nav rendern. Für Items die ihre
   * eigene prominente CTA-Darstellung im Header haben (aktuell: /create
   * als gefüllter Primary-Button rechts). Mobile-Drawer zeigt sie weiter,
   * weil dort kein eigener CTA-Slot existiert.
   */
  desktopHidden?: boolean;
};

// Primary nav — the 6 items that appear in the desktop header bar. Kept short
// so the row fits on 13" laptop screens without wrapping.
const PRIMARY_NAV: NavItem[] = [
  { href: '/', labelKey: 'nav.feed', icon: Home, authOnly: true },
  { href: '/explore', labelKey: 'nav.explore', icon: Compass },
  { href: '/shop', labelKey: 'nav.shop', icon: ShoppingBag },
  { href: '/live', labelKey: 'nav.live', icon: Radio },
  { href: '/messages', labelKey: 'nav.messages', icon: MessageCircle, authOnly: true },
  { href: '/create', labelKey: 'nav.create', icon: Plus, authOnly: true, desktopHidden: true },
];

// Secondary nav — only shown in the mobile drawer (too many for the desktop
// bar). Desktop users reach these via the avatar dropdown or direct URLs.
const SECONDARY_NAV: NavItem[] = [
  { href: '/guilds', labelKey: 'nav.guilds', icon: Users, authOnly: true },
  { href: '/studio', labelKey: 'nav.studio', icon: LayoutDashboard, authOnly: true },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// -----------------------------------------------------------------------------
// Desktop inline nav — hidden below md breakpoint.
// -----------------------------------------------------------------------------

export function DesktopNav({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = PRIMARY_NAV.filter(
    (i) => !i.desktopHidden && (!i.authOnly || isAuthed),
  );

  return (
    <nav aria-label={t('nav.main')} className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// -----------------------------------------------------------------------------
// Mobile hamburger + Sheet drawer — visible only below md.
// -----------------------------------------------------------------------------

export function MobileNav({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const primary = PRIMARY_NAV.filter((i) => !i.authOnly || isAuthed);
  const secondary = SECONDARY_NAV.filter((i) => !i.authOnly || isAuthed);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t('nav.openMenu')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">{t('nav.main')}</SheetTitle>
        <div className="flex h-14 items-center border-b border-border/40 px-4 font-serif text-xl font-medium tracking-tight">
          Serlo
        </div>
        <div className="flex flex-col gap-0.5 p-2">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <SheetClose asChild key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{t(item.labelKey)}</span>
                </Link>
              </SheetClose>
            );
          })}
          {secondary.length > 0 && (
            <>
              <div className="my-2 border-t border-border/40" />
              {secondary.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </SheetClose>
                );
              })}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
