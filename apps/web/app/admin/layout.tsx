import { redirect } from 'next/navigation';
import type { Route } from 'next';
import {
  Bell,
  CalendarDays,
  Menu,
  Search,
  Shield,
} from 'lucide-react';
import { getAdminRoleStatus, getAdminSidebarBadges, type AdminRoleStatus, type AdminSidebarBadges } from '@/app/actions/admin';
import { AdminSidebarNav, AdminMobileNav, type AdminNavItemData } from '@/components/admin/admin-nav';
import { FeedSidebarRail } from '@/components/feed/feed-sidebar-rail';

// Icons als String-Keys — werden in components/admin/admin-nav.tsx (Client)
// auf Lucide-Komponenten gemappt (RSC-Grenze: keine Komponenten-Props).
const NAV: {
  label: string;
  href: Route;
  icon: string;
  canShow: (roles: AdminRoleStatus) => boolean;
  badge?: (badges: AdminSidebarBadges) => number;
  badgeTone?: 'red' | 'blue' | 'amber';
  disabled?: boolean;
}[] = [
  { label: 'Dashboard', href: '/admin/command-center' as Route, icon: 'home', canShow: (roles) => roles.can_operate },
  { label: 'Live Feed', href: '/admin/live-feed' as Route, icon: 'activity', canShow: (roles) => roles.can_operate },
  { label: 'Nutzer', href: '/admin/users' as Route, icon: 'users', canShow: (roles) => roles.can_admin },
  { label: 'Inhalte', href: '/admin/content' as Route, icon: 'message', canShow: (roles) => roles.can_operate },
  { label: 'Moderation', href: '/admin/reports' as Route, icon: 'shield', canShow: (roles) => roles.can_moderate },
  { label: 'Meldungen', href: '/admin/reports' as Route, icon: 'flag', canShow: (roles) => roles.can_moderate, badge: (badges) => badges.reports_pending, badgeTone: 'red' },
  { label: 'Kampagnen', href: '/admin/campaigns' as Route, icon: 'megaphone', canShow: (roles) => roles.can_operate, badge: (badges) => badges.campaigns_active, badgeTone: 'blue' },
  { label: 'Nachrichten', href: '/admin/support' as Route, icon: 'message', canShow: (roles) => roles.can_moderate, badge: (badges) => badges.support_open, badgeTone: 'blue' },
  { label: 'Aktivierung', href: '/admin/activation' as Route, icon: 'rocket', canShow: (roles) => roles.can_operate || roles.can_creator_ops },
  { label: 'Analytics', href: '/admin/analytics' as Route, icon: 'chart', canShow: (roles) => roles.can_operate },
  { label: 'Sicherheit', href: '/admin/security' as Route, icon: 'lock', canShow: (roles) => roles.can_operate, badge: (badges) => badges.security_critical, badgeTone: 'amber' },
  { label: 'Auszahlungen', href: '/admin/payouts' as Route, icon: 'card', canShow: (roles) => roles.can_creator_ops },
  { label: 'Übersicht', href: '/admin' as Route, icon: 'settings', canShow: (roles) => roles.can_access_admin },
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

  if (!roles.is_authenticated) redirect('/login?next=/admin' as Route);
  if (!roles.can_access_admin) redirect('/' as Route);

  const nav = NAV.filter((item) => item.canShow(roles));
  const badges = await getAdminSidebarBadges();
  const displayName = roles.display_name || roles.username || 'Admin';
  const roleLabel = ROLE_LABEL[roles.primary_role];

  // Serialisierbare Items für die Client-Nav. Mehrere Einträge teilen sich
  // (noch) dieselbe Route — nur das erste Vorkommen pro href darf den
  // Active-State tragen, sonst leuchten z. B. fünf Command-Center-Links auf.
  const seenHrefs = new Set<string>();
  const navItems: AdminNavItemData[] = nav.map((item) => {
    const activeEligible = !seenHrefs.has(item.href);
    seenHrefs.add(item.href);
    return {
      label: item.label,
      href: item.href,
      icon: item.icon,
      badge: item.badge?.(badges) ?? 0,
      badgeTone: item.badgeTone ?? 'blue',
      disabled: item.disabled,
      activeEligible,
    };
  });

  return (
    <div className="min-h-screen bg-muted/50 text-foreground">
      {/* Schmale Serlo-Rail ganz links (xl+, klappt per Hover-Overlay auf) —
          fixed, damit sie zur fixed Admin-Sidebar passt. Diese + der Content
          werden auf xl+ um die Rail-Breite (w-20) nach rechts versetzt. */}
      <FeedSidebarRail railCollapsible className="fixed inset-y-0 left-0 z-40" />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-52 border-r border-border bg-card lg:flex lg:flex-col xl:left-20">
        <div className="flex h-14 items-center gap-2.5 border-b border-border/60 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-bold">Admin Center</div>
            <div className="text-[11px] text-muted-foreground">Vibes Operations</div>
          </div>
        </div>

        <AdminSidebarNav items={navItems} />

        <div className="border-t border-border/60 px-3.5 py-3 text-[11px] text-muted-foreground">
          <div className="font-medium text-foreground/80">Zentrale Admin-Konsole</div>
          <div>Web, Mobile-Web und App-Betrieb</div>
        </div>
      </aside>

      <div className="lg:pl-52 xl:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex min-h-14 items-center gap-2.5 px-4 py-2.5 sm:px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border lg:hidden">
              <Menu className="h-4 w-4" />
            </div>

            <form action="/admin/users" className="min-w-0 flex-1">
              <label className="relative block max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  name="q"
                  type="search"
                  placeholder="Suche (z. B. Nutzer, Inhalt, ID)"
                  className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-xs outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
            </form>

            <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground/80 sm:flex">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              Letzte 24 Stunden
            </div>

            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
              <Bell className="h-4 w-4 text-foreground/80" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </div>

            <div className="hidden items-center gap-2.5 border-l border-border pl-3 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                {initials(displayName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">{displayName}</div>
                <div className="truncate text-[11px] text-muted-foreground">{roleLabel}</div>
              </div>
            </div>
          </div>

          <AdminMobileNav items={navItems} />
        </header>

        <main className="mx-auto max-w-[1760px] px-4 py-4 sm:px-5 xl:px-6">{children}</main>
      </div>
    </div>
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
