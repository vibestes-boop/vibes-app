'use client';

// -----------------------------------------------------------------------------
// SearchResultsTabs — Client Component für instant Tab-Switching.
//
// v1.w.UI.95: Client-seitiges Tab-Switching ohne Reload.
// v1.w.UI.117: IntersectionObserver load-more per Einzel-Tab (users/posts/
//   hashtags). 'all'-Tab zeigt keine Sentinels — zu aufwändig bei 3 parallelen
//   Feeds. User wechselt für tiefere Suche in den Einzel-Tab.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { BadgeCheck, Hash, SearchX, User2, Video } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { FollowButton } from '@/components/profile/follow-button';
import { ExploreVideoCard } from '@/components/explore/explore-video-card';
import { cn } from '@/lib/utils';
import type { SearchResults, SearchPageResult } from '@/lib/data/feed';

type Tab = 'all' | 'users' | 'posts' | 'hashtags';

interface Props {
  q: string;
  results: SearchResults;
  viewerId: string | null;
  followingSet: Set<string>;
  initialTab: Tab;
}

const SSR_LIMIT = 20; // muss mit searchAll(trimmed, 20) übereinstimmen

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}

export function SearchResultsTabs({ q, results, viewerId, followingSet, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  // ── Paginated state per category ───────────────────────────────────────────
  const [users,    setUsers]    = useState(results.users);
  const [posts,    setPosts]    = useState(results.posts);
  const [hashtags, setHashtags] = useState(results.hashtags);

  const [hasMoreUsers,    setHasMoreUsers]    = useState(results.users.length >= SSR_LIMIT);
  const [hasMorePosts,    setHasMorePosts]    = useState(results.posts.length >= SSR_LIMIT);
  const [hasMoreHashtags, setHasMoreHashtags] = useState(results.hashtags.length >= SSR_LIMIT);

  const [fetchingUsers,    setFetchingUsers]    = useState(false);
  const [fetchingPosts,    setFetchingPosts]    = useState(false);
  const [fetchingHashtags, setFetchingHashtags] = useState(false);

  const fetchedOffsetUsers    = useRef(results.users.length);
  const fetchedOffsetPosts    = useRef(results.posts.length);
  const fetchedOffsetHashtags = useRef(results.hashtags.length);

  const sentinelUsersRef    = useRef<HTMLDivElement | null>(null);
  const sentinelPostsRef    = useRef<HTMLDivElement | null>(null);
  const sentinelHashtagsRef = useRef<HTMLDivElement | null>(null);

  // Reset paginated state whenever the query changes (parent re-renders with new SSR data).
  // Using a key on the parent would be cleaner but we're inside a client component.
  const prevQ = useRef(q);
  if (prevQ.current !== q) {
    prevQ.current = q;
    setUsers(results.users);
    setPosts(results.posts);
    setHashtags(results.hashtags);
    setHasMoreUsers(results.users.length >= SSR_LIMIT);
    setHasMorePosts(results.posts.length >= SSR_LIMIT);
    setHasMoreHashtags(results.hashtags.length >= SSR_LIMIT);
    fetchedOffsetUsers.current    = results.users.length;
    fetchedOffsetPosts.current    = results.posts.length;
    fetchedOffsetHashtags.current = results.hashtags.length;
  }

  const loadMore = useCallback(async (type: 'users' | 'posts' | 'hashtags') => {
    const isFetching = type === 'users' ? fetchingUsers : type === 'posts' ? fetchingPosts : fetchingHashtags;
    const hasMore    = type === 'users' ? hasMoreUsers  : type === 'posts' ? hasMorePosts  : hasMoreHashtags;
    if (isFetching || !hasMore) return;

    const offset = type === 'users'
      ? fetchedOffsetUsers.current
      : type === 'posts'
        ? fetchedOffsetPosts.current
        : fetchedOffsetHashtags.current;

    const setFetching = type === 'users' ? setFetchingUsers : type === 'posts' ? setFetchingPosts : setFetchingHashtags;
    setFetching(true);

    try {
      const res = await fetch(
        `/api/search/more?q=${encodeURIComponent(q)}&type=${type}&offset=${offset}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as SearchPageResult;

      if (type === 'users' && data.users) {
        const seen = new Set(users.map((u) => u.id));
        const fresh = data.users.filter((u) => !seen.has(u.id));
        setUsers((prev) => [...prev, ...fresh]);
        fetchedOffsetUsers.current = offset + data.users.length;
        setHasMoreUsers(data.hasMore);
      } else if (type === 'posts' && data.posts) {
        const seen = new Set(posts.map((p) => p.id));
        const fresh = data.posts.filter((p) => !seen.has(p.id));
        setPosts((prev) => [...prev, ...fresh]);
        fetchedOffsetPosts.current = offset + data.posts.length;
        setHasMorePosts(data.hasMore);
      } else if (type === 'hashtags' && data.hashtags) {
        const seen = new Set(hashtags.map((h) => h.tag));
        const fresh = data.hashtags.filter((h) => !seen.has(h.tag));
        setHashtags((prev) => [...prev, ...fresh]);
        fetchedOffsetHashtags.current = offset + data.hashtags.length;
        setHasMoreHashtags(data.hasMore);
      }
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, [q, fetchingUsers, fetchingPosts, fetchingHashtags, hasMoreUsers, hasMorePosts, hasMoreHashtags, users, posts, hashtags]);

  // ── IntersectionObserver per category sentinel ─────────────────────────────
  useEffect(() => {
    if (tab !== 'users' || !hasMoreUsers) return;
    const el = sentinelUsersRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) void loadMore('users'); }, { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, hasMoreUsers, loadMore]);

  useEffect(() => {
    if (tab !== 'posts' || !hasMorePosts) return;
    const el = sentinelPostsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) void loadMore('posts'); }, { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, hasMorePosts, loadMore]);

  useEffect(() => {
    if (tab !== 'hashtags' || !hasMoreHashtags) return;
    const el = sentinelHashtagsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) void loadMore('hashtags'); }, { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, hasMoreHashtags, loadMore]);

  const tabs: { id: Tab; label: string; count: number | null }[] = [
    { id: 'all',      label: 'Alle',      count: null },
    { id: 'users',    label: 'Accounts',  count: users.length },
    { id: 'posts',    label: 'Videos',    count: posts.length },
    { id: 'hashtags', label: 'Hashtags',  count: hashtags.length },
  ];

  const showUsers    = tab === 'all' || tab === 'users';
  const showPosts    = tab === 'all' || tab === 'posts';
  const showHashtags = tab === 'all' || tab === 'hashtags';

  const noResults = users.length === 0 && posts.length === 0 && hashtags.length === 0;

  const isCurrentTabEmpty =
    (tab === 'users'    && users.length    === 0) ||
    (tab === 'posts'    && posts.length    === 0) ||
    (tab === 'hashtags' && hashtags.length === 0);

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
          {tab === 'users' && hasMoreUsers && (
            <div ref={sentinelUsersRef} className="py-4 flex flex-col gap-1">
              {fetchingUsers && [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    womenOnly={p.women_only}
                  />
                </li>
              );
            })}
          </ul>
          {tab === 'posts' && hasMorePosts && (
            <div ref={sentinelPostsRef} className="py-4">
              {fetchingPosts && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 mt-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="aspect-[9/16] w-full rounded-lg" />
                  ))}
                </div>
              )}
            </div>
          )}
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
          {tab === 'hashtags' && hasMoreHashtags && (
            <div ref={sentinelHashtagsRef} className="py-4">
              {fetchingHashtags && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
