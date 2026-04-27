'use client';

// -----------------------------------------------------------------------------
// SearchResultsTabs — Client Component für instant Tab-Switching.
//
// v1.w.UI.95:
//   Vorher: Tabs waren <Link>-basiert → jeder Tab-Klick triggerte eine volle
//   Server-Navigierung (/search?q=…&tab=users). Das fühlte sich langsam an,
//   obwohl alle Daten bereits im initialen SSR geladen waren.
//
//   Jetzt: Tabs nutzen lokalen useState. Die drei Datensätze (users, posts,
//   hashtags) kommen alle per SSR-Props. Tab-Wechsel sind sofort, kein Netz.
//   URL-Deep-Links funktionieren weiterhin: `initialTab` kommt vom Server aus
//   dem ?tab=-Param, initialisiert den State. Beim ersten Render ist der korrekte
//   Tab aktiv — ohne JS-Flash.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { BadgeCheck, Hash, SearchX, User2, Video } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { FollowButton } from '@/components/profile/follow-button';
import { ExploreVideoCard } from '@/components/explore/explore-video-card';
import { cn } from '@/lib/utils';
import type { SearchResults } from '@/lib/data/feed';

type Tab = 'all' | 'users' | 'posts' | 'hashtags';

interface Props {
  q: string;
  results: SearchResults;
  viewerId: string | null;
  followingSet: Set<string>;
  initialTab: Tab;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}

export function SearchResultsTabs({ q, results, viewerId, followingSet, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { users, posts, hashtags } = results;

  const tabs: { id: Tab; label: string; count: number | null }[] = [
    { id: 'all',      label: 'Alle',      count: null },
    { id: 'users',    label: 'Accounts',  count: users.length },
    { id: 'posts',    label: 'Videos',    count: posts.length },
    { id: 'hashtags', label: 'Hashtags',  count: hashtags.length },
  ];

  const noResults = users.length === 0 && posts.length === 0 && hashtags.length === 0;

  const isCurrentTabEmpty =
    (tab === 'users'    && users.length    === 0) ||
    (tab === 'posts'    && posts.length    === 0) ||
    (tab === 'hashtags' && hashtags.length === 0);

  const showUsers    = tab === 'all' || tab === 'users';
  const showPosts    = tab === 'all' || tab === 'posts';
  const showHashtags = tab === 'all' || tab === 'hashtags';

  return (
    <div>
      {/* Tab-Nav */}
      <nav className="mb-6 flex gap-6 border-b border-border" aria-label="Suchergebnis-Filter">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors',
              tab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({t.count})</span>
            )}
          </button>
        ))}
      </nav>

      {/* Keine Treffer insgesamt */}
      {noResults && (
        <EmptyState
          icon={<SearchX className="h-8 w-8" strokeWidth={1.75} />}
          title="Keine Treffer"
          description={`Für „${q}" haben wir nichts gefunden. Versuch's mit anderen Schlagworten.`}
          size="md"
          bordered
        />
      )}

      {/* Aktueller Tab ist leer, aber andere Tabs haben Ergebnisse */}
      {!noResults && isCurrentTabEmpty && (
        <EmptyState
          icon={<SearchX className="h-8 w-8" strokeWidth={1.75} />}
          title="Keine Treffer in dieser Kategorie"
          description={`Für „${q}" gibt es keine ${
            tab === 'users' ? 'Accounts' : tab === 'posts' ? 'Videos' : 'Hashtags'
          }. Schau in einem anderen Tab nach.`}
          size="md"
          bordered
        />
      )}

      {/* ── Accounts ──────────────────────────────────────────────────────── */}
      {showUsers && users.length > 0 && (
        <section className="mb-8">
          {tab === 'all' && (
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <User2 className="h-4 w-4" />
              Accounts
            </h2>
          )}
          <ul className="flex flex-col gap-1">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted"
              >
                <Link href={`/u/${u.username}` as Route} className="shrink-0">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={u.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {(u.display_name ?? u.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <Link href={`/u/${u.username}` as Route} className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate text-sm font-semibold">
                    @{u.username}
                    {u.verified && (
                      <BadgeCheck className="h-3.5 w-3.5 text-brand-gold" />
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {u.display_name ?? '—'} · {formatCount(u.follower_count ?? 0)} Follower
                  </div>
                </Link>
                <FollowButton
                  isAuthenticated={!!viewerId}
                  isFollowing={followingSet.has(u.id)}
                  isSelf={u.id === viewerId}
                  username={u.username}
                  targetUserId={u.id}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Videos ────────────────────────────────────────────────────────── */}
      {showPosts && posts.length > 0 && (
        <section className="mb-8">
          {tab === 'all' && (
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Video className="h-4 w-4" />
              Videos
            </h2>
          )}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {posts.map((p) => {
              const fallbackInitial = (
                p.author.display_name ?? p.author.username ?? '?'
              )
                .slice(0, 1)
                .toUpperCase();
              return (
                <li key={p.id}>
                  <ExploreVideoCard
                    id={p.id}
                    videoUrl={p.video_url}
                    thumbnailUrl={p.thumbnail_url}
                    caption={p.caption}
                    authorUsername={p.author.username}
                    viewCount={p.view_count ?? 0}
                    fallbackInitial={fallbackInitial}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Hashtags ──────────────────────────────────────────────────────── */}
      {showHashtags && hashtags.length > 0 && (
        <section>
          {tab === 'all' && (
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Hash className="h-4 w-4" />
              Hashtags
            </h2>
          )}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {hashtags.map((h) => (
              <li key={h.tag}>
                <Link
                  href={`/t/${encodeURIComponent(h.tag)}` as Route}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/20"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Hash className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">#{h.tag}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatCount(h.post_count)} Posts
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
