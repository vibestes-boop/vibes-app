import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ShieldOff, Users } from 'lucide-react';

import { getCoHostBlocks } from '@/app/actions/live-prefs';
import { UnblockCoHostButton } from '@/components/settings/unblock-cohost-button';

// -----------------------------------------------------------------------------
// /settings/cohost-blocks — v1.w.UI.154
//
// Liste aller User die du vom Co-Hosting gesperrt hast (`live_cohost_blocks`).
// Parität zu mobile `app/cohost-blocks.tsx`.
//
// Ein geblockter User kann weiterhin deine Lives als Viewer schauen, aber
// NICHT mehr als Co-Host beitreten.
//
// Zeigt nur aktive (nicht abgelaufene) Blocks. Ablauf-Datum wird als
// Hinweis angezeigt wenn gesetzt. Entblocken via RPC `unblock_cohost`.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Co-Host-Sperrliste',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function ExpiresLabel({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) {
    return <span className="text-[11px] text-rose-500">Dauerhaft gesperrt</span>;
  }
  const d = new Date(expiresAt);
  const diffMs = d.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays <= 0) return null;
  if (diffDays === 1) return <span className="text-[11px] text-amber-500">Läuft morgen ab</span>;
  if (diffDays <= 7) return <span className="text-[11px] text-amber-500">Läuft in {diffDays} Tagen ab</span>;
  return <span className="text-[11px] text-muted-foreground">Bis {formatDate(expiresAt)}</span>;
}

export default async function CoHostBlocksPage() {
  const blocks = await getCoHostBlocks();

  return (
    <div>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight lg:text-3xl">
          <ShieldOff className="h-6 w-6" />
          Co-Host-Sperrliste
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gesperrte Nutzer können weiterhin deine Lives als Zuschauer sehen, aber nicht mehr als
          Co-Host beitreten. Du kannst Sperren hier jederzeit aufheben.
        </p>
      </header>

      {blocks.length === 0 ? (
        <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-base font-semibold">Keine Co-Host-Sperren</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Deine Co-Host-Sperrliste ist leer. Wenn jemand als Co-Host stört, kannst du ihn direkt
            aus dem Live heraus sperren.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {blocks.map((row) => {
              const initial = (row.username ?? '?').charAt(0).toUpperCase();
              return (
                <li key={row.blocked_user_id} className="flex items-center gap-3 px-4 py-3">
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
                    {/* Block-Badge */}
                    <div className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-rose-500 text-white">
                      <ShieldOff className="h-2.5 w-2.5" strokeWidth={2.5} />
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
                    <ExpiresLabel expiresAt={row.expires_at} />
                    {row.reason && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        Grund: {row.reason}
                      </p>
                    )}
                  </div>

                  <UnblockCoHostButton blockedUserId={row.blocked_user_id} username={row.username} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
