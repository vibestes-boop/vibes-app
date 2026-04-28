import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck, Lock } from 'lucide-react';

import { getUser } from '@/lib/auth/session';
import { getWOZFeed } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';
import { PostGrid } from '@/components/profile/post-grid';
import { WozJoinButton } from '@/components/woz/woz-join-button';

// -----------------------------------------------------------------------------
// /woz — Women-Only Zone Hub.
//
// v1.w.UI.213: Parity mit app/women-only/index.tsx.
//
// Zwei Zustände:
//   1. Nicht verifiziert → Premium-Onboarding mit "Beitreten"-CTA
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

export default async function WozPage() {
  const status = await getWozStatus();

  if (!status) {
    redirect('/login?next=/woz');
  }

  // ── Unverified State ────────────────────────────────────────────────────────
  if (!status.isVerified) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
          <ShieldCheck className="h-10 w-10 text-pink-500" />
        </div>

        {/* Headline */}
        <h1 className="mb-2 text-2xl font-bold">Women-Only Zone</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Ein geschützter, privater Bereich nur für Frauen. Teile Inhalte in einer
          sicheren Community, sichtbar nur für verifizierte Mitglieder.
        </p>

        {/* Feature Pills */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {[
            '🔒 Nur für Frauen sichtbar',
            '🛡 Geschützter Feed',
            '💜 Community-Gefühl',
          ].map((f) => (
            <span
              key={f}
              className="rounded-full bg-pink-500/10 px-3 py-1 text-xs font-medium text-pink-600 dark:text-pink-400"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Info Box */}
        <div className="mb-6 rounded-xl border border-pink-500/20 bg-pink-500/5 p-4 text-left text-sm text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">So funktioniert es:</p>
          <ul className="space-y-1.5">
            <li>• Du bestätigst dein Geschlecht als weiblich (Level 1 – Selbstdeklaration).</li>
            <li>• Deine Inhalte mit „Women-Only"-Markierung sind nur für verifizierte Mitglieder sichtbar.</li>
            <li>• Der WOZ-Feed zeigt dir alle solchen Beiträge aus der Community.</li>
          </ul>
        </div>

        <WozJoinButton />

        <p className="mt-4 text-xs text-muted-foreground">
          Mit dem Beitreten bestätigst du, dass du weiblich bist. Eine spätere
          Identitätsverifizierung (Level 2) kann folgen.
        </p>
      </main>
    );
  }

  // ── Verified State ──────────────────────────────────────────────────────────
  const posts = await getWOZFeed(60);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Women-Only Zone</h1>
          <p className="text-xs text-muted-foreground">
            {posts.length > 0
              ? `${posts.length} Beiträge · Nur für verifizierte Mitglieder`
              : 'Nur für verifizierte Mitglieder'}
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-pink-600 dark:text-pink-400">
          <ShieldCheck className="h-3 w-3" />
          Verifiziert
        </span>
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
