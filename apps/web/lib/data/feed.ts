import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Post, PublicProfile } from '@shared/types';

// -----------------------------------------------------------------------------
// FeedPost = Post + Author + Engagement-Flags
// Verwendet in `/` (Home-Feed), `/explore`, später in `/t/[tag]`.
// -----------------------------------------------------------------------------

export type FeedAuthor = Pick<
  PublicProfile,
  'id' | 'username' | 'display_name' | 'avatar_url' | 'verified'
>;

export interface FeedPost extends Post {
  author: FeedAuthor;
  liked_by_me: boolean;
  saved_by_me: boolean;
  following_author: boolean;
}

const POST_COLUMNS =
  'id, user_id, caption, video_url, thumbnail_url, duration_secs, view_count, like_count, comment_count, share_count, hashtags, music_id, allow_comments, allow_duet, allow_stitch, created_at';

const AUTHOR_JOIN = 'author:profiles!posts_user_id_fkey ( id, username, display_name, avatar_url, verified )';

// -----------------------------------------------------------------------------
// Helper — aus einem Batch Posts die Engagement-Maps holen (liked, saved, follow).
// Ein Roundtrip pro Map, max ~3 Queries pro Feed-Page. Besser als N+1.
// -----------------------------------------------------------------------------

async function batchEngagement(
  postIds: string[],
  authorIds: string[],
  viewerId: string | null,
): Promise<{
  liked: Set<string>;
  saved: Set<string>;
  following: Set<string>;
}> {
  if (!viewerId || postIds.length === 0) {
    return { liked: new Set(), saved: new Set(), following: new Set() };
  }

  const supabase = await createClient();

  const [likesRes, savesRes, followsRes] = await Promise.all([
    supabase.from('likes').select('post_id').eq('user_id', viewerId).in('post_id', postIds),
    supabase.from('bookmarks').select('post_id').eq('user_id', viewerId).in('post_id', postIds),
    supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', viewerId)
      .in('followed_id', authorIds),
  ]);

  return {
    liked: new Set((likesRes.data ?? []).map((r) => r.post_id as string)),
    saved: new Set((savesRes.data ?? []).map((r) => r.post_id as string)),
    following: new Set((followsRes.data ?? []).map((r) => r.followed_id as string)),
  };
}

// -----------------------------------------------------------------------------
// Row-Normalisierung — Supabase-Joined-Row hat author: Profile | Profile[]
// -----------------------------------------------------------------------------

type RawPostRow = Omit<Post, 'hashtags'> & {
  hashtags: string[] | null;
  author: FeedAuthor | FeedAuthor[] | null;
};

function normalizeRow(
  row: RawPostRow,
  liked: Set<string>,
  saved: Set<string>,
  following: Set<string>,
): FeedPost | null {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  if (!author) return null;

  return {
    ...(row as unknown as Post),
    hashtags: row.hashtags ?? [],
    author,
    liked_by_me: liked.has(row.id),
    saved_by_me: saved.has(row.id),
    following_author: following.has(author.id),
  };
}

// -----------------------------------------------------------------------------
// getForYouFeed — primär RPC `get_vibe_feed` (Native-Parität),
// Fallback auf latest Posts wenn RPC-Fehler / leer.
// -----------------------------------------------------------------------------

