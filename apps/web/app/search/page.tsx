import Link from 'next/link';
import type { Route } from 'next';
import { Search, Hash, User2, Video, BadgeCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { searchAll } from '@/lib/data/feed';
import { SearchBox } from '@/components/search-box';

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
  const results = trimmed.length >= 2
    ? await searchAll(trimmed, 20)
    : { users: [], posts: [], hashtags: [] };

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
        <div className="rounded-xl border border-dashed border-border py-20 text-center text-sm text-muted-foreground">
          Tippe mindestens 2 Zeichen in die Suche.
        </div>
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
                {results.users.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/u/${u.username}` as Route}
                      className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted"
                    >
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={u.avatar_url ?? undefined} />
                        <AvatarFallback>{(u.display_name ?? u.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 truncate text-sm font-semibold">
                          @{u.username}
                          {u.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-gold" />}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.display_name ?? '—'} · {formatCount(u.follower_count ?? 0)} Follower
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
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
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {results.posts.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/p/${p.id}` as Route}
                      className="group relative block aspect-[9/16] overflow-hidden rounded-lg bg-black"
                    >
                      {p.thumbnail_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.thumbnail_url}
                          alt={p.caption ?? 'Post'}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-white">
                        <div className="truncate font-medium">@{p.author.username}</div>
                        <div className="text-white/70">{formatCount(p.view_count ?? 0)} Views</div>
                      </div>
                    </Link>
                  </li>
                ))}
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
            <div className="rounded-xl border border-dashed border-border py-20 text-center text-sm text-muted-foreground">
              Keine Treffer für &quot;{trimmed}&quot;.
            </div>
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
