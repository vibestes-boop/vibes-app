'use client';

import type { Route } from 'next';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Grid3x3, Heart, ShoppingBag, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// ProfileTabs — segmented control über /u/[username]?tab=posts|likes|shop|battles
// URL-State statt Hook-State, damit Share-Links den aktiven Tab mitbringen
// und Zurück-Button im Browser den Tab-Wechsel rückgängig macht.
// -----------------------------------------------------------------------------

export type ProfileTab = 'posts' | 'likes' | 'shop' | 'battles';

const TABS: Array<{ key: ProfileTab; label: string; icon: typeof Grid3x3 }> = [
  { key: 'posts',   label: 'Posts',   icon: Grid3x3 },
  { key: 'likes',   label: 'Likes',   icon: Heart },
  { key: 'shop',    label: 'Shop',    icon: ShoppingBag },
  { key: 'battles', label: 'Battles', icon: Swords },
];

export function ProfileTabs({
  active,
  counts,
}: {
  active: ProfileTab;
  counts?: Partial<Record<ProfileTab, number>>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

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
    <div
      role="tablist"
      aria-label="Profil-Inhalte"
      className="sticky top-14 z-30 flex items-stretch justify-around border-b border-border bg-background/80 backdrop-blur-md"
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
              'relative flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80',
              isPending && 'opacity-60',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
            {typeof count === 'number' && count > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {count.toLocaleString('de-DE')}
              </span>
            )}
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-foreground"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
