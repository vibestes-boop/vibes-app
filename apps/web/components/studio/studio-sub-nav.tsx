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
  ChevronDown,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

export interface StudioNavItem {
  labelKey: TranslationKey;
  href: Route;
  icon: LucideIcon;
  /** Sub-items — on desktop they appear indented when the parent is active. */
  children?: { label: string; href: Route }[];
}

const STUDIO_NAV: StudioNavItem[] = [
  { labelKey: 'studio.navDashboard',  href: '/studio' as Route,             icon: LayoutDashboard },
  {
    labelKey: 'studio.navAnalytics',
    href: '/studio/analytics' as Route,
    icon: BarChart3,
    children: [
      { label: 'Übersicht',    href: '/studio/analytics' as Route },
      { label: 'LIVE-Analyse', href: '/studio/analytics/live' as Route },
    ],
  },
  { labelKey: 'studio.navRealtime',   href: '/studio/realtime' as Route,    icon: Activity },
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

  const isActive = (href: string) => {
    if (href === '/studio') return pathname === '/studio';
    if (href === '/studio/analytics') return pathname === '/studio/analytics';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isGroupActive = (item: StudioNavItem) => {
    if (item.href === '/studio') return pathname === '/studio';
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <nav
      aria-label={t('studio.navAria')}
      className={cn(
        'sticky top-0 z-20 -mx-4 overflow-x-auto border-y bg-background/80 backdrop-blur-md lg:mx-0',
        'lg:top-4 lg:h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:rounded-xl lg:border lg:bg-card lg:backdrop-blur-none',
      )}
    >
      <ul className="flex items-center gap-1 px-4 py-2 lg:flex-col lg:items-stretch lg:px-2 lg:py-3">
        {STUDIO_NAV.map((item) => {
          const active = isGroupActive(item);
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;

          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              {/* Parent item */}
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-muted font-semibold text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{t(item.labelKey)}</span>
                {/* Chevron indicator for groups — only on desktop */}
                {hasChildren && (
                  <ChevronDown
                    className={cn(
                      'hidden h-3.5 w-3.5 shrink-0 transition-transform lg:block',
                      active ? 'rotate-0' : '-rotate-90',
                    )}
                  />
                )}
              </Link>

              {/* Sub-items — only on desktop, only when group is active */}
              {hasChildren && active && (
                <ul className="mt-0.5 hidden flex-col gap-0.5 lg:flex">
                  {item.children!.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                    // Prevent /studio/analytics/live matching /studio/analytics
                    const exactChildActive =
                      child.href === '/studio/analytics'
                        ? pathname === '/studio/analytics'
                        : childActive;

                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={exactChildActive ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-sm transition-colors',
                            exactChildActive
                              ? 'font-semibold text-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
