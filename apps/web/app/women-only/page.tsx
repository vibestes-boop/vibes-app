import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Lock, ShieldCheck, Video, Heart, Users, Sparkles } from 'lucide-react';

import { getProfile } from '@/lib/auth/session';
import { getWOZFeed } from '@/lib/data/public';
import { PostGrid } from '@/components/profile/post-grid';
import { WozActivateForm } from '@/components/women-only/woz-activate-form';

// -----------------------------------------------------------------------------
// /women-only — Women-Only Zone Hub.
// v1.w.UI.167: Parity mit app/women-only/index.tsx.
//
// Zwei Zustände:
//   1. Nicht eingeloggt → Redirect /login
//   2. Eingeloggt aber nicht verifiziert → Onboarding-Screen mit Beitreten-CTA
//   3. Verifiziert (gender=female + women_only_verified=true) → WOZ-Feed
//
// Security-Ebene: RLS auf `posts` schränkt women_only=true Posts automatisch
// auf is_women_only_verified()-User ein. Selbst wenn die Page-Guard umgangen
// wird, sieht der User keine gesperrten Posts.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Women-Only Zone 🌸 — Serlo',
  description: 'Ein geschützter Raum nur für Frauen auf Serlo.',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

// ─── Benefits list ────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: Lock,
    title: 'Privater Raum',
    desc: 'Nur für verifizierte Mitglieder sichtbar — kein öffentlicher Zugang.',
  },
  {
    icon: ShieldCheck,
    title: 'Sicher & respektvoll',
    desc: 'Inhalte nur von anderen WOZ-Mitgliedern. Strenge Community-Regeln.',
  },
  {
    icon: Video,
    title: 'Exklusive Videos',
    desc: 'Posts, Lives und Stories die nur du und andere WOZ-Mitglieder sehen.',
  },
  {
    icon: Heart,
    title: 'Authentische Community',
    desc: 'Teile was du sonst nicht teilen würdest — in einem vertrauensvollen Umfeld.',
  },
  {
    icon: Users,
    title: 'Gegenseitige Unterstützung',
    desc: 'Verbinde dich mit Frauen mit ähnlichen Interessen und Erfahrungen.',
  },
];

// ─── Onboarding Screen (not verified) ────────────────────────────────────────

function WozOnboardingScreen() {
  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 ring-2 ring-pink-500/30">
            <span className="text-4xl">🌸</span>
          </div>
        </div>
        <h1 className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Women-Only Zone
        </h1>
        <p className="mt-3 text-muted-foreground">
          Ein geschützter Raum auf Serlo — nur für Frauen, nur für dich.
        </p>
      </div>

      {/* Benefits */}
      <div className="mb-8 space-y-3">
        {BENEFITS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500">
              <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-2">
        <WozActivateForm />
        <p className="mt-1 text-xs text-muted-foreground">
          Kostenlos · Sofortiger Zugang · Jederzeit widerrufbar
        </p>
      </div>
    </main>
  );
}

// ─── Feed Screen (verified) ───────────────────────────────────────────────────

async function WozFeedScreen() {
  const posts = await getWOZFeed(60);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Header */}
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 ring-1 ring-pink-500/30">
          <span className="text-xl">🌸</span>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Women-Only Zone</h1>
          <p className="text-xs text-muted-foreground">
            Nur du und andere verifizierte Mitglieder können das sehen.
          </p>
        </div>
        <div className="ml-auto">
          <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2.5 py-1 text-xs font-medium text-pink-600 dark:text-pink-400">
            <ShieldCheck className="h-3 w-3" />
            Verifiziert
          </span>
        </div>
      </header>

      {/* Post grid */}
      <PostGrid
        posts={posts}
        emptyTitle="Noch keine WOZ-Posts"
        emptyDescription="Sei die Erste — lade ein Video hoch und markiere es als Women-Only."
        emptyIcon={<Sparkles className="h-7 w-7" strokeWidth={1.75} />}
      />
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WomenOnlyPage() {
  const profile = await getProfile();

  // Not authenticated → login
  if (!profile) redirect('/login?next=/women-only');

  const isVerified =
    (profile as unknown as { gender?: string; women_only_verified?: boolean }).gender === 'female' &&
    (profile as unknown as { women_only_verified?: boolean }).women_only_verified === true;

  if (isVerified) {
    return <WozFeedScreen />;
  }

  return <WozOnboardingScreen />;
}