export const getForYouFeed = cache(
  async (opts: { limit?: number; excludeIds?: string[] } = {}): Promise<FeedPost[]> => {
    const { limit = 10, excludeIds = [] } = opts;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const viewerId = user?.id ?? null;

    // Schritt 1: Versuche die Native-RPC. Wir rufen mit konservativen Parametern;
    // wenn die Signatur in Zukunft anders aussieht, fällt der Catch-Pfad ein.
    let rpcIds: string[] | null = null;
    try {
      const { data, error } = await supabase.rpc('get_vibe_feed', {
        explore_weight: 0.5,
        brain_weight: 0.5,
        result_limit: limit,
        filter_tag: null,
        include_seen: false,
        exclude_ids: excludeIds,
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        // Die RPC könnte bereits volle Post-Rows zurückgeben ODER nur IDs.
        // Beide Fälle abfangen.
        const first = data[0] as Record<string, unknown>;
        if (typeof first.id === 'string' && 'video_url' in first) {
          // RPC liefert volle Posts → IDs extrahieren und re-fetchen mit Author-Join,
          // damit wir überall denselben Shape haben.
          rpcIds = data.map((r) => (r as { id: string }).id);
        } else if (typeof first === 'string' || typeof first.id === 'string') {
          rpcIds = data.map((r) => (typeof r === 'string' ? r : (r as { id: string }).id));
        }
      }
    } catch {
      // RPC existiert nicht / Signatur weicht ab → Fallback.
      rpcIds = null;
    }

    // Schritt 2: Posts laden — entweder aus RPC-ID-Liste oder als Fallback die neuesten.
    let query = supabase
      .from('posts')
      .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
      .eq('privacy', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (rpcIds && rpcIds.length > 0) {
      query = supabase
        .from('posts')
        .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
        .in('id', rpcIds);
    } else if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: rows, error } = await query;
    if (error || !rows) return [];

    const postIds = rows.map((r) => r.id as string);
    const authorIds = Array.from(
      new Set(
        rows
          .map((r) => {
            const a = (r as unknown as RawPostRow).author;
            const author = Array.isArray(a) ? a[0] : a;
            return author?.id;
          })
          .filter((id): id is string => typeof id === 'string'),
      ),
    );

    const { liked, saved, following } = await batchEngagement(postIds, authorIds, viewerId);

    const normalized = (rows as unknown as RawPostRow[])
      .map((row) => normalizeRow(row, liked, saved, following))
      .filter((p): p is FeedPost => p !== null);

    // Wenn wir RPC-IDs nutzen, Reihenfolge laut RPC-Ranking beibehalten
    // (die `.in('id', rpcIds)`-Query behält die Reihenfolge nicht).
    if (rpcIds) {
      const indexMap = new Map(rpcIds.map((id, i) => [id, i]));
      normalized.sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));
    }

    return normalized;
  },
);

// -----------------------------------------------------------------------------
// getFollowingFeed — nur Posts von Leuten denen der User folgt.
// -----------------------------------------------------------------------------

export const getFollowingFeed = cache(
  async (opts: { limit?: number; before?: string } = {}): Promise<FeedPost[]> => {
    const { limit = 10, before } = opts;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: follows, error: followErr } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', user.id);

    if (followErr || !follows || follows.length === 0) return [];
    const followedIds = follows.map((f) => f.followed_id as string);

    let query = supabase
      .from('posts')
      .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
      .in('user_id', followedIds)
      .eq('privacy', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) query = query.lt('created_at', before);

    const { data: rows, error } = await query;
    if (error || !rows) return [];

    const postIds = rows.map((r) => r.id as string);
    const { liked, saved } = await batchEngagement(postIds, followedIds, user.id);

    // Following-Feed: following_author ist per Definition true
    const followingSet = new Set(followedIds);

    return (rows as unknown as RawPostRow[])
      .map((row) => normalizeRow(row, liked, saved, followingSet))
      .filter((p): p is FeedPost => p !== null);
  },
);

// -----------------------------------------------------------------------------
// getSuggestedFollows — Right-Sidebar: Top-Creator denen der User noch nicht folgt.
// -----------------------------------------------------------------------------

export interface SuggestedFollow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  verified: boolean;
}

export const getSuggestedFollows = cache(async (limit = 5): Promise<SuggestedFollow[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let excludeIds: string[] = [];
  if (user) {
    excludeIds = [user.id];
    const { data: follows } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', user.id);
    if (follows) excludeIds.push(...follows.map((f) => f.followed_id as string));
  }

  let query = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, follower_count, verified')
    .order('follower_count', { ascending: false })
    .limit(limit);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data } = await query;
  return (data as SuggestedFollow[] | null) ?? [];
});

