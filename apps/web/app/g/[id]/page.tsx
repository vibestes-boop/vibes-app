import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { Hash, Users, Trophy, Info, Clock3 } from 'lucide-react';

import { getUser } from '@/lib/auth/session';
import {
  getGuildById,
  getGuildLeaderboard,
  getGuildMemberCount,
  getGuildMembers,
  getMyGuildId,
} from '@/lib/data/guilds';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SwitchGuildButton } from '@/components/guilds/switch-guild-button';

// -----------------------------------------------------------------------------
// /g/[id] — Pod-Detail-Seite.
//
// Aktuelles Schema unterstützt:
//   - Top-Posts (letzte 30 Tage nach dwell_time_score)
//   - Top-Members (Leaderboard)
//   - Mitglieder-Grid (Avatare)
//   - About (Description + Vibe-Tags + Member-Count)
//
// Events und Chat sind Roadmap-Punkte, aber DB hat dafür noch keine Tabellen.
// Wir rendern „kommt bald"-Placeholder damit die Tab-Struktur stabil bleibt.
//
// Routen via UUID statt Slug — Schema hat kein slug-Feld. Links im Feed
// generieren UUIDs direkt aus `author_guild_id`.
// -----------------------------------------------------------------------------

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [guild, memberCount] = await Promise.all([
    getGuildById(id),
    getGuildMemberCount(id).catch(() => 0),
  ]);
  if (!guild) return { title: 'Pod nicht gefunden — Serlo' };

  const title = `${guild.name} — Serlo Pod`;
  const descBase =
    guild.description?.trim() ??
    `${guild.name} — eine Serlo Community.`;
  const description =
    memberCount > 0
      ? `${descBase} · ${memberCount.toLocaleString('de-DE')} Mitglieder`
      : descBase;

  return {
    title,
    description,
    alternates: { canonical: `/g/${id}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `/g/${id}`,
      siteName: 'Serlo',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export const revalidate = 60;

export default async function GuildDetailPage({ params }: Props) {
  const { id } = await params;

  const [user, guild] = await Promise.all([getUser(), getGuildById(id)]);
  if (!guild) notFound();

  const [leaderboard, memberCount, members, myGuildId] = await Promise.all([
    getGuildLeaderboard(id),
    getGuildMemberCount(id),
    getGuildMembers(id, 48),
    getMyGuildId(),
  ]);

  const isMember = myGuildId === id;

  // ── JSON-LD: Organization schema ──────────────────────────────────────────
  // Allows Google to surface the Pod as an Organization in Knowledge Panel /
  // rich results. memberCount exposed via interactionStatistic (RegisterAction
  // = "joined" is the closest schema.org approximation for community members).
  // v1.w.UI.134 — JSON-LD structured data batch.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://serlo.app';
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: guild.name,
    ...(guild.description ? { description: guild.description } : {}),
    url: `${siteUrl}/g/${guild.id}`,
    ...(memberCount > 0
      ? {
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/RegisterAction',
            userInteractionCount: memberCount,
          },
        }
      : {}),
    ...(guild.vibe_tags.length > 0 ? { keywords: guild.vibe_tags.join(', ') } : {}),
    memberOf: {
      '@type': 'Organization',
      name: 'Serlo',
      url: siteUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 lg:px-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href={'/guilds' as Route}
            className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            ← Alle Pods
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">{guild.name}</h1>
          {guild.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {guild.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {guild.vibe_tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                <Hash className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {memberCount.toLocaleString('de-DE')} Mitglieder
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <SwitchGuildButton
            guildId={guild.id}
            guildName={guild.name}
            isMember={isMember}
            isAuthed={!!user}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Top-Posts ──────────────────────────────────────────────── */}
        <section className="min-w-0">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand-gold" />
            <h2 className="text-xl font-semibold">Top-Posts der letzten 30 Tage</h2>
          </div>
          {leaderboard.top_posts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
              Noch keine Posts mit Engagement — sei der erste!
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {leaderboard.top_posts.map((p, idx) => (
                <Link
                  key={p.id}
                  href={`/p/${p.id}` as Route}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="relative aspect-[9/16] w-full overflow-hidden bg-muted">
                    {p.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnail_url}
                        alt={p.caption ?? ''}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        Kein Preview
                      </div>
                    )}
                    <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      #{idx + 1}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="line-clamp-1 text-[11px] font-medium text-white">
                        @{p.author_username ?? '…'}
                      </p>
                      <p className="text-[10px] text-white/80">
                        {p.completion_pct}% Completion
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* ── Top-Members ─────────────────────────────────────────── */}
          <div className="mt-10 mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand-gold" />
            <h2 className="text-xl font-semibold">Top-Creators</h2>
          </div>
          {leaderboard.top_members.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Noch keine ausgezeichneten Creator diesen Monat.
            </div>
          ) : (
            <ol className="space-y-2">
              {leaderboard.top_members.map((m, idx) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <Link
                    href={m.username ? (`/u/${m.username}` as Route) : '#'}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={m.avatar_url ?? undefined} alt="" />
                      <AvatarFallback>
                        {(m.username ?? '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        @{m.username ?? '…'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.post_count} Posts · Avg {m.avg_completion_pct}% Completion
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}

          {/* ── Events / Chat Placeholder ──────────────────────────── */}
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
              <Clock3 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Pod-Events</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Event-Kalender kommt in einer nächsten Version.
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
              <Clock3 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Pod-Chat</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Community-Chat kommt in einer nächsten Version.
              </p>
            </div>
          </div>
        </section>

        {/* ── Right-Sidebar: Members-Grid ─────────────────────────── */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" />
              Mitglieder
            </h3>
            <span className="text-xs text-muted-foreground">
              {members.length} {memberCount > members.length ? `von ${memberCount}` : ''}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            {members.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Noch keine Mitglieder.
              </p>
            ) : (
              <div className="grid grid-cols-6 gap-2 lg:grid-cols-4">
                {members.map((m) => (
                  <Link
                    key={m.id}
                    href={m.username ? (`/u/${m.username}` as Route) : '#'}
                    title={`@${m.username ?? '…'}`}
                    className="group flex flex-col items-center gap-1"
                  >
                    <Avatar className="h-10 w-10 ring-0 transition-all group-hover:ring-2 group-hover:ring-brand-gold/50">
                      <AvatarImage src={m.avatar_url ?? undefined} alt="" />
                      <AvatarFallback>
                        {(m.username ?? '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-full truncate text-[10px] text-muted-foreground">
                      @{m.username ?? '…'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* About-Card */}
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Info className="h-4 w-4" />
              Über diesen Pod
            </h3>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Mitglieder</dt>
                <dd className="font-medium">{memberCount.toLocaleString('de-DE')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Top-Posts (30 Tage)</dt>
                <dd className="font-medium">{leaderboard.top_posts.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Aktive Creator</dt>
                <dd className="font-medium">{leaderboard.top_members.length}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
    </>
  );
}
