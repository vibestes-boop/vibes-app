import type { Metadata } from 'next';
import { Bell } from 'lucide-react';

import { WebPushCard } from '@/components/settings/web-push-card';

// -----------------------------------------------------------------------------
// /settings/notifications — Benachrichtigungs-Einstellungen.
//
// Phase-12-Scope: nur Browser-Push (v1.w.12.4). Channel-Presets (DM /
// Go-Live / Gift) und E-Mail-Digest kommen in späteren Slices. Das UI
// lässt trotzdem Platz dafür damit die Struktur stabil bleibt.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Benachrichtigungen — Serlo',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default function NotificationsPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight lg:text-3xl">
          <Bell className="h-6 w-6" />
          Benachrichtigungen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entscheide, wie wir dich erreichen — Browser-Push für Desktop und Handy.
        </p>
      </header>

      <WebPushCard />

      <section className="mt-6 rounded-xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
        <p>
          E-Mail-Digest und feinere Kanal-Einstellungen (DM / Go-Live / Geschenke
          einzeln togglen) kommen mit einem der nächsten Updates.
        </p>
      </section>
    </div>
  );
}
