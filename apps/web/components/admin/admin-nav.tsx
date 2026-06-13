'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CreditCard,
  Flag,
  Home,
  LockKeyhole,
  Megaphone,
  MessageSquare,
  Rocket,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// AdminNav — Client-Nav für das Admin-Center.
//
// Der Active-State läuft über usePathname (vorher: hart auf das Label
// „Dashboard" verdrahtet → klickte man andere Seiten an, blieb Dashboard
// markiert). Icons leben hier als String-Keys, weil Lucide-Komponenten nicht
// vom Server-Layout über die RSC-Grenze gereicht werden können.
//
// `activeEligible`: mehrere Nav-Einträge zeigen (noch) auf dieselbe Route
// (z. B. Dashboard/Live Feed/Analytics → /admin/command-center). Das Server-
// Layout markiert pro href nur das erste Vorkommen als eligible, damit nicht
// fünf Einträge gleichzeitig aufleuchten.
// -----------------------------------------------------------------------------

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  activity: Activity,
  users: Users,
  message: MessageSquare,
  shield: ShieldCheck,
  flag: Flag,
  megaphone: Megaphone,
  rocket: Rocket,
  chart: BarChart3,
  lock: LockKeyhole,
  card: CreditCard,
  settings: Settings,
};

export interface AdminNavItemData {
  label: string;
  href: string;
  icon: string;
  badge: number;
  badgeTone: 'red' | 'blue' | 'amber';
  disabled?: boolean;
  activeEligible: boolean;
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === '/admin'
      ? pathname === '/admin'
      : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebarNav({ items }: { items: AdminNavItemData[] }) {
  const isActive = useIsActive();

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? Home;
        const active = item.activeEligible && isActive(item.href);
        return (
          <Link
            key={`${item.label}-${item.href}`}
            href={item.href as Route}
            aria-disabled={item.disabled}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground transition',
              'hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-400',
              active && 'bg-blue-500/10 font-semibold text-blue-700 dark:text-blue-400',
              item.disabled && 'opacity-60',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.badge > 0 && <NavBadge value={item.badge} tone={item.badgeTone} />}
            {item.disabled && (
              <span className="ml-auto text-[10px] uppercase text-muted-foreground/70">bald</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminMobileNav({ items }: { items: AdminNavItemData[] }) {
  const isActive = useIsActive();

  return (
    <nav className="flex gap-1.5 overflow-x-auto border-t border-border/60 px-4 py-2 lg:hidden">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? Home;
        const active = item.activeEligible && isActive(item.href);
        return (
          <Link
            key={`${item.label}-${item.href}`}
            href={item.href as Route}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-w-max items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground/80',
              active && 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
              item.disabled && 'opacity-60',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
            {item.badge > 0 && <NavBadge value={item.badge} tone={item.badgeTone} />}
          </Link>
        );
      })}
    </nav>
  );
}

function NavBadge({ value, tone }: { value: number; tone: 'red' | 'blue' | 'amber' }) {
  const className =
    tone === 'red'
      ? 'bg-red-500 text-white'
      : tone === 'amber'
        ? 'bg-amber-500 text-white'
        : 'bg-blue-600 text-white';
  return (
    <span
      className={cn(
        'ml-auto min-w-5 rounded-full px-1.5 text-center text-[10px] font-bold leading-5',
        className,
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}
