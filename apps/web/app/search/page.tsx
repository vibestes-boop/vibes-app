import Link from 'next/link';
import type { Route } from 'next';
import { Search, SearchX, Hash, User2, Video, BadgeCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { searchAll } from '@/lib/data/feed';
import { getViewerFollowingSet } from '@/lib/data/public';
import { getUser } from '@/lib/auth/session';
import { SearchBox } from '@/components/search-box';
import { EmptyState } from '@/components/ui/empty-state';
import { FollowButton } from '@/components/profile/follow-button';
import { ExploreVideoCard } from '@/components/explore/explore-video-card';

// -----------------------------------------------------------------------------
// /search?q=...&tab=all|users|posts|hashtags
// Server-Component, dynamic (query-dependent, keine Cache-Chance).
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Suche — Serlo',
  description: 'Finde Accounts, Videos und Hashtags auf Serlo.',
};

type Tab = 'all' | 'users' | 'posts' | 'hashtags';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q = '', tab: rawTab = 'all' } = await searchParams;
  const tab: Tab = (['all', 'users', 'posts', 'hashtags'] as const).includes(rawTab as Tab)
    ? (rawTab as Tab)
    : 'all';

  const trimmed = q.trim();
  const [results, viewer, followingSet] = await Promise.all([
    trimmed.length >= 2 ? searchAll(trimmed, 20) : Promise.resolve({ users: [], posts: [], hashtags: [] }),
    getUser(),
    getViewerFollowingSet(),
  ]);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Search className="h-7 w-7" />
          Suche
        </h1>
        <div className="mt-4">
          <SearchBox initialQuery={trimmed} />
        </div>
      </header>

      {/* Tab-Nav als Links (keine Client-State) — jedes tab ist eine eigene URL */}
      <nav className="mb-6 flex gap-6 border-b border-border">
        <TabLink q={trimmed} tab="all" current={tab} label="Alle" />
        <TabLink q={trimmed} tab="users" current={tab} label={`Accounts${results.users.length ? ` (${results.users.length})` : ''}`} />
        <TabLink q={trimmed} tab="posts" current={tab} label={`Videos${results.posts.length ? ` (${results.posts.length})` : ''}`} />
        <TabLink q={trimmed} tab="hashtags" current={tab} label={`Hashtags${results.hashtags.length ? ` (${results.hashtags.length})` : ''}`} />
      </nav>

      {trimmed.length < 2 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" strokeWidth={1.75} />}
          title="Los, suche was"
          description="Tippe mindestens 2 Zeichen, um Accounts, Videos oder Hashtags zu finden."
          size="md"
          bordered
        />
      ) : (
        <>
          {(tab === 'all' || tab === 'users') && results.users.length > 0 && (
            <section className="mb-8">
              {tab === 'all' && (
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <User2 className="h-4 w-4" />
                  Accounts
                </h2>
              )}
              <ul className="flex flex-col gap-1">
                {results.users.map((u) => {
                  const isSelf = viewer?.id === u.id;
                  return (
                    <li key={u.id} className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted">
                      <Link href={`/u/${u.username}` as Route} className="shrink-0">
                        <Avatar className="h-11 w-11">
                          <AvatarImage src={u.avatar_url ?? undefined} />
                          <AvatarFallback>{(u.display_name ?? u.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <Link href={`/u/${u.username}` as Route} className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 truncate text-sm font-semibold">
                          @{u.username}
                          {u.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-gold" />}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.display_name ?? '—'} · {formatCount(u.follower_count ?? 0)} Follower
                        </div>
                      </Link>
                      {!isSelf && (
                        <FollowButton
                          isAuthenticated={!!viewer}
                          isFollowing={followingSet.has(u.id)}
                          isSelf={false}
                          username={u.username}
                          targetUserId={u.id}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(tab === 'all' || tab === 'posts') && results.posts.length > 0 && (
            <section className="mb-8">
              {tab === 'all' && (
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Video className="h-4 w-4" />
                  Videos
                </h2>
              )}
              {/* v1.w.UI.61 — ExploreVideoCard für Hover-Video-Preview (Parität mit /explore + /t/[tag]) */}
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {results.posts.map((p) => {
                  const fallbackInitial = (p.author.display_name ?? p.author.username ?? '?')
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

          {(tab === 'all' || tab === 'hashtags') && results.hashtags.length > 0 && (
            <section>
              {tab === 'all' && (
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  Hashtags
                </h2>
              )}
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {results.hashtags.map((h) => (
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

          {results.users.length === 0 && results.posts.length === 0 && results.hashtags.length === 0 && (
            <EmptyState
              icon={<SearchX className="h-8 w-8" strokeWidth={1.75} />}
              title="Keine Treffer"
              description={`Für „${trimmed}" haben wir nichts gefunden. Versuch's mit anderen Schlagworten.`}
              size="md"
              bordered
            />
          )}
        </>
      )}
    </main>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}

function TabLink({ q, tab, current, label }: { q: string; tab: Tab; current: Tab; label: string }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tab !== 'all') params.set('tab', tab);
  const href = params.toString() ? `/search?${params.toString()}` : '/search';
  const isActive = tab === current;
  return (
    <Link
      href={href as Route}
      className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors ${
        isActive
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
