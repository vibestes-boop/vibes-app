import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Post, PublicProfile } from '@shared/types';

// -----------------------------------------------------------------------------
// FeedPost = Post + Author + Engagement-Flags
// Verwendet in `/` (Home-Feed), `/explore`, später in `/t/[tag]`.
//
// Schema-Drift-Adapter: Die prod-DB (Mobile-authored) nutzt andere Spalten-
// namen als der Web-Contract. Statt Transform-Boilerplate nutzen wir hier
// PostgREST-Select-Aliase (`target_name:source_column`), damit die Row
// direkt im Post-Contract-Shape zurückkommt. Nur Defaults für Mobile-seitig
// fehlende Felder (duration_secs/music_id/allow_stitch/share_count) und
// der verified→is_verified-Alias beim Author werden manuell gesetzt.
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

// PostgREST-Aliase: user_id:author_id, video_url:media_url, hashtags:tags
// — mappt Mobile-DB-Spalten auf Web-Contract-Namen bereits in der Query.
const POST_COLUMNS =
  'id, user_id:author_id, caption, video_url:media_url, thumbnail_url, view_count, like_count, comment_count, hashtags:tags, allow_comments, allow_duet, created_at';

const AUTHOR_JOIN =
  'author:profiles!posts_author_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )';

// Mobile-DB kennt diese Post-Felder nicht — beim Normalisieren mit Defaults
// füllen, damit der Post-Contract komplett ist.
function applyPostDefaults(p: Partial<Post>): Post {
  return {
    ...(p as Post),
    duration_secs: p.duration_secs ?? null,
    music_id: p.music_id ?? null,
    allow_stitch: p.allow_stitch ?? true,
    share_count: p.share_count ?? 0,
    hashtags: (p as Partial<Post>).hashtags ?? [],
  };
}

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
      .select('following_id')
      .eq('follower_id', viewerId)
      .in('following_id', authorIds),
  ]);

  return {
    liked: new Set((likesRes.data ?? []).map((r) => r.post_id as string)),
    saved: new Set((savesRes.data ?? []).map((r) => r.post_id as string)),
    following: new Set((followsRes.data ?? []).map((r) => r.following_id as string)),
  };
}

// -----------------------------------------------------------------------------
// Row-Normalisierung — Supabase-Joined-Row hat author: Profile | Profile[]
// -----------------------------------------------------------------------------

type RawAuthor = { id: string; username: string; display_name: string | null; avatar_url: string | null; verified: boolean | null };
type RawPostRow = Omit<Post, 'hashtags' | 'duration_secs' | 'music_id' | 'allow_stitch' | 'share_count'> & {
  hashtags: string[] | null;
  author: RawAuthor | RawAuthor[] | null;
};

function normalizeRow(
  row: RawPostRow,
  liked: Set<string>,
  saved: Set<string>,
  following: Set<string>,
): FeedPost | null {
  const rawAuthor = Array.isArray(row.author) ? row.author[0] : row.author;
  if (!rawAuthor) return null;
  const author: FeedAuthor = {
    id: rawAuthor.id,
    username: rawAuthor.username,
    display_name: rawAuthor.display_name,
    avatar_url: rawAuthor.avatar_url,
    verified: rawAuthor.verified ?? false,
  };

  const base = applyPostDefaults({
    ...(row as unknown as Partial<Post>),
    hashtags: row.hashtags ?? [],
  });

  return {
    ...base,
    author,
    liked_by_me: liked.has(row.id),
    saved_by_me: saved.has(row.id),
    following_author: following.has(author.id),
  };
}

// -----------------------------------------------------------------------------
// getForYouFeed — Mobile-DB-Adapter. Früher haben wir zuerst die RPC
// `get_vibe_feed` probiert, aber die RPC referenziert in der Prod-DB eine
// `public.seen_posts`-Tabelle, die dort nicht existiert (42P01). Der Call war
// also ein dead-error pro Request. Rausgenommen — wir laden die neuesten
// Public-Posts direkt. Ranking kann später via eine replatzierte RPC wieder
// aktiviert werden, ohne dass der Feed bis dahin leer bleibt.
// -----------------------------------------------------------------------------

