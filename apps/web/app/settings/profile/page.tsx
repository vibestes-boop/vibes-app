import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getUser, getProfile } from '@/lib/auth/session';
import { getT } from '@/lib/i18n/server';
import { ProfileEditForm } from '@/components/settings/profile-edit-form';

// -----------------------------------------------------------------------------
// /settings/profile — v1.w.UI.20 D7-Follow-up.
//
// Dediziertes Editor-Screen für Anzeigename + Bio. Username ist readonly
// sichtbar (damit der User „weiß, wo er ist") aber nicht editierbar — der
// Rename-Flow ist Cascade-Risiko und bleibt explizit out-of-scope.
//
// Avatar ist in diesem Slice ebenfalls nicht editierbar — das R2-Upload-
// Widget (File-Input + Preview + Crop) verdient einen eigenen Slice und
// würde hier den Editor überfordern, ohne das Feature wirklich zu liefern.
// -----------------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('settings.profileMetaTitle'),
    robots: { index: false },
  };
}

export default async function ProfileSettingsPage() {
  const [user, profile, t] = await Promise.all([getUser(), getProfile(), getT()]);

  if (!user) {
    redirect('/login?next=/settings/profile');
  }

  // Edge case: User eingeloggt aber `profiles`-Row fehlt (Onboarding noch nicht
  // abgeschlossen — claimUsername wurde nie aufgerufen). Wir schicken ihn
  // dorthin, damit er zuerst einen Username claimt; danach kann er sein Profil
  // bearbeiten.
  if (!profile) {
    redirect('/onboarding/username');
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Back-Link zur Settings-Overview — redundant mit der Layout-NAV auf
          Desktop, aber auf Mobile (wo die NAV eine horizontal-scrollende
          Tab-Leiste ist) ist der explizite Back-Affordance wichtig. */}
      <Link
        href={'/settings' as Route}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('settings.profileBackToOverview')}
      </Link>

      <header className="mb-6 px-4 sm:px-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.profileTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.profileSubtitle')}
        </p>
      </header>

      <ProfileEditForm
        initialDisplayName={profile.display_name ?? ''}
        initialBio={profile.bio ?? ''}
        username={profile.username ?? ''}
        labels={{
          displayName: t('settings.profileFieldDisplayName'),
          displayNameHint: t('settings.profileFieldDisplayNameHint'),
          bio: t('settings.profileFieldBio'),
          bioHint: t('settings.profileFieldBioHint'),
          username: t('settings.profileFieldUsername'),
          usernameHint: t('settings.profileFieldUsernameHint'),
          save: t('settings.profileSave'),
          saving: t('settings.profileSaving'),
          saved: t('settings.profileSaved'),
          errorFallback: t('settings.profileErrorFallback'),
        }}
      />
    </div>
  );
}
