import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';
import Link from 'next/link';

import { getProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { InviteShare } from '@/components/referral/invite-share';

// -----------------------------------------------------------------------------
// /settings/invite — Web-Invite-Fläche (#5 Referral, Parität zur App).
//
// Schließt das in Session 6 begonnene Referral-System web-seitig: bisher konnte
// nur die App den eigenen Einladungslink teilen + den Zähler zeigen. Belohnung
// bleibt bewusst außen vor (manuelle Entscheidung) — hier nur Teilen + Zähler.
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Freund:innen einladen',
  robots: { index: false },
};

export default async function InvitePage() {
  const profile = await getProfile();
  // Nicht eingeloggt / kein Profil → zurück zu den Einstellungen (Auth-Guard im Layout).
  if (!profile?.username) redirect('/settings' as Route);

  const supabase = await createClient();
  const { data: count } = await supabase.rpc('get_my_referral_count');
  const referralCount = typeof count === 'number' ? count : 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 px-4 sm:px-0">
        <Link
          href={'/settings' as Route}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Einstellungen
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Freund:innen einladen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teile deinen Link — bring die Community zusammen 🌸
        </p>
      </header>

      <section className="mb-6 rounded-xl bg-card/50 p-4 ring-1 ring-border sm:p-5">
        <InviteShare username={profile.username} />
      </section>

      {/* Zähler — warmer Erfolgs-Hinweis, nur wenn schon jemand dabei ist. */}
      <section className="flex items-center gap-3 rounded-xl bg-card/50 px-4 py-3 ring-1 ring-border">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400">
          <UserPlus className="h-4 w-4" />
        </span>
        <p className="text-sm text-muted-foreground">
          {referralCount > 0 ? (
            <>
              <span className="font-semibold text-foreground">{referralCount}</span>{' '}
              {referralCount === 1 ? 'Person ist' : 'Personen sind'} über dich dabei 🌸
            </>
          ) : (
            'Noch niemand über dich dabei — teile den Link und sei die:der Erste.'
          )}
        </p>
      </section>
    </div>
  );
}
