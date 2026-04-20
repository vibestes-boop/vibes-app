'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FeedList } from './feed-list';
import { FeedSidebar } from './feed-sidebar';
import type { FeedPost, SuggestedFollow } from '@/lib/data/feed';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// HomeFeedShell — Client-Shell für authentifizierte User auf `/`.
// Links: Kategorien/Links (SidebarLeft), Mitte: FeedList (mit Tabs darüber),
// rechts: Suggested-Follows (SidebarRight).
//
// Initial-Daten werden SSR-seitig geladen und als Props reingereicht.
// Following-Tab lädt erst on-switch (useQuery mit `enabled: true` erst nach
// Klick) — spart uns den Round-Trip wenn User auf For-You bleibt.
//
// `storyStripSlot` ist ein optionales ReactNode-Slot (wir passen den Server-
// gerenderten <StoryStrip /> durch, damit die Shell ein Client-Component
// bleiben kann ohne selber Auth-Reads zu machen). Strip wird nur oberhalb des
// „Für dich"-Tabs gerendert — im Following-Tab versteckt, weil TikTok/Meta
// dort den Platz ebenfalls dem Feed-Flow überlassen.
// -----------------------------------------------------------------------------

export interface HomeFeedShellProps {
  viewerId: string | null;
  initialForYou: FeedPost[];
  initialFollowing: FeedPost[] | null; // null = noch nicht geladen
  suggested: SuggestedFollow[];
  storyStripSlot?: ReactNode;
}

type TabKey = 'foryou' | 'following';

export function HomeFeedShell({
  viewerId,
  initialForYou,
  initialFollowing,
  suggested,
  storyStripSlot,
}: HomeFeedShellProps) {
  const [tab, setTab] = useState<TabKey>('foryou');

  // Following-Tab: lädt nur wenn aktiviert und initialFollowing nicht bereits SSR-seitig da war.
  const followingQuery = useQuery<FeedPost[]>({
    queryKey: ['feed', 'following'],
    enabled: tab === 'following' && initialFollowing === null,
    initialData: initialFollowing ?? undefined,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch('/api/feed/following', { cache: 'no-store' });
      if (!res.ok) throw new Error('Feed konnte nicht geladen werden');
      return (await res.json()) as FeedPost[];
    },
  });

  const followingPosts = followingQuery.data ?? initialFollowing ?? [];

  return (
    <div className="grid h-[calc(100dvh-var(--site-header-h,64px))] w-full grid-cols-1 xl:grid-cols-[260px_1fr_320px]">
      {/* Left Sidebar (Desktop only) */}
      <aside className="hidden border-r border-border xl:block">
        <FeedSidebar viewerId={viewerId} />
      </aside>

      {/* Center — Feed + Tabs */}
      <div className="relative flex min-w-0 flex-col">
        <div
          role="tablist"
          aria-label="Feed-Quellen"
          className="mx-auto flex h-12 w-full max-w-[420px] items-center justify-center gap-6 border-b border-border bg-background/80 backdrop-blur-md"
        >
          <FeedTabButton
            label="Für dich"
            active={tab === 'foryou'}
            onClick={() => setTab('foryou')}
          />
          <FeedTabButton
            label="Folge ich"
            active={tab === 'following'}
            disabled={!viewerId}
            onClick={() => setTab('following')}
          />
        </div>

        <div className="min-h-0 flex-1">
          <div className={cn('flex h-full flex-col', tab !== 'foryou' && 'hidden')}>
            {storyStripSlot ? <div className="shrink-0">{storyStripSlot}</div> : null}
            <div className="min-h-0 flex-1">
              <FeedList
                initialPosts={initialForYou}
                viewerId={viewerId}
                feedKey="foryou"
              />
            </div>
          </div>
          <div className={cn('h-full', tab !== 'following' && 'hidden')}>
            {followingQuery.isFetching && followingPosts.length === 0 ? (
              <FollowingSkeleton />
            ) : (
              <FeedList
                initialPosts={followingPosts}
                viewerId={viewerId}
                feedKey="following"
              />
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar (Desktop only) */}
      <aside className="hidden border-l border-border xl:block">
        <FeedSidebarRight suggested={suggested} viewerId={viewerId} />
      </aside>
    </div>
  );
}

// Unfortunately we need the right sidebar as a separate component too,
// aber der Sidebar-Reuse ist nur minimal → inline here.
// (Imports geshared mit feed-sidebar.tsx wäre Overkill).

import Link from 'next/link';
import type { Route } from 'next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { BadgeCheck, Compass, TrendingUp } from 'lucide-react';
import { useToggleFollow } from '@/hooks/use-engagement';

function FeedSidebarRight({
  suggested,
  viewerId,
}: {
  suggested: SuggestedFollow[];
  viewerId: string | null;
}) {
  const follow = useToggleFollow();
  const [pending, startTransition] = useTransition();

  return (
    <div className="sticky top-0 flex h-[calc(100dvh-var(--site-header-h,64px))] flex-col gap-6 overflow-y-auto p-6">
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Compass className="h-3.5 w-3.5" />
          Entdecken
        </h2>
        <div className="flex flex-col gap-1">
          <Link
            href={'/explore' as Route}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <TrendingUp className="h-4 w-4" />
            Trending Hashtags
          </Link>
        </div>
      </section>

      {suggested.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vorgeschlagene Accounts
          </h2>
          <ul className="flex flex-col gap-3">
            {suggested.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <Link href={`/u/${s.username}` as Route} aria-label={`Profil von @${s.username}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={s.avatar_url ?? undefined} />
                    <AvatarFallback>{(s.display_name ?? s.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${s.username}` as Route}
                    className="flex items-center gap-1 truncate text-sm font-semibold hover:underline"
                  >
                    @{s.username}
                    {s.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-gold" />}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.display_name ?? `${s.follower_count} Follower`}
                  </div>
                </div>
                {viewerId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs"
                    onClick={() =>
                      startTransition(() => {
                        follow.mutate({ userId: s.id, following: false });
                      })
                    }
                    disabled={follow.isPending || pending}
                  >
                    Folgen
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-auto text-xs text-muted-foreground">
        <nav className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href={'/terms' as Route} className="hover:text-foreground">AGB</Link>
          <Link href={'/privacy' as Route} className="hover:text-foreground">Datenschutz</Link>
          <Link href={'/imprint' as Route} className="hover:text-foreground">Impressum</Link>
        </nav>
        <div className="mt-2">© {new Date().getFullYear()} Serlo</div>
      </footer>
    </div>
  );
}

function FollowingSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

function FeedTabButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'border-b-2 px-0 py-1 text-sm font-semibold transition-colors',
        active
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-40 hover:text-muted-foreground',
      )}
    >
      {label}
    </button>
  );
}
