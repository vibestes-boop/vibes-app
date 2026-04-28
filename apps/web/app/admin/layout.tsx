import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { Shield, Users, Flag, CreditCard, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Admin Layout — v1.w.UI.215
//
// Guards: Nicht-eingeloggte → /login, Nicht-Admin → /
// Zeigt horizontale Tab-Navigation für alle Admin-Sektionen.
// -----------------------------------------------------------------------------

const NAV: { label: string; href: Route; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Übersicht',     href: '/admin' as Route,         icon: BarChart3 },
  { label: 'Nutzer',        href: '/admin/users' as Route,   icon: Users },
  { label: 'Meldungen',     href: '/admin/reports' as Route, icon: Flag },
  { label: 'Auszahlungen',  href: '/admin/payouts' as Route, icon: CreditCard },
];

async function getAdminStatus(): Promise<'unauthenticated' | 'not_admin' | 'admin'> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'unauthenticated';

  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  return (data as { is_admin?: boolean } | null)?.is_admin ? 'admin' : 'not_admin';
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const status = await getAdminStatus();

  if (status === 'unauthenticated') redirect('/login?next=/admin');
  if (status === 'not_admin') redirect('/');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
          <Shield className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Admin-Panel</h1>
          <p className="text-xs text-muted-foreground">Serlo — Plattformverwaltung</p>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="mb-8 flex gap-1 overflow-x-auto rounded-xl bg-muted/40 p-1">
        {NAV.map(({ label, href, icon: Icon }) => (
          <AdminNavItem key={href} label={label} href={href} icon={Icon} />
        ))}
      </nav>

      {children}
    </div>
  );
}

// Client-side active detection requires a client component.
// We import it separately to keep the layout as a Server Component.
function AdminNavItem({
  label,
  href,
  icon: Icon,
}: {
  label: string;
  href: Route;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground hover:shadow-sm min-w-max"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
