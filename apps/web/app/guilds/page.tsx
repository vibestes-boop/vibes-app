import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Users, Hash, ArrowRight } from 'lucide-react';

import { getUser } from '@/lib/auth/session';
import { getAllGuilds, getMyGuildId } from '@/lib/data/guilds';

// -----------------------------------------------------------------------------
// /guilds — Pod-Discovery.
//
// Aktueller DB-Stand: 5 fixe Pods (Alpha..Omega). Wir zeigen sie als Karten
// mit Name, Beschreibung, Vibe-Tags und Member-Count. Der Pod des eingeloggten
// Users wird als „Dein Pod" hervorgehoben.
//
// Public lesbar (Anon-User können alle Pods sehen), aber „Pod wechseln" setzt
// Login voraus und wird auf der Detail-Seite gemacht.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Pods entdecken — Serlo',
  description:
    'Serlo Pods — jede Community hat ihren eigenen Vibe. Finde deine Crew unter Tech-Nerds, Künstlern, Entdeckern, Gamern und Food-Lovern.',
  alternates: { canonical: '/guilds' },
};

export const revalidate = 60;

const POD_PRESENTATION: Record<
  string,
  { title: string; description: string; tags: string[] }
> = {
  'Pod Alpha': {
    title: 'Code & Design',
    description: 'Für Builder, Produktideen, Setups und kreative Experimente mit Technik.',
    tags: ['Tech', 'Design', 'AI'],
  },
  'Pod Beta': {
    title: 'Art & Sound',
    description: 'Für Musik, visuelle Kultur, Fotografie und alles, was Atmosphäre trägt.',
    tags: ['Art', 'Music', 'Photo'],
  },
  'Pod Delta': {
    title: 'Gaming & Shows',
    description: 'Für Gaming-Clips, Streams, Challenges und Entertainment-Formate.',
    tags: ['Gaming', 'Shows', 'Humor'],
  },
  'Pod Gamma': {
    title: 'Travel & Life',
    description: 'Für Orte, Alltag, Bewegung und Momente außerhalb des Screens.',
    tags: ['Travel', 'Nature', 'Life'],
  },
  'Pod Omega': {
    title: 'Style & Taste',
    description: 'Für Food, Fashion, kleine Shops und persönlichen Geschmack.',
    tags: ['Food', 'Fashion', 'Shop'],
  },
};

export default async function GuildsPage() {
  const [user, guilds, myGuildId] = await Promise.all([
    getUser(),
    getAllGuilds(),
    getMyGuildId(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-8 lg:px-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pods</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Fünf Communities — jede mit eigenem Vibe. Dein Pod bestimmt welche
            Posts du im Guild-Feed siehst und gegen wen du auf dem Leaderboard
            antrittst.
          </p>
        </div>
        {!user && (
          <Link
            href={'/login?next=/guilds' as Route}
            className="hidden shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:inline-block"
          >
            Einloggen
          </Link>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {guilds.map((guild) => {
          const isMine = guild.id === myGuildId;
          const presentation = POD_PRESENTATION[guild.name];
          const displayTitle = presentation?.title ?? guild.name;
          const displayDescription = presentation?.description ?? guild.description;
          const displayTags = presentation?.tags ?? guild.vibe_tags;

          return (
            <Link
              key={guild.id}
              href={`/g/${guild.id}` as Route}
              className={`group relative flex min-h-[190px] flex-col overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-elevation-2 ${
                isMine ? 'border-foreground/30 ring-1 ring-foreground/10' : 'border-border'
              }`}
            >
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                <Users className="h-5 w-5" strokeWidth={1.8} />
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="relative mt-4 flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{displayTitle}</h2>
                  {isMine && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                      Dein Pod
                    </span>
                  )}
                </div>
                <ArrowRight className="relative mt-4 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              {displayDescription && (
                <p className="relative mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {displayDescription}
                </p>
              )}

              {displayTags.length > 0 && (
                <div className="relative mt-4 flex flex-wrap gap-1.5">
                  {displayTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      <Hash className="h-2.5 w-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="relative mt-auto flex items-center gap-1.5 pt-4 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{guild.member_count.toLocaleString('de-DE')} Mitglieder</span>
              </div>
            </Link>
          );
        })}
      </div>

      {guilds.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Keine Pods verfügbar. Administrator kontaktieren.
          </p>
        </div>
      )}
    </div>
  );
}