// -----------------------------------------------------------------------------
// getTrendingHashtags — für /explore. Aggregation aus posts.hashtags.
// Skaliert nicht unendlich, aber für Phase 3 reicht eine simple Window-Abfrage.
// -----------------------------------------------------------------------------

export interface TrendingHashtag {
  tag: string;
  post_count: number;
  total_views: number;
}

export const getTrendingHashtags = cache(async (limit = 20): Promise<TrendingHashtag[]> => {
  const supabase = await createClient();

  // Versuche RPC (falls Native einen rollup-View hat), sonst Fallback.
  try {
    const { data, error } = await supabase.rpc('get_trending_hashtags', { result_limit: limit });
    if (!error && Array.isArray(data)) {
      return (data as TrendingHashtag[]).slice(0, limit);
    }
  } catch {
    /* fall through */
  }

  // Fallback: 7-Tage-Fenster, client-seitig aggregieren. Lädt nur die Hashtags-Spalte.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('posts')
    .select('hashtags, view_count')
    .gte('created_at', since)
    .eq('privacy', 'public')
    .limit(1000);

  if (!data) return [];

  const agg = new Map<string, { post_count: number; total_views: number }>();
  for (const row of data as { hashtags: string[] | null; view_count: number | null }[]) {
    if (!row.hashtags) continue;
    for (const raw of row.hashtags) {
      const tag = raw.toLowerCase().replace(/^#/, '').trim();
      if (!tag) continue;
      const entry = agg.get(tag) ?? { post_count: 0, total_views: 0 };
      entry.post_count += 1;
      entry.total_views += row.view_count ?? 0;
      agg.set(tag, entry);
    }
  }

  return Array.from(agg.entries())
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((a, b) => b.total_views - a.total_views || b.post_count - a.post_count)
    .slice(0, limit);
});

// -----------------------------------------------------------------------------
// searchAll — /search Multi-Tab.
// -----------------------------------------------------------------------------

export interface SearchResults {
  users: Array<Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'verified' | 'follower_count'>>;
  posts: FeedPost[];
  hashtags: TrendingHashtag[];
}

export const searchAll = cache(async (q: string, limit = 12): Promise<SearchResults> => {
  const query = q.trim();
  if (query.length < 2) return { users: [], posts: [], hashtags: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const like = `%${query.replace(/[%_]/g, '')}%`;
  const tagLike = query.toLowerCase().replace(/^#/, '');

  // User-Suche: username + display_name
  const usersPromise = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, verified, follower_count')
    .or(`username.ilike.${like},display_name.ilike.${like}`)
    .order('follower_count', { ascending: false })
    .limit(limit);

  // Post-Suche: Caption
  const postsPromise = supabase
    .from('posts')
    .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
    .ilike('caption', like)
    .eq('privacy', 'public')
    .order('view_count', { ascending: false })
    .limit(limit);

  // Hashtag-Suche: substring-Match auf die Trending-Liste
  const hashtagsPromise = getTrendingHashtags(80).then((tags) =>
    tags.filter((t) => t.tag.includes(tagLike)).slice(0, limit),
  );

  const [usersRes, postsRes, hashtags] = await Promise.all([
    usersPromise,
    postsPromise,
    hashtagsPromise,
  ]);

  const postRows = (postsRes.data ?? []) as unknown as RawPostRow[];
  const postIds = postRows.map((r) => r.id);
  const authorIds = Array.from(
    new Set(
      postRows
        .map((r) => {
          const a = r.author;
          const author = Array.isArray(a) ? a[0] : a;
          return author?.id;
        })
        .filter((id): id is string => typeof id === 'string'),
    ),
  );

  const { liked, saved, following } = await batchEngagement(postIds, authorIds, viewerId);
  const posts = postRows
    .map((row) => normalizeRow(row, liked, saved, following))
    .filter((p): p is FeedPost => p !== null);

  return {
    users: (usersRes.data ?? []) as SearchResults['users'],
    posts,
    hashtags,
  };
});
