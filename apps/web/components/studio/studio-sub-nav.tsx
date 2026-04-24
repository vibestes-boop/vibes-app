'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Coins,
  CalendarDays,
  FileText,
  Radio,
  Package,
  ShoppingBag,
  ShieldBan,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

// -----------------------------------------------------------------------------
// StudioSubNav — Sticky Sub-Nav für /studio-Namespace.
//
// WICHTIG: Die NAV-Definition liegt HIER im Client-Component, nicht im Layout.
// Gründe:
//   - Next.js 15 erlaubt NICHT, Lucide-Icon-Komponenten (React-Elemente mit
//     $$typeof / render-Methoden) als Props von einem Server-Component (z.B.
//     layout.tsx) in einen Client-Component zu reichen — das wirft
//     "Only plain objects can be passed to Client Components".
//   - Die Active-State-Detection braucht usePathname() — muss eh Client sein.
//   - Deshalb ist die Nav-Liste hier lokal; Layout rendert nur noch
//     <StudioSubNav /> ohne Props.
//
// i18n-Pattern:
//   Items tragen `labelKey: TranslationKey` statt eines statischen Strings.
//   Die Component liest selber via `useI18n()` und resolved den Key zur
//   Laufzeit — funktioniert weil Labels aus dem Messages-Tree kommen, nicht
//   aus Server-Props.
//
// Responsive:
// - Mobile/Tablet (< lg): horizontal scrollbare Pill-Row, sticky top-0.
// - Desktop (>= lg): vertikales Rail mit Sticky-Positionierung unter dem
//   SiteHeader. Rail zeigt Icon + Label, aktives Item bekommt kräftigen
//   Hintergrund (wie Feed-Sidebar).
//
// Active-State:
// - Exaktes Match auf Pathname für den Dashboard-Root (`/studio`).
// - Alle anderen Items: startsWith-Match (z.B. `/studio/analytics/foo` zeigt
//   "Analytics" als aktiv). Das ist die Standard-Heuristik für nested routes.
// -----------------------------------------------------------------------------

export interface StudioNavItem {
  labelKey: TranslationKey;
  href: Route;
  icon: LucideIcon;
}

const STUDIO_NAV: StudioNavItem[] = [
  { labelKey: 'studio.navDashboard',  href: '/studio' as Route,             icon: LayoutDashboard },
  { labelKey: 'studio.navAnalytics',  href: '/studio/analytics' as Route,   icon: BarChart3 },
  { labelKey: 'studio.navRevenue',    href: '/studio/revenue' as Route,     icon: Coins },
  { labelKey: 'studio.navScheduled',  href: '/studio/scheduled' as Route,   icon: CalendarDays },
  { labelKey: 'studio.navDrafts',     href: '/studio/drafts' as Route,      icon: FileText },
  { labelKey: 'studio.navLive',       href: '/studio/live' as Route,        icon: Radio },
  { labelKey: 'studio.navShop',       href: '/studio/shop' as Route,        icon: Package },
  { labelKey: 'studio.navOrders',     href: '/studio/orders' as Route,      icon: ShoppingBag },
  { labelKey: 'studio.navModeration', href: '/studio/moderation' as Route,  icon: ShieldBan },
];

export function StudioSubNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = STUDIO_NAV;

  const isActive = (href: string) => {
    if (href === '/studio') return pathname === '/studio';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label={t('studio.navAria')}
      className={cn(
        // Mobile: horizontal scroll, sticky am Viewport-Top. Seit v1.w.UI.11
        // gibt es keinen globalen SiteHeader mehr — Sub-Nav klebt direkt an
        // der oberen Fensterkante.
        'sticky top-0 z-20 -mx-4 overflow-x-auto border-y bg-background/80 backdrop-blur-md lg:mx-0',
        // Desktop: vertikales Rail, 1rem Abstand zum oberen/unteren Rand. Höhe
        // füllt den Viewport minus Top/Bottom-Padding. Kein SiteHeader-Offset
        // mehr nötig.
        'lg:top-4 lg:h-[calc(100dvh-2rem)] lg:rounded-xl lg:border lg:bg-card lg:backdrop-blur-none',
      )}
    >
      <ul className="flex items-center gap-1 px-4 py-2 lg:flex-col lg:items-stretch lg:px-2 lg:py-3">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors lg:px-3',
                  active
                    ? 'bg-muted font-semibold text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
