'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { BadgeCheck } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { FollowButton } from '@/components/profile/follow-button';
import type { SuggestedFollow, PeoplePage } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// PeopleList — Client-Component für /people (v1.w.UI.120).
//
// SSR-Seed kommt von der Server-Component, danach IntersectionObserver-basiertes
// Infinite Scroll via GET /api/people?offset=N.
//
// Dedup per id-Set verhindert Doppel-Einträge falls der Server zwischen zwei
// Fetches neue Accounts insertet (verschiebt das Range-Fenster).
// -----------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}

const PAGE_LIMIT = 24;

export function PeopleList({
  initialPeople,
  initialHasMore,
  viewerId,
}: {
  initialPeople: SuggestedFollow[];
  initialHasMore: boolean;
  viewerId: string | null;
}) {
  const [people, setPeople]   = useState<SuggestedFollow[]>(initialPeople);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [fetching, setFetching] = useState(false);

  const offsetRef   = useRef(initialPeople.length);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (fetching || !hasMore) return;
    setFetching(true);
    try {
      const res = await fetch(
        `/api/people?offset=${offsetRef.current}&limit=${PAGE_LIMIT}`,
      );
      if (!res.ok) return;
      const { people: next, hasMore: more } = (await res.json()) as PeoplePage;
      if (next.length === 0) {
        setHasMore(false);
        return;
      }
      const seen = new Set(people.map((p) => p.id));
      const fresh = next.filter((p) => !seen.has(p.id));
      setPeople((prev) => [...prev, ...fresh]);
      offsetRef.current += next.length;
      setHasMore(more);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, [fetching, hasMore, people]);

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

  if (people.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Keine Accounts zu entdecken — du folgst bereits allen. 🎉
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {people.map((person) => {
          const initial = (person.display_name ?? person.username ?? '?')
            .slice(0, 1)
            .toUpperCase();

          return (
            <li key={person.id}>
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center">
                {/* Avatar */}
                <Link href={`/u/${person.username}` as Route} className="block shrink-0">
                  <Avatar className="h-14 w-14 ring-2 ring-border">
                    <AvatarImage src={person.avatar_url ?? undefined} alt={person.display_name ?? person.username} />
                    <AvatarFallback className="text-xl font-bold">{initial}</AvatarFallback>
                  </Avatar>
                </Link>

                {/* Name + username */}
                <div className="w-full min-w-0">
                  <Link href={`/u/${person.username}` as Route} className="block">
                    <p className="flex items-center justify-center gap-1 truncate text-sm font-semibold leading-tight">
                      {person.display_name ?? person.username}
                      {person.verified && (
                        <BadgeCheck className="inline h-3.5 w-3.5 shrink-0 text-brand-gold" />
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{person.username}
                    </p>
                  </Link>
                  {person.follower_count > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatCount(person.follower_count)} Follower
                    </p>
                  )}
                </div>

                {/* Follow — getSuggestedFollowsPage excludes already-followed + self */}
                <FollowButton
                  isAuthenticated={!!viewerId}
                  isFollowing={false}
                  isSelf={person.id === viewerId}
                  username={person.username}
                  targetUserId={person.id}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sentinel + skeleton grid while loading */}
      {hasMore && (
        <div ref={sentinelRef} className="mt-3">
          {fetching && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <li key={i}>
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <Skeleton className="h-14 w-14 rounded-full" />
                    <div className="w-full space-y-1.5">
                      <Skeleton className="mx-auto h-3.5 w-24" />
                      <Skeleton className="mx-auto h-3 w-16" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-full" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
