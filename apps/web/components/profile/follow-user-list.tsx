'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { BadgeCheck } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { FollowButton } from '@/components/profile/follow-button';
import type { FollowUser } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// FollowUserList — client component for /u/[username]/followers and /following.
//
// SSR-seed from server component; IntersectionObserver infinite scroll via
// /api/follows/followers?username=X&offset=N or
// /api/follows/following?username=X&offset=N.
//
// Props:
//   mode        — 'followers' | 'following' (determines which API endpoint)
//   username    — profile whose followers/following to load (for API param)
//   initialUsers / initialHasMore — SSR seed
//   viewerId    — current auth user id (null = anon)
//   followingSet — set of user ids the viewer already follows (for FollowButton)
//
// v1.w.UI.128 — followers/following infinite scroll.
// -----------------------------------------------------------------------------

interface FollowUserListResponse {
  users: FollowUser[];
  hasMore: boolean;
}

const PAGE = 50;

export function FollowUserList({
  mode,
  username,
  initialUsers,
  initialHasMore,
  viewerId,
  followingSet: initialFollowingSet,
}: {
  mode: 'followers' | 'following';
  username: string;
  initialUsers: FollowUser[];
  initialHasMore: boolean;
  viewerId: string | null;
  followingSet: Set<string>;
}) {
  const [users, setUsers]   = useState<FollowUser[]>(initialUsers);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [fetching, setFetching] = useState(false);
  const [followingSet] = useState(initialFollowingSet);

  const offsetRef   = useRef(initialUsers.length);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (fetching || !hasMore) return;
    setFetching(true);
    try {
      const res = await fetch(
        `/api/follows/${mode}?username=${encodeURIComponent(username)}&offset=${offsetRef.current}&limit=${PAGE}`,
      );
      if (!res.ok) return;
      const { users: next, hasMore: more } = (await res.json()) as FollowUserListResponse;
      if (next.length === 0) { setHasMore(false); return; }
      const seen = new Set(users.map((u) => u.id));
      const fresh = next.filter((u) => !seen.has(u.id));
      setUsers((prev) => [...prev, ...fresh]);
      offsetRef.current += next.length;
      setHasMore(more);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, [fetching, hasMore, mode, username, users]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore(); },
      { rootMargin: '400px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  if (users.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {mode === 'followers' ? 'Noch keine Follower.' : 'Folgt noch niemandem.'}
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {users.map((u) => {
          const isSelf      = viewerId === u.id;
          const isFollowing = followingSet.has(u.id);
          const displayName = u.display_name ?? u.username;

          return (
            <li key={u.id} className="flex items-center gap-3 py-3">
              <Link href={`/u/${u.username}` as Route} className="shrink-0">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={u.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="text-sm">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${u.username}` as Route}
                  className="block hover:underline underline-offset-4"
                >
                  <div className="flex items-center gap-1 truncate text-sm font-semibold">
                    {displayName}
                    {u.verified && (
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-gold" />
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    @{u.username}
                  </div>
                </Link>
              </div>

              {!isSelf && (
                <FollowButton
                  isAuthenticated={!!viewerId}
                  isFollowing={isFollowing}
                  isSelf={false}
                  username={u.username}
                  targetUserId={u.id}
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* Sentinel + skeleton rows while loading */}
      {hasMore && (
        <div ref={sentinelRef} className="mt-1">
          {fetching && (
            <ul className="divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-full" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
