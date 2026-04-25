import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getUser } from '@/lib/auth/session';
import { getMyActiveLiveSession } from '@/lib/data/live-host';
import { LiveModeTabs } from '@/components/live/live-mode-tabs';

// -----------------------------------------------------------------------------
// /live/start — Setup-Screen. Wenn der Host bereits einen aktiven Stream hat,
// leiten wir direkt auf `/live/host/[id]` um (kein Doppel-Stream).
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Live starten',
  description: 'Kamera + Mikro einstellen und loslegen.',
};

export const dynamic = 'force-dynamic';

export default async function LiveStartPage() {
  const user = await getUser();
  if (!user) {
    redirect('/login?next=/live/start' as Route);
  }

  const existing = await getMyActiveLiveSession();
  if (existing) {
    redirect(`/live/host/${existing.id}` as Route);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Live gehen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wähle Browser für schnelles Live-Gehen oder OBS für Pro-Setup mit höherer Qualität.
        </p>
      </header>

      <LiveModeTabs />
    </div>
  );
}
