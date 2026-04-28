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
  Sparkles,
  LayoutDashboard,
} from 'lucide-react';

import { SettingsRow } from '@/components/settings/settings-row';
import { SignOutRow } from '@/components/settings/sign-out-row';
import { ThemeToggleInline } from '@/components/settings/theme-toggle-inline';
import { AccountSecurityRows } from '@/components/settings/account-security-rows';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_LABELS } from '@/lib/i18n/config';
import { getProfile } from '@/lib/auth/session';

// -----------------------------------------------------------------------------
// /settings (Root) — v1.w.UI.18 D7 TikTok-Parity Settings-Overview.
//
// v1.w.UI.163: Creator-Row hinzugefügt — zeigt "Creator Studio" (→ /studio)
// für bestehende Creators, "Creator werden ✦" (→ /creator/activate) für alle
// anderen. Mobile-Parität (settings.tsx: is_creator-Branch auf gleiche Routes).
//
// v1.w.UI.189: Women-Only Zone row + Account-Security section (email/pw change).
// Mobile-Parität (settings.tsx: WOZ section + Account section mit E-Mail/Passwort).
// -----------------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('settings.overviewMetaTitle'),
    robots: { index: false },
  };
}

export const dynamic = 'force-dynamic';

export default async function SettingsOverviewPage() {
  const [t, locale, profile] = await Promise.all([getT(), getLocale(), getProfile()]);
  const localeLabel = LOCALE_LABELS[locale].native;
  const isCreator = profile && (profile as unknown as { is_creator?: boolean }).is_creator;
  // v1.w.UI.189 — WOZ status for settings row badge
  const isWozActive =
    (profile as unknown as { gender?: string; women_only_verified?: boolean } | null)?.gender === 'female' &&
    (profile as unknown as { women_only_verified?: boolean } | null)?.women_only_verified === true;

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header */}
      <header className="mb-6 px-4 sm:px-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.overviewTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.overviewSubtitle')}
        </p>
      </header>

      {/* Sektion 1 — Konto */}
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
        {/* v1.w.UI.163 — Creator-Row. Mobile: settings.tsx → is_creator-Branch */}
        {isCreator ? (
          <SettingsRow
            icon={LayoutDashboard}
            label={t('settings.rowCreatorStudioLabel')}
            subtitle={t('settings.rowCreatorStudioSubtitle')}
            href={'/studio' as Route}
            testId="settings-row-creator-studio"
          />
        ) : (
          <SettingsRow
            icon={Sparkles}
            label={t('settings.rowCreatorActivateLabel')}
            subtitle={t('settings.rowCreatorActivateSubtitle')}
            href={'/creator/activate' as Route}
            testId="settings-row-creator-activate"
          />
        )}
      </Section>

      {/* Sektion 1b — Women-Only Zone 🌸 (v1.w.UI.189) */}
      {/* Shown to all logged-in users (activation is opt-in). For guests the
          /women-only page handles the redirect-to-login guard. */}
      <Section label={t('settings.sectionWoz')}>
        <SettingsRow
          icon={HeartFlower}
          label={t('settings.rowWozLabel')}
          subtitle={isWozActive ? t('settings.rowWozActiveSubtitle') : t('settings.rowWozSubtitle')}
          href={'/women-only' as Route}
          right={
            isWozActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-600 dark:text-pink-400">
                {t('settings.rowWozActiveBadge')}
              </span>
            ) : undefined
          }
          testId="settings-row-woz"
        />
      </Section>

      {/* Sektion 2 — App */}
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

      {/* Sektion 2b — Account-Sicherheit (v1.w.UI.189) */}
      {/* Email + Passwort ändern. Client-Component wegen inline-expandable forms. */}
      <Section label={t('settings.sectionSecurity')}>
        <AccountSecurityRows
          labels={{
            rowChangeEmailLabel: t('settings.rowChangeEmailLabel'),
            rowChangeEmailSubtitle: t('settings.rowChangeEmailSubtitle'),
            rowChangePasswordLabel: t('settings.rowChangePasswordLabel'),
            rowChangePasswordSubtitle: t('settings.rowChangePasswordSubtitle'),
            securityEmailPlaceholder: t('settings.securityEmailPlaceholder'),
            securityEmailSubmit: t('settings.securityEmailSubmit'),
            securityEmailSubmitting: t('settings.securityEmailSubmitting'),
            securityEmailSuccess: t('settings.securityEmailSuccess'),
            securityPasswordPlaceholder: t('settings.securityPasswordPlaceholder'),
            securityPasswordConfirmPlaceholder: t('settings.securityPasswordConfirmPlaceholder'),
            securityPasswordSubmit: t('settings.securityPasswordSubmit'),
            securityPasswordSubmitting: t('settings.securityPasswordSubmitting'),
            securityPasswordSuccess: t('settings.securityPasswordSuccess'),
            securityPasswordMismatch: t('settings.securityPasswordMismatch'),
            securityPasswordTooShort: t('settings.securityPasswordTooShort'),
            securityCancel: t('settings.securityCancel'),
          }}
        />
      </Section>

      {/* Sektion 3 — Gefahrenzone */}
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

// ─── WOZ icon (inline SVG flower — no external dep) ──────────────────────────
// We can't pass lucide Icons as component-props across RSC boundaries,
// but SettingsRow accepts `icon: ComponentType<{className?:string}>`.
// We define a tiny flower SVG as a local function component (not forwardRef).
function HeartFlower({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Simple flower/heart hybrid — 6 petals around center */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="7" rx="1.5" ry="3" />
      <ellipse cx="12" cy="17" rx="1.5" ry="3" />
      <ellipse cx="7" cy="12" rx="3" ry="1.5" />
      <ellipse cx="17" cy="12" rx="3" ry="1.5" />
      <ellipse cx="8.5" cy="8.5" rx="1.5" ry="3" transform="rotate(-45 8.5 8.5)" />
      <ellipse cx="15.5" cy="15.5" rx="1.5" ry="3" transform="rotate(-45 15.5 15.5)" />
      <ellipse cx="15.5" cy="8.5" rx="1.5" ry="3" transform="rotate(45 15.5 8.5)" />
      <ellipse cx="8.5" cy="15.5" rx="1.5" ry="3" transform="rotate(45 8.5 15.5)" />
    </svg>
  );
}

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
