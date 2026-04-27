'use client';

import type { Route } from 'next';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Grid3x3, Heart, Repeat2, ShoppingBag, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';
import { LOCALE_INTL } from '@/lib/i18n/config';

// -----------------------------------------------------------------------------
// ProfileTabs — segmented control über /u/[username]?tab=posts|likes|shop|battles
// URL-State statt Hook-State, damit Share-Links den aktiven Tab mitbringen
// und Zurück-Button im Browser den Tab-Wechsel rückgängig macht.
//
// i18n-Kontrakt: Der Parent-Server-Component übergibt vor-resolvte Labels als
// `labels`-Prop. Das vermeidet, dass dieser Client-Code in jedem Render den
// Kontext-Lookup für vier statische Keys macht — und vermeidet gleichzeitig,
// dass Server-Strings doppelt über die Wire-Boundary geschickt werden, wenn
// sich nur die Zahlen ändern.
// -----------------------------------------------------------------------------

export type ProfileTab = 'posts' | 'likes' | 'reposts' | 'shop' | 'battles';

export interface ProfileTabsLabels {
  tablist: string;
  posts: string;
  likes: string;
  reposts: string;
  shop: string;
  battles: string;
}

export function ProfileTabs({
  active,
  counts,
  labels,
}: {
  active: ProfileTab;
  counts?: Partial<Record<ProfileTab, number>>;
  labels: ProfileTabsLabels;
}) {
  const { locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const TABS: Array<{ key: ProfileTab; label: string; icon: typeof Grid3x3 }> = [
    { key: 'posts',   label: labels.posts,   icon: Grid3x3 },
    { key: 'likes',   label: labels.likes,   icon: Heart },
    { key: 'reposts', label: labels.reposts, icon: Repeat2 },
    { key: 'shop',    label: labels.shop,    icon: ShoppingBag },
    { key: 'battles', label: labels.battles, icon: Swords },
  ];

  const onSelect = useCallback(
    (tab: ProfileTab) => {
      const next = new URLSearchParams(params?.toString() ?? '');
      if (tab === 'posts') {
        next.delete('tab'); // Default — sauberer Link ohne `?tab=posts`.
      } else {
        next.set('tab', tab);
      }
      const qs = next.toString();
      // typedRoutes: `router.replace` verlangt eine literal-typed Route.
      // Unsere Profile-Routes sind dynamic (`/u/[username]`), deshalb casten
      // wir zu `Route` — die Basis-Konstruktion ist korrekt und Next löst
      // den Dynamic-Match zur Laufzeit sauber auf.
      const href = (qs ? `${pathname}?${qs}` : pathname) as Route;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [router, pathname, params, startTransition],
  );

  return (
    // Bold-Underline-Style (v1.w.UI.1 — D4 aus UI_AUDIT).
    //
    // Änderungen gegenüber der alten Variante:
    //   - `border-b-2` statt `border-b` auf dem Container (dickerer visueller
    //     Sockel damit die aktive Tab-Linie darauf sitzt ohne zu verschwinden).
    //   - Aktive Tab bekommt eigenen 2px-Underline via `after:`-Pseudo statt
    //     absolute-positioniertem `<span>` — funktioniert ohne Extra-Node in
    //     der Accessibility-Tree und ist resilienter gegen Padding-Anpassungen.
    //   - Aktive Tab: `font-semibold` statt nur `font-medium` (TikTok/IG
    //     markieren die aktive Tab visuell deutlicher — einfaches Farb-Switch
    //     reicht nicht auf hellem Theme).
    //   - Icon-Stroke beim aktiven Tab: `stroke-[2.25]` — gleiche Technik wie
    //     in der neuen MobileBottomNav. Ein inaktives Icon wirkt damit leichter,
    //     aktives prägnanter (Gewicht-Shift ohne Farb-Shift).
    //   - Label immer sichtbar auf sm+, Count-Pill immer formatiert.
    <div
      role="tablist"
      aria-label={labels.tablist}
      className="sticky top-14 z-30 flex items-stretch justify-around border-b-2 border-border/60 bg-background/80 backdrop-blur-md"
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        const count = counts?.[key];
        return (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`panel-${key}`}
            data-state={isActive ? 'active' : 'inactive'}
            disabled={isPending}
            onClick={() => onSelect(key)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm transition-colors duration-base ease-out-expo',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              // Active-Underline via ::after-Pseudo — sitzt auf der -2px Sockel-
              // Linie des Containers und hat -bottom-0.5 Offset damit die beiden
              // Linien sauber stacken ohne doppelt zu wirken.
              'after:absolute after:inset-x-4 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-foreground after:transition-opacity after:duration-base',
              isActive
                ? 'font-semibold text-foreground after:opacity-100'
                : 'font-medium text-muted-foreground hover:text-foreground/80 after:opacity-0',
              isPending && 'opacity-60',
            )}
          >
            <Icon
              className={cn('h-4 w-4', isActive ? 'stroke-[2.25]' : 'stroke-[1.75]')}
              aria-hidden
            />
            <span className="hidden sm:inline">{label}</span>
            {typeof count === 'number' && count > 0 && (
              <span
                className={cn(
                  'text-xs tabular-nums',
                  isActive ? 'text-foreground/80' : 'text-muted-foreground',
                )}
              >
                {count.toLocaleString(LOCALE_INTL[locale])}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
