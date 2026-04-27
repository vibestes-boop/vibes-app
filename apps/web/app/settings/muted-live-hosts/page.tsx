import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { BellOff, Bell } from 'lucide-react';

import { getMutedLiveHosts } from '@/app/actions/live-prefs';
import { UnmuteHostButton } from '@/components/settings/unmute-host-button';

// -----------------------------------------------------------------------------
// /settings/muted-live-hosts — v1.w.UI.153
//
// Liste aller Hosts deren Go-Live-Pushes der User stummgeschaltet hat.
// Parität zu mobile `app/settings/muted-live-hosts.tsx`.
//
// Datenquelle: `muted_live_hosts` + Join auf `profiles`.
// RLS filtert auf `user_id = auth.uid()` — kein extra .eq()-Guard nötig.
//
// Unmute läuft als Server-Action (`unmuteHost`) + router.refresh() im
// UnmuteHostButton Client-Wrapper. Layout Auth-Gate redirected bereits.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Stumm geschaltete Lives',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function MutedLiveHostsPage() {
  const hosts = await getMutedLiveHosts();

  return (
    <div>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight lg:text-3xl">
          <BellOff className="h-6 w-6" />
          Stumm geschaltete Lives
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Du erhältst keine Benachrichtigung wenn diese Hosts live gehen. Tippe auf „Aktivieren" um
          Push-Benachrichtigungen wieder einzuschalten.
        </p>
      </header>

      {hosts.length === 0 ? (
        <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-base font-semibold">Keine stumm geschalteten Hosts</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Du bekommst Benachrichtigungen von allen Accounts denen du folgst, wenn sie live gehen.
            Wenn du den Go-Live-Push eines bestimmten Creators nicht mehr möchtest, kannst du ihn
            auf seinem Profil stummschalten.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {hosts.map((row) => {
              const initial = (row.username ?? '?').charAt(0).toUpperCase();
              return (
                <li key={row.host_id} className="flex items-center gap-3 px-4 py-3">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {row.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.avatar_url}
                        alt={row.username ? `@${row.username}` : 'Avatar'}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-base font-semibold text-muted-foreground">
                        {initial}
                      </div>
                    )}
                    {/* Muted-Badge */}
                    <div className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-orange-500 text-white">
                      <BellOff className="h-2.5 w-2.5" strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    {row.username ? (
                      <Link
                        href={`/u/${row.username}` as Route}
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        @{row.username}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-semibold text-muted-foreground">
                        Unbekannter Nutzer
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      Stumm seit {formatDate(row.muted_at)}
                    </span>
                  </div>

                  <UnmuteHostButton hostId={row.host_id} username={row.username} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
