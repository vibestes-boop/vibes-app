'use client';

// -----------------------------------------------------------------------------
// GuildFeedSection — v1.w.UI.183
//
// Client-Komponente für den infiniten Feed aller Posts von Mitgliedern
// einer Guild. SSR liefert die erste Seite, dieser Client-Component
// paginiert via Cursor-based Supabase-Query direkt im Browser.
//
// Rendering:
//  • 3-Spalten-Grid (responsive: 2 auf mobile)
//  • Jede Karte: Thumbnail (9:16 aspect) + Gradient-Overlay + Author-Info
//  • Link → /p/[id]
//  • "Mehr laden"-Button wenn nextCursor vorhanden
// -----------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Loader2, Eye, Heart, Film } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createBrowserClient } from '@supabase/ssr';
import type { GuildFeedPost } from '@/lib/data/guilds';

// ---------------------------------------------------------------------------
// Client-side page fetcher (mirrors getGuildFeedPage but runs in browser)
// ---------------------------------------------------------------------------

async function fetchFeedPage(
  guildId: string,
  cursor: string | null,
  pageSize = 12,
): Promise<{ posts: GuildFeedPost[]; nextCursor: string | null }> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  let query = supabase
    .from('posts')
    .select(
      `id, author_id, caption, media_url, media_type, thumbnail_url,
       view_count, like_count, created_at,
       author:profiles!posts_author_id_fkey!inner ( id, username, avatar_url, display_name, guild_id )`,
    )
    .eq('profiles.guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(pageSize);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error || !data) return { posts: [], nextCursor: null };

  const posts = (data as Record<string, unknown>[]).map((row) => {
    const a = row.author as Record<string, unknown> | null;
    return {
      id: row.id as string,
      author_id: row.author_id as string,
      caption: (row.caption as string | null) ?? null,
      media_url: row.media_url as string,
      media_type: (row.media_type as 'video' | 'image' | null) ?? null,
      thumbnail_url: (row.thumbnail_url as string | null) ?? null,
      view_count: (row.view_count as number) ?? 0,
      like_count: (row.like_count as number) ?? 0,
      created_at: row.created_at as string,
      author: {
        id: (a?.id as string) ?? '',
        username: (a?.username as string | null) ?? null,
        avatar_url: (a?.avatar_url as string | null) ?? null,
        display_name: (a?.display_name as string | null) ?? null,
      },
    } satisfies GuildFeedPost;
  });

  const nextCursor =
    posts.length === pageSize ? (posts[posts.length - 1]?.created_at ?? null) : null;
  return { posts, nextCursor };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GuildFeedSectionProps {
  guildId: string;
  initialPosts: GuildFeedPost[];
  initialNextCursor: string | null;
}

export function GuildFeedSection({
  guildId,
  initialPosts,
  initialNextCursor,
}: GuildFeedSectionProps) {
  const [posts, setPosts] = useState<GuildFeedPost[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    if (!nextCursor || isPending) return;
    startTransition(async () => {
      const { posts: newPosts, nextCursor: nc } = await fetchFeedPage(guildId, nextCursor);
      setPosts((prev) => [...prev, ...newPosts]);
      setNextCursor(nc);
    });
  };

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Noch keine Posts in diesem Pod — sei der erste!
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {posts.map((post) => (
          <GuildFeedCard key={post.id} post={post} />
        ))}
      </div>

      {nextCursor && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Lädt…
              </>
            ) : (
              'Mehr anzeigen'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GuildFeedCard — einzelne Post-Karte im Grid
// ---------------------------------------------------------------------------

function GuildFeedCard({ post }: { post: GuildFeedPost }) {
  const username = post.author.username ?? '…';
  const displayName = post.author.display_name ?? `@${username}`;

  return (
    <Link
      href={`/p/${post.id}` as Route}
      className="group relative overflow-hidden rounded-xl border border-border bg-card"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-muted">
        {post.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail_url}
            alt={post.caption ?? ''}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <Film className="h-6 w-6 opacity-40" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Media type badge */}
        {post.media_type === 'video' && (
          <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
            ▶
          </div>
        )}

        {/* Bottom: author + stats */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          {/* Author row */}
          <div className="mb-1.5 flex items-center gap-1.5">
            <Avatar className="h-5 w-5 shrink-0 ring-1 ring-white/30">
              <AvatarImage src={post.author.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="text-[9px]">
                {username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-[11px] font-medium text-white/90">
              @{username}
            </span>
          </div>

          {/* Caption */}
          {post.caption && (
            <p className="mb-1.5 line-clamp-1 text-[10px] text-white/70">
              {post.caption}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-2 text-[10px] text-white/70">
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" />
              {formatCount(post.view_count)}
            </span>
            <span className="flex items-center gap-0.5">
              <Heart className="h-3 w-3" />
              {formatCount(post.like_count)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
