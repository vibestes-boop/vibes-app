import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  Flag,
  Home,
  LockKeyhole,
  Megaphone,
  Menu,
  MessageSquare,
  Rocket,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { getAdminRoleStatus, getAdminSidebarBadges, type AdminRoleStatus, type AdminSidebarBadges } from '@/app/actions/admin';
import { cn } from '@/lib/utils';

const NAV: {
  label: string;
  href: Route;
  icon: React.ComponentType<{ className?: string }>;
  canShow: (roles: AdminRoleStatus) => boolean;
  badge?: (badges: AdminSidebarBadges) => number;
  badgeTone?: 'red' | 'blue' | 'amber';
  disabled?: boolean;
}[] = [
  { label: 'Dashboard', href: '/admin/command-center' as Route, icon: Home, canShow: (roles) => roles.can_operate },
  { label: 'Live Feed', href: '/admin/command-center' as Route, icon: Activity, canShow: (roles) => roles.can_operate },
  { label: 'Nutzer', href: '/admin/users' as Route, icon: Users, canShow: (roles) => roles.can_admin },
  { label: 'Inhalte', href: '/admin/command-center' as Route, icon: MessageSquare, canShow: (roles) => roles.can_operate },
  { label: 'Moderation', href: '/admin/reports' as Route, icon: ShieldCheck, canShow: (roles) => roles.can_moderate },
  { label: 'Meldungen', href: '/admin/reports' as Route, icon: Flag, canShow: (roles) => roles.can_moderate, badge: (badges) => badges.reports_pending, badgeTone: 'red' },
  { label: 'Kampagnen', href: '/admin/campaigns' as Route, icon: Megaphone, canShow: (roles) => roles.can_operate, badge: (badges) => badges.campaigns_active, badgeTone: 'blue' },
  { label: 'Nachrichten', href: '/admin/support' as Route, icon: MessageSquare, canShow: (roles) => roles.can_moderate, badge: (badges) => badges.support_open, badgeTone: 'blue' },
  { label: 'Aktivierung', href: '/admin/activation' as Route, icon: Rocket, canShow: (roles) => roles.can_operate || roles.can_creator_ops },
  { label: 'Analytics', href: '/admin/command-center' as Route, icon: BarChart3, canShow: (roles) => roles.can_operate },
  { label: 'Sicherheit', href: '/admin/command-center' as Route, icon: LockKeyhole, canShow: (roles) => roles.can_operate, badge: (badges) => badges.security_critical, badgeTone: 'amber' },
  { label: 'Auszahlungen', href: '/admin/payouts' as Route, icon: CreditCard, canShow: (roles) => roles.can_creator_ops },
  { label: 'Einstellungen', href: '/admin' as Route, icon: Settings, canShow: (roles) => roles.can_access_admin },
];

const ROLE_LABEL: Record<AdminRoleStatus['primary_role'], string> = {
  admin: 'Super-Admin',
  moderator: 'Moderator',
  operator: 'Operator',
  creator_ops: 'Creator Ops',
  none: 'Admin',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const roles = await getAdminRoleStatus();

  if (!roles.is_authenticated) redirect('/login?next=/admin');
  if (!roles.can_access_admin) redirect('/');

  const nav = NAV.filter((item) => item.canShow(roles));
  const badges = await getAdminSidebarBadges();
  const displayName = roles.display_name || roles.username || 'Admin';
  const roleLabel = ROLE_LABEL[roles.primary_role];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-52 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-bold">Admin Center</div>
            <div className="text-[11px] text-slate-500">Vibes Operations</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
          {nav.map((item) => (
            <AdminNavLink key={`${item.label}-${item.href}`} item={item} badges={badges} />
          ))}
        </nav>

        <div className="border-t border-slate-100 px-3.5 py-3 text-[11px] text-slate-500">
          <div className="font-medium text-slate-700">Zentrale Admin-Konsole</div>
          <div>Web, Mobile-Web und App-Betrieb</div>
        </div>
      </aside>

      <div className="lg:pl-52">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-14 items-center gap-2.5 px-4 py-2.5 sm:px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 lg:hidden">
              <Menu className="h-4 w-4" />
            </div>

            <form action="/admin/users" className="min-w-0 flex-1">
              <label className="relative block max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="q"
                  type="search"
                  placeholder="Suche (z. B. Nutzer, Inhalt, ID)"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </form>

            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 sm:flex">
              <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
              Letzte 24 Stunden
            </div>

            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white">
              <Bell className="h-4 w-4 text-slate-700" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </div>

            <div className="hidden items-center gap-2.5 border-l border-slate-200 pl-3 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {initials(displayName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-900">{displayName}</div>
                <div className="truncate text-[11px] text-slate-500">{roleLabel}</div>
              </div>
            </div>
          </div>

          <nav className="flex gap-1.5 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
            {nav.map((item) => (
              <AdminMobileNavLink key={`${item.label}-${item.href}`} item={item} badges={badges} />
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[1760px] px-4 py-4 sm:px-5 xl:px-6">{children}</main>
      </div>
    </div>
  );
}

function AdminNavLink({
  item,
  badges,
}: {
  item: {
    label: string;
    href: Route;
    icon: React.ComponentType<{ className?: string }>;
    badge?: (badges: AdminSidebarBadges) => number;
    badgeTone?: 'red' | 'blue' | 'amber';
    disabled?: boolean;
  };
  badges: AdminSidebarBadges;
}) {
  const Icon = item.icon;
  const badgeValue = item.badge?.(badges) ?? 0;
  return (
    <Link
      href={item.href}
      aria-disabled={item.disabled}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700',
        item.label === 'Dashboard' && 'bg-blue-50 text-blue-700',
        item.disabled && 'opacity-60',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
      {badgeValue > 0 && <NavBadge value={badgeValue} tone={item.badgeTone ?? 'blue'} />}
      {item.disabled && <span className="ml-auto text-[10px] uppercase text-slate-400">bald</span>}
    </Link>
  );
}

function AdminMobileNavLink({
  item,
  badges,
}: {
  item: {
    label: string;
    href: Route;
    icon: React.ComponentType<{ className?: string }>;
    badge?: (badges: AdminSidebarBadges) => number;
    badgeTone?: 'red' | 'blue' | 'amber';
    disabled?: boolean;
  };
  badges: AdminSidebarBadges;
}) {
  const Icon = item.icon;
  const badgeValue = item.badge?.(badges) ?? 0;
  return (
    <Link
      href={item.href}
      className={cn(
        'inline-flex min-w-max items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700',
        item.label === 'Dashboard' && 'border-blue-200 bg-blue-50 text-blue-700',
        item.disabled && 'opacity-60',
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
      {badgeValue > 0 && <NavBadge value={badgeValue} tone={item.badgeTone ?? 'blue'} />}
    </Link>
  );
}

function NavBadge({ value, tone }: { value: number; tone: 'red' | 'blue' | 'amber' }) {
  const className = tone === 'red'
    ? 'bg-red-500 text-white'
    : tone === 'amber'
      ? 'bg-amber-500 text-white'
      : 'bg-blue-600 text-white';
  return (
    <span className={cn('ml-auto min-w-5 rounded-full px-1.5 text-center text-[10px] font-bold leading-5', className)}>
      {value > 99 ? '99+' : value}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';
}
