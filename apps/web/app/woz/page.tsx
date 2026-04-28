import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck, Lock, Eye, Users, Sparkles } from 'lucide-react';

import { getUser } from '@/lib/auth/session';
import { getWOZFeed } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';
import { PostGrid } from '@/components/profile/post-grid';
import { WozJoinButton } from '@/components/woz/woz-join-button';
import { WozLeaveButton } from '@/components/woz/woz-leave-button';

// -----------------------------------------------------------------------------
// /woz — Women-Only Zone Hub.
//
// v1.w.UI.213: Parity mit app/women-only/index.tsx.
//
// Zwei Zustände:
//   1. Nicht verifiziert → Premium-Gate mit "Beitreten"-CTA
//   2. Verifiziert → WOZ-Post-Grid (getWOZFeed, RLS schützt serverseitig)
//
// Auth-Gate: Nicht-eingeloggte → /login?next=/woz.
// Verification-Check: gender='female' && women_only_verified=true.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Women-Only Zone — Serlo',
  description: 'Ein geschützter Bereich nur für Frauen auf Serlo.',
  robots: { index: false, follow: false },
};

async function getWozStatus(): Promise<{
  isVerified: boolean;
  verificationLevel: number;
} | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('gender, women_only_verified, verification_level')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return { isVerified: false, verificationLevel: 0 };

  const row = data as {
    gender: string | null;
    women_only_verified: boolean | null;
    verification_level: number | null;
  };

  const isVerified =
    row.gender === 'female' && row.women_only_verified === true;

  return {
    isVerified,
    verificationLevel: row.verification_level ?? 0,
  };
}

const FEATURES = [
  {
    icon: Eye,
    title: 'Vollständig privat',
    desc: 'Deine Inhalte sind ausschließlich für verifizierte Mitglieder sichtbar.',
  },
  {
    icon: Users,
    title: 'Eigener Community-Feed',
    desc: 'Alle Women-Only Beiträge aus der Community auf einen Blick.',
  },
  {
    icon: Sparkles,
    title: 'Sofort aktivierbar',
    desc: 'Level-1-Selbstdeklaration genügt. Level-2-Verifikation folgt optional.',
  },
];

export default async function WozPage() {
  const status = await getWozStatus();

  if (!status) {
    redirect('/login?next=/woz');
  }

  // ── Unverified State ────────────────────────────────────────────────────────
  if (!status.isVerified) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        {/* Wordmark / badge */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-rose-500 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400">
            <ShieldCheck className="h-3 w-3" />
            Women-Only Zone
          </span>
        </div>

        {/* Headline */}
        <h1 className="mb-3 text-[2rem] font-semibold leading-[1.15] tracking-tight text-foreground">
          Ein Raum,<br />
          der dir gehört.
        </h1>
        <p className="mb-10 text-[15px] leading-relaxed text-muted-foreground">
          Ein geschützter Bereich auf Serlo, in dem Frauen offen teilen können —
          sichtbar nur für verifizierte Mitglieder.
        </p>

        {/* Feature rows */}
        <ul className="mb-10 space-y-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex items-start gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-foreground/70" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <WozJoinButton />

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          Mit dem Beitreten bestätigst du, dass du weiblich bist.
        </p>
      </main>
    );
  }

  // ── Verified State ──────────────────────────────────────────────────────────
  const posts = await getWOZFeed(60);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-semibold tracking-tight">Women-Only Zone</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500 dark:text-rose-400">
            <ShieldCheck className="h-3 w-3" />
            Verifiziert
          </span>
        </div>
        <div className="flex items-center gap-3">
          {posts.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {posts.length} Beiträge
            </span>
          )}
          <WozLeaveButton />
        </div>
      </div>

      {/* Post Grid */}
      <PostGrid
        posts={posts}
        emptyTitle="Noch keine WOZ-Beiträge"
        emptyDescription="Erstelle deinen ersten Women-Only Beitrag im Feed."
        emptyIcon={<Lock className="h-8 w-8" />}
        initialHasMore={posts.length >= 60}
        fetchMoreUrl="/api/posts/woz"
      />
    </main>
  );
}