export const getForYouFeed = cache(
  async (opts: { limit?: number; excludeIds?: string[] } = {}): Promise<FeedPost[]> => {
    const { limit = 10, excludeIds = [] } = opts;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const viewerId = user?.id ?? null;

    let query = supabase
      .from('posts')
      .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
      .eq('privacy', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: rows, error } = await query;
    if (error) {
      // Sichtbar in Vercel-Logs — Schema-Drift oder RLS-Probleme nicht mehr silent.
      console.error('[feed] getForYouFeed query error:', error.code, error.message, error.details);
      return [];
    }
    if (!rows) {
      // Edge-Case: PostgREST liefert normalerweise `[]` — `null` ohne Error ist
      // so ungewöhnlich, dass wir es explizit sehen wollen.
      console.error('[feed] getForYouFeed: rows is null (no error, no data)', {
        viewerId,
        limit,
        excluded: excludeIds.length,
      });
      return [];
    }

    // Diagnose 0-Row-Szenario. Als `console.error` statt `.warn`, damit der
    // Eintrag in Vercel-Runtime-Logs unter dem „Error"-Level-Filter erscheint
    // (Next.js 15 routet `warn` auf Vercel teilweise als `info`).
    //
    // Wir unterscheiden zwei Fälle:
    //   (a) viewerId gesetzt  → wahrscheinlich RLS-Silent-Filter (authed-Policy
    //       blockt, anon-Policy lässt durch — siehe /explore das funktioniert).
    //   (b) viewerId null    → Auth-Cookie ist in diesem `createClient()`-Scope
    //       nicht angekommen, obwohl page.tsx den User aufgelöst hat. Deutet
    //       auf Cookie-Drift / SSR-Scoping-Problem hin.
    if (rows.length === 0) {
      console.error(
        `[feed] getForYouFeed: 0 rows (${viewerId ? 'authed → suspected RLS' : 'anon-scope → suspected cookie drift'})`,
        { viewerId, limit, excluded: excludeIds.length },
      );
    }

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

    return (rows as unknown as RawPostRow[])
      .map((row) => normalizeRow(row, liked, saved, following))
      .filter((p): p is FeedPost => p !== null);
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
      .select('following_id')
      .eq('follower_id', user.id);

    if (followErr || !follows || follows.length === 0) return [];
    const followedIds = follows.map((f) => f.following_id as string);

    let query = supabase
      .from('posts')
      .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
      .in('author_id', followedIds)
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
//
// Achtung: Mobile-DB-`profiles` hat KEINE `follower_count`-Spalte (siehe auch
// public.ts). Wir sortieren deshalb nach `created_at DESC` (neue Profile oben)
// und liefern `follower_count: 0` als Placeholder. Eine echte Sortierung
// bräuchte eine Follows-Aggregation oder einen denormalisierten Counter in
// der `profiles`-Tabelle.
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
      .select('following_id')
      .eq('follower_id', user.id);
    if (follows) excludeIds.push(...follows.map((f) => f.following_id as string));
  }

  let query = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, verified:is_verified, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data } = await query;
  if (!data) return [];

  return (data as Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean | null;
  }>).map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    verified: p.verified ?? false,
    follower_count: 0, // Placeholder — siehe Kommentar oben.
  }));
});

// -----------------------------------------------------------------------------
// getTrendingHashtags — für /explore. Aggregation aus posts.tags.
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

  // Fallback: 7-Tage-Fenster, client-seitig aggregieren. Lädt nur die tags-Spalte.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('posts')
    .select('tags, view_count')
    .gte('created_at', since)
    .eq('privacy', 'public')
    .limit(1000);

  if (!data) return [];

  const agg = new Map<string, { post_count: number; total_views: number }>();
  for (const row of data as { tags: string[] | null; view_count: number | null }[]) {
    if (!row.tags) continue;
    for (const raw of row.tags) {
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

  // User-Suche: username + display_name (kein follower_count auf profiles)
  const usersPromise = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, verified:is_verified, created_at')
    .or(`username.ilike.${like},display_name.ilike.${like}`)
    .order('created_at', { ascending: false })
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

  const users = (
    (usersRes.data ?? []) as Array<{
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      verified: boolean | null;
    }>
  ).map((u) => ({
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    verified: u.verified ?? false,
    follower_count: 0, // Placeholder — profiles hat keinen denorm. Counter.
  }));

  return {
    users,
    posts,
    hashtags,
  };
});
