import { redirect } from 'next/navigation';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { User as UserIcon, Receipt, Shield, Bell, Home } from 'lucide-react';

import { getUser } from '@/lib/auth/session';
import { getT } from '@/lib/i18n/server';
import type { TranslationKey } from '@/lib/i18n/translate';

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
  labelKey: TranslationKey;
  href: Route;
  icon: typeof UserIcon;
  phaseKey?: TranslationKey;
}

// v1.w.UI.18: Erster Eintrag ist „Übersicht" (enabled, linkt auf /settings
// Root = flache Overview-Liste).
// v1.w.UI.20: Zweiter Eintrag „Profil" ist jetzt live (linkt auf
// /settings/profile = Editor für display_name + bio). Position bewusst
// direkt nach Übersicht — Account-Identity kommt vor Zahlungen und
// Notification-Präferenzen.
const NAV: SettingsNavItem[] = [
  { labelKey: 'settings.navOverview',      href: '/settings' as Route,               icon: Home },
  { labelKey: 'settings.navProfile',       href: '/settings/profile' as Route,       icon: UserIcon },
  { labelKey: 'settings.navBilling',       href: '/settings/billing' as Route,       icon: Receipt },
  { labelKey: 'settings.navNotifications', href: '/settings/notifications' as Route, icon: Bell },
  { labelKey: 'settings.navPrivacy',       href: '/settings/privacy' as Route,       icon: Shield },
];

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const [user, t] = await Promise.all([getUser(), getT()]);
  if (!user) redirect('/login?next=/settings');

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-4 lg:grid lg:grid-cols-[220px_1fr] lg:gap-6 lg:px-6 lg:pt-8">
      <aside className="mb-4 lg:mb-0">
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isDisabled = !!item.phaseKey;
            const label = t(item.labelKey);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-disabled={isDisabled}
                title={item.phaseKey ? `${label} — ${t(item.phaseKey)}` : label}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isDisabled
                    ? 'pointer-events-none text-muted-foreground opacity-50'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
