import { redirect } from 'next/navigation';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { User as UserIcon, Receipt, Shield, Bell } from 'lucide-react';

import { getUser } from '@/lib/auth/session';

// -----------------------------------------------------------------------------
// /settings — Layout-Namespace für User-Einstellungen.
//
// Strategie:
//   - SSR Auth-Gate (wie /studio).
//   - Linke Nav auf Desktop, horizontal scroll auf Mobile. Inhalte rechts.
//   - Phase-10-Scope: nur /billing ist implementiert. Andere Tabs zeigen
//     „kommt bald" — bewusst nicht auskommentiert damit die Nav-Struktur
//     stabil bleibt.
// -----------------------------------------------------------------------------

interface SettingsNavItem {
  label: string;
  href: Route;
  icon: typeof UserIcon;
  phase?: string;
}

const NAV: SettingsNavItem[] = [
  { label: 'Profil',         href: '/settings' as Route,          icon: UserIcon, phase: 'Phase 11' },
  { label: 'Bezahlungen',    href: '/settings/billing' as Route,  icon: Receipt },
  { label: 'Benachrichtigungen', href: '/settings/notifications' as Route, icon: Bell },
  { label: 'Privatsphäre',   href: '/settings/privacy' as Route,  icon: Shield },
];

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login?next=/settings');

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-4 lg:grid lg:grid-cols-[220px_1fr] lg:gap-6 lg:px-6 lg:pt-8">
      <aside className="mb-4 lg:mb-0">
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isDisabled = !!item.phase;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-disabled={isDisabled}
                title={item.phase ? `${item.label} — ${item.phase}` : item.label}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isDisabled
                    ? 'pointer-events-none text-muted-foreground opacity-50'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
