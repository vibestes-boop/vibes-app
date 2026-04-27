import type { Metadata } from 'next';
import type { Route } from 'next';
import {
  User as UserIcon,
  Receipt,
  Bell,
  Shield,
  Languages,
  Palette,
  UserX,
  Trash2,
  BellOff,
  ShieldOff,
} from 'lucide-react';

import { SettingsRow } from '@/components/settings/settings-row';
import { SignOutRow } from '@/components/settings/sign-out-row';
import { ThemeToggleInline } from '@/components/settings/theme-toggle-inline';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_LABELS } from '@/lib/i18n/config';

// -----------------------------------------------------------------------------
// /settings (Root) — v1.w.UI.18 D7 TikTok-Parity Settings-Overview.
//
// Ersetzt den bisherigen Redirect auf /settings/billing durch eine echte
// flache Liste: drei Sektionen (Konto, App, Gefahrenzone) mit Icon + Label +
// Subtitle + Chevron-Right — genau das Pattern das TikTok/Instagram/iOS in
// ihren Settings verwenden. Dichtere, klarere Information-Architektur als
// eine gekapselte Card-UI.
//
// Warum hier, nicht im Layout: Das bestehende `/settings/layout.tsx` rendert
// auf Desktop eine Sidebar-Nav für Sub-Routes (Billing, Notifications, etc.)
// und bleibt unverändert — die Overview-Liste ist nur die Inhaltsfläche
// dieser Layout-Grid-Column. Auf Mobile (`lg:` Breakpoints nicht aktiv) ist
// die Sidebar eine horizontal scrollende Tab-Leiste und die flache Liste
// darunter ist das Hauptnavigations-Tool.
// -----------------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('settings.overviewMetaTitle'),
    robots: { index: false },
  };
}

export default async function SettingsOverviewPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const localeLabel = LOCALE_LABELS[locale].native;

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header — bewusst nicht sticky, damit das Overview-Gefühl „Zuhause in
          den Einstellungen" ist und nicht „scrollbares Dokument". */}
      <header className="mb-6 px-4 sm:px-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.overviewTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.overviewSubtitle')}
        </p>
      </header>

      {/* Sektion 1 — Konto. v1.w.UI.20: Profil ist jetzt live — Row linkt auf
          /settings/profile (display_name + bio editieren, Avatar folgt in
          eigenem Slice). Der ComingSoonBadge-Fall wurde entfernt.
          Die anderen drei Rows linken auf die existierenden Sub-Routes. */}
      <Section label={t('settings.sectionAccount')}>
        <SettingsRow
          icon={UserIcon}
          label={t('settings.navProfile')}
          subtitle={t('settings.rowProfileSubtitle')}
          href={'/settings/profile' as Route}
          testId="settings-row-profile"
        />
        <SettingsRow
          icon={Receipt}
          label={t('settings.navBilling')}
          subtitle={t('settings.rowBillingSubtitle')}
          href={'/settings/billing' as Route}
          testId="settings-row-billing"
        />
        <SettingsRow
          icon={Bell}
          label={t('settings.navNotifications')}
          subtitle={t('settings.rowNotificationsSubtitle')}
          href={'/settings/notifications' as Route}
          testId="settings-row-notifications"
        />
        <SettingsRow
          icon={Shield}
          label={t('settings.navPrivacy')}
          subtitle={t('settings.rowPrivacySubtitle')}
          href={'/settings/privacy' as Route}
          testId="settings-row-privacy"
        />
      </Section>

      {/* Sektion 2 — App. Theme + Language + Blocked-Users.
          Design-Row: `right={<ThemeToggleInline />}` — kein Chevron, kein
          Link, der Toggle ist das interaktive Element.
          Sprache: statische Row die das aktuelle Label rechts zeigt; Wechsel
          läuft weiterhin über den LocaleSwitcher im TopRightActions-Dropdown
          (kein eigener Settings-Route nötig, weil Cookie + router.refresh()
          reicht und eine dedizierte Sprach-Page hier Overkill wäre).
          Geblockte Nutzer linkt auf /settings/blocked. */}
      <Section label={t('settings.sectionApp')}>
        <SettingsRow
          icon={Palette}
          label={t('settings.rowThemeLabel')}
          right={
            <ThemeToggleInline
              lightLabel={t('settings.rowThemeLight')}
              darkLabel={t('settings.rowThemeDark')}
            />
          }
          testId="settings-row-theme"
        />
        <SettingsRow
          icon={Languages}
          label={t('settings.rowLanguageLabel')}
          right={<span className="font-medium text-foreground">{localeLabel}</span>}
          testId="settings-row-language"
        />
        <SettingsRow
          icon={UserX}
          label={t('settings.rowBlockedLabel')}
          subtitle={t('settings.rowBlockedSubtitle')}
          href={'/settings/blocked' as Route}
          testId="settings-row-blocked"
        />
        <SettingsRow
          icon={BellOff}
          label={t('settings.rowMutedHostsLabel')}
          subtitle={t('settings.rowMutedHostsSubtitle')}
          href={'/settings/muted-live-hosts' as Route}
          testId="settings-row-muted-hosts"
        />
        <SettingsRow
          icon={ShieldOff}
          label={t('settings.rowCohostBlocksLabel')}
          subtitle={t('settings.rowCohostBlocksSubtitle')}
          href={'/settings/cohost-blocks' as Route}
          testId="settings-row-cohost-blocks"
        />
      </Section>

      {/* Sektion 3 — Gefahrenzone. Abmelden + Konto löschen, beide rot.
          SignOutRow ist Form-basiert (Server-Action), DeleteAccount ist ein
          Link auf einen hypothetischen /settings/delete-account — falls der
          nicht existiert nutzen wir /settings/privacy (wo die DeleteAccountCard
          lebt). Kurzcheck: privacy ist das richtige Target bis eine dedizierte
          Seite kommt.
          SignOutRow bekommt bewusst KEIN `icon`-Prop — Lucide-Icons sind
          forwardRef-Funktionen und dürfen nicht von einer Server-Component
          als Prop an eine Client-Component gereicht werden (→ RSC-Boundary-
          Crash "Functions cannot be passed directly to Client Components",
          Vercel-Error digest 1974146109 vom 2026-04-24). SignOutRow hardcoded
          `LogOut` intern. */}
      <Section label={t('settings.sectionDanger')}>
        <SignOutRow label={t('settings.rowSignOutLabel')} />
        <SettingsRow
          icon={Trash2}
          label={t('settings.rowDeleteLabel')}
          subtitle={t('settings.rowDeleteSubtitle')}
          href={'/settings/privacy' as Route}
          variant="destructive"
          testId="settings-row-delete"
        />
      </Section>
    </div>
  );
}

// Eine Section ist ein Uppercase-Kleinheader + divide-y-List. `divide-y` gibt
// zwischen den Rows einen Hairline-Strich im `border`-Token — Apple/iOS-Style.
// Der Container hat selbst keinen Border/Shadow — das Pattern ist „Liste in
// der Seite", nicht „Card in der Seite".
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-8" data-settings-section={label}>
      <h2 className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-0">
        {label}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-xl bg-card/50 ring-1 ring-border sm:rounded-xl">
        {children}
      </div>
    </section>
  );
}
