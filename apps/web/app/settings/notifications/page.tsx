import type { Metadata } from 'next';
import { Bell } from 'lucide-react';

import { WebPushCard } from '@/components/settings/web-push-card';
import { NotifPrefsCard } from '@/components/settings/notif-prefs-card';
import { getT } from '@/lib/i18n/server';
import { getNotifPrefs } from '@/app/actions/profile';

// -----------------------------------------------------------------------------
// /settings/notifications — Benachrichtigungs-Einstellungen.
//
// Phase-12-Scope: nur Browser-Push (v1.w.12.4). Channel-Presets (DM /
// Go-Live / Gift) und E-Mail-Digest kommen in späteren Slices. Das UI
// lässt trotzdem Platz dafür damit die Struktur stabil bleibt.
// -----------------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('settings.notifMetaTitle'),
    robots: { index: false },
  };
}

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const t = await getT();
  const initialPrefs = await getNotifPrefs();

  return (
    <div>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight lg:text-3xl">
          <Bell className="h-6 w-6" />
          {t('settings.notifTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.notifSubtitle')}</p>
      </header>

      <WebPushCard />

      <div className="mt-6">
        <NotifPrefsCard initialPrefs={initialPrefs} />
      </div>
    </div>
  );
}
