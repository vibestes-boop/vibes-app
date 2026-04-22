import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ShieldOff, UserX } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { UnblockButton } from '@/components/settings/unblock-button';

// -----------------------------------------------------------------------------
// /settings/blocked — Liste aller von dir geblockten Nutzer. Apple-Store-Pflicht:
// User müssen Blocks selbst wieder aufheben können. Layout (`settings/layout.tsx`)
// handled bereits Auth-Redirect, hier nur Query + Render.
//
// Datenquelle: `user_blocks` + Join auf `profiles`. RLS-Policy
// `user_blocks_select` filtert automatisch auf `blocker_id = auth.uid()`,
// ein zusätzlicher `.eq('blocker_id', …)` Guard ist nicht nötig, schadet aber
// auch nicht (defense-in-depth + schneller Index-Hit über PK).
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Geblockte Nutzer',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

interface BlockedRow {
  blocked_id: string;
  created_at: string;
  profiles: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export default async function BlockedUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Safety-Net — Layout redirected eigentlich schon, aber falls jemand hier
  // direkt reinspringt wollen wir keinen Runtime-Error.
  if (!user) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight lg:text-3xl">
            <UserX className="h-6 w-6" />
            Geblockte Nutzer
          </h1>
        </header>
        <p className="text-sm text-muted-foreground">Bitte einloggen.</p>
      </div>
    );
  }

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at, profiles:blocked_id(id, username, avatar_url)')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false })
    .returns<BlockedRow[]>();

  const blocked: BlockedRow[] = !error && data ? data : [];

  return (
    <div>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight lg:text-3xl">
          <UserX className="h-6 w-6" />
          Geblockte Nutzer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nutzer, die du blockierst, sehen dein Profil und deine Posts nicht mehr. Du kannst Blocks
          hier jederzeit wieder aufheben.
        </p>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-500">
          Geblockte Nutzer konnten nicht geladen werden: {error.message}
        </section>
      ) : blocked.length === 0 ? (
        <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <ShieldOff className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-base font-semibold">Keine geblockten Nutzer</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Hier tauchen Profile auf, die du blockierst. Aktuell ist deine Blockliste leer.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {blocked.map((row) => {
              const profile = row.profiles;
              const username = profile?.username ?? null;
              const avatarUrl = profile?.avatar_url ?? null;
              const initial = (username ?? '?').charAt(0).toUpperCase();
              return (
                <li key={row.blocked_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="relative shrink-0">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={username ? `@${username}` : 'Avatar'}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-base font-semibold text-muted-foreground">
                        {initial}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-rose-500 text-white">
                      <UserX className="h-2.5 w-2.5" strokeWidth={2.5} />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    {username ? (
                      <Link
                        href={`/u/${username}` as Route}
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        @{username}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-semibold text-muted-foreground">
                        Unbekannter Nutzer
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-rose-500">Geblockt</span>
                  </div>

                  <UnblockButton targetUserId={row.blocked_id} username={username} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
