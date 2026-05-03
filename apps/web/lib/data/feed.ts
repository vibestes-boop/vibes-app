import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';
import type { Post, PublicProfile } from '@shared/types';

// -----------------------------------------------------------------------------
// FeedPost = Post + Author + Engagement-Flags
// Verwendet in `/` (Home-Feed), `/explore`, später in `/t/[tag]`.
//
// Schema-Drift-Adapter: Die prod-DB (Mobile-authored) nutzt andere Spalten-
// namen als der Web-Contract. Statt Transform-Boilerplate nutzen wir hier
// PostgREST-Select-Aliase (`target_name:source_column`), damit die Row
// direkt im Post-Contract-Shape zurückkommt. Nur Defaults für Mobile-seitig
// fehlende Felder (duration_secs/music_id/allow_stitch) und
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
  // v1.w.UI.151 — Repost-Flag für Repeat2-Button im Feed (nur fremde Posts).
  reposted_by_me: boolean;
  // Mobile-DB diskriminiert Bild vs. Video. Wir brauchen das im Feed-
  // Renderer um zwischen <video> (Videos) und <img> (Bilder) zu wählen —
  // ohne dieses Feld rendert FeedCard blind <video src=bildurl> → leerer
  // Frame + Broken-Media-State. `null` = Legacy-Row vor media_type-
  // Einführung; dort defaulten wir auf 'video' (die damalige Annahme).
  media_type: 'image' | 'video' | null;
  // v1.w.UI.142 — allow_download gated by author; feed card shows download in more-menu.
  allow_download: boolean;
  // v1.w.UI.169 — Women-Only Zone posts: 🌸 badge overlay in feed card.
  // RLS ensures non-verified users never receive women_only=true rows,
  // so this flag is display-only (no client-side gating needed).
  women_only: boolean;
  // v1.w.UI.172 — post visibility level: public / friends / private.
  // Authors see their own restricted posts in the feed; this flag drives
  // the audience-badge overlay (lock icon for private, users icon for friends).
  privacy: 'public' | 'friends' | 'private';
  // v1.w.UI.175 — stored aspect ratio for CLS-free layout on first render.
  // Eliminates the 9:16 → actual-ratio jump for landscape/square posts while
  // media metadata loads. 'portrait' = 9:16, 'landscape' = 16:9, 'square' = 1:1.
  aspect_ratio: 'portrait' | 'landscape' | 'square';
  // v1.w.UI.211 — background audio track (music overlay). Null = no track.
  audio_url: string | null;
  // v1.w.UI.211 — audio track volume 0–1; null means use default (0.8).
  audio_volume: number | null;
}

// PostgREST-Aliase: user_id:author_id, video_url:media_url, hashtags:tags
// — mappt Mobile-DB-Spalten auf Web-Contract-Namen bereits in der Query.
// `media_type` ist unaliased weil der Name in beiden Schemata identisch ist.
// `share_count` existiert in der Mobile-DB nicht und wird unten auf 0 defaulted.
const POST_COLUMNS =
  'id, user_id:author_id, caption, video_url:media_url, media_type, thumbnail_url, view_count, like_count, comment_count, hashtags:tags, allow_comments, allow_duet, allow_download, women_only, privacy, aspect_ratio, audio_url, audio_volume, created_at';

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
  reposted: Set<string>;
}> {
  if (!viewerId || postIds.length === 0) {
    return { liked: new Set(), saved: new Set(), following: new Set(), reposted: new Set() };
  }

  const supabase = await createClient();

  const [likesRes, savesRes, followsRes, repostsRes] = await Promise.all([
    supabase.from('likes').select('post_id').eq('user_id', viewerId).in('post_id', postIds),
    supabase.from('bookmarks').select('post_id').eq('user_id', viewerId).in('post_id', postIds),
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', viewerId)
      .in('following_id', authorIds),
    supabase.from('reposts').select('post_id').eq('user_id', viewerId).in('post_id', postIds),
  ]);

  return {
    liked: new Set((likesRes.data ?? []).map((r) => r.post_id as string)),
    saved: new Set((savesRes.data ?? []).map((r) => r.post_id as string)),
    following: new Set((followsRes.data ?? []).map((r) => r.following_id as string)),
    reposted: new Set((repostsRes.data ?? []).map((r) => r.post_id as string)),
  };
}

// -----------------------------------------------------------------------------
// Row-Normalisierung — Supabase-Joined-Row hat author: Profile | Profile[]
// -----------------------------------------------------------------------------

type RawAuthor = { id: string; username: string; display_name: string | null; avatar_url: string | null; verified: boolean | null };
type RawPostRow = Omit<Post, 'hashtags' | 'duration_secs' | 'music_id' | 'allow_stitch'> & {
  hashtags: string[] | null;
  media_type: 'image' | 'video' | null;
  allow_download?: boolean;
  women_only?: boolean;
  privacy?: string | null;
  aspect_ratio?: string | null;
  audio_url?: string | null;
  audio_volume?: number | null;
  author: RawAuthor | RawAuthor[] | null;
};

function normalizeRow(
  row: RawPostRow,
  liked: Set<string>,
  saved: Set<string>,
  following: Set<string>,
  reposted: Set<string> = new Set(),
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
    // v1.w.UI.151 — repost flag
    reposted_by_me: reposted.has(row.id),
    media_type: row.media_type ?? null,
    // v1.w.UI.142 — default true: if the column is missing (legacy row) assume download is allowed.
    allow_download: row.allow_download ?? true,
    // v1.w.UI.169 — WOZ badge; default false for legacy rows.
    women_only: row.women_only ?? false,
    // v1.w.UI.172 — privacy badge; default 'public' for legacy rows.
    privacy: (['public', 'friends', 'private'] as const).includes(row.privacy as 'public' | 'friends' | 'private')
      ? (row.privacy as 'public' | 'friends' | 'private')
      : 'public',
    // v1.w.UI.175 — stored aspect ratio for CLS-free layout; default 'portrait'.
    aspect_ratio: (['portrait', 'landscape', 'square'] as const).includes(row.aspect_ratio as 'portrait' | 'landscape' | 'square')
      ? (row.aspect_ratio as 'portrait' | 'landscape' | 'square')
      : 'portrait',
    // v1.w.UI.211 — background audio track; null for posts without music.
    audio_url: row.audio_url ?? null,
    audio_volume: typeof row.audio_volume === 'number' ? row.audio_volume : null,
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
  async (opts: { limit?: number; excludeIds?: string[]; before?: string } = {}): Promise<FeedPost[]> => {
    const { limit = 10, excludeIds = [], before } = opts;
    const supabase = await createClient();
    const user = await getUser();
    const viewerId = user?.id ?? null;

    // v1.w.UI.34: Not-Interested-Filter. User-spezifisch — wir laden alle
    // Post-IDs die der aktuelle User mit `not_interested` markiert hat und
    // schließen sie aus dem Feed aus. Anon (viewerId=null) hat keine, also
    // skip in dem Fall um einen unnötigen Roundtrip zu sparen.
    const notInterestedIds: string[] = [];
    if (viewerId) {
      const { data: ni } = await supabase
        .from('post_reports')
        .select('post_id')
        .eq('reporter_id', viewerId)
        .eq('reason', 'not_interested');
      if (ni) {
        for (const r of ni) {
          const id = (r as { post_id?: string }).post_id;
          if (typeof id === 'string') notInterestedIds.push(id);
        }
      }
    }

    let query = supabase
      .from('posts')
      .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
      .eq('privacy', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Excludes zusammenführen: explicit excludeIds (z.B. „bereits gesehene
    // Posts") + die not-interested-IDs des Users.
    const allExcludes = [...excludeIds, ...notInterestedIds];
    if (allExcludes.length > 0) {
      query = query.not('id', 'in', `(${allExcludes.join(',')})`);
    }
    // Cursor-Pagination — identisches Pattern wie getFollowingFeed.
    if (before) query = query.lt('created_at', before);

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

    const { liked, saved, following, reposted } = await batchEngagement(postIds, authorIds, viewerId);

    return (rows as unknown as RawPostRow[])
      .map((row) => normalizeRow(row, liked, saved, following, reposted))
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
    const { liked, saved, reposted } = await batchEngagement(postIds, followedIds, user.id);

    // Following-Feed: following_author ist per Definition true
    const followingSet = new Set(followedIds);

    return (rows as unknown as RawPostRow[])
      .map((row) => normalizeRow(row, liked, saved, followingSet, reposted))
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

// -----------------------------------------------------------------------------
// getMyFollowedAccounts — Sidebar-Section „Konten, denen ich folge" (TikTok-
// Parity v1.w.UI.11 Phase B). Gibt die Profile zurück, denen der eingeloggte
// Viewer aktuell folgt — sortiert nach Follow-Zeitpunkt (neueste zuerst,
// passend zur TikTok-UX wo frische Follows oben stehen).
//
// Der Call läuft in zwei Schritten:
//   1. `follows`-Lookup (follower_id = viewer) → Array von (following_id, created_at).
//   2. `profiles`-Fetch (id IN (…)) für die sortierten IDs.
//
// Warum kein einziger Join-Query? Weil Supabase-PostgREST für FK-based Embed-
// dings `follows -> profiles!follows_following_id_fkey` als Relation-Name
// braucht, und der exakte FK-Name hier je nach Migration-Historie variiert
// (Mobile-Schema vs. manueller REFERENCES). Der 2-Step-Approach ist robust
// gegen solche Schema-Drifts und bleibt günstig (beide Queries sind
// indexiert: `follows.follower_id` + `profiles.id` PK).
//
// Paginierung via `offset` — tauglich für den „Alle anzeigen"-Sheet bis
// mittlere dreistellige Follow-Counts. Bei größeren Listen wäre Keyset-
// Paginierung über `follows.created_at` sauberer, aber das ist ein v2-
// Optimierungs-Thema.
// -----------------------------------------------------------------------------

export interface FollowedAccount {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

export const getMyFollowedAccounts = cache(
  async ({ limit = 5, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<
    FollowedAccount[]
  > => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // Schritt 1: IDs der gefolgten Accounts, nach Follow-Datum absteigend.
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const followingIds = (follows ?? []).map((f) => f.following_id as string);
    if (followingIds.length === 0) return [];

    // Schritt 2: Profile-Details. Supabase-JS garantiert KEIN Ordering bei `.in()`,
    // deshalb restauriert ein clientseitiger `Map`-Lookup die follow-date-Reihenfolge.
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .in('id', followingIds);

    const byId = new Map<string, FollowedAccount>();
    for (const p of (profiles ?? []) as Array<{
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      verified: boolean | null;
    }>) {
      byId.set(p.id, {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        verified: p.verified ?? false,
      });
    }

    // In der ursprünglichen follow-date-Reihenfolge zurückgeben; Profile die
    // zwischenzeitlich gelöscht wurden (follows-Zeile verwaist) werden
    // stillschweigend ausgefiltert.
    return followingIds
      .map((id) => byId.get(id))
      .filter((p): p is FollowedAccount => p !== undefined);
  },
);

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
// getPostsByTag — /t/[tag] Hashtag-Detail-Seite.
//
// Filtert Posts wo das `tags`-Array den normalisierten Tag enthält.
// PostgREST: `.contains('tags', [tag])` → SQL: tags @> ARRAY['tag'].
// Normalisierung: lowercase, führendes # entfernen.
// -----------------------------------------------------------------------------

export const getPostsByTag = cache(
  async (rawTag: string, limit = 24, offset = 0): Promise<FeedPost[]> => {
    const tag = rawTag.toLowerCase().replace(/^#/, '').trim();
    if (!tag) return [];

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('posts')
      .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
      .contains('tags', [tag])
      .eq('privacy', 'public')
      .order('view_count', { ascending: false })
      .order('id', { ascending: false }) // stable tie-break
      .range(offset, offset + limit - 1);

    if (error || !data) return [];

    // Engagement-Maps nur für eingeloggte User (like/save/follow/repost).
    const liked = new Set<string>();
    const saved = new Set<string>();
    const following = new Set<string>();
    const reposted = new Set<string>();

    if (user && data.length > 0) {
      const ids = data.map((r) => r.id as string);
      const authorIds = [...new Set(data.map((r) => (r as Record<string, unknown>).author_id as string).filter(Boolean))];
      const [likesRes, savesRes, followsRes, repostsRes] = await Promise.all([
        supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
        supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', ids),
        authorIds.length > 0
          ? supabase.from('follows').select('following_id').eq('follower_id', user.id).in('following_id', authorIds)
          : Promise.resolve({ data: [] }),
        supabase.from('reposts').select('post_id').eq('user_id', user.id).in('post_id', ids),
      ]);
      (likesRes.data ?? []).forEach((r) => liked.add(r.post_id as string));
      (savesRes.data ?? []).forEach((r) => saved.add(r.post_id as string));
      ((followsRes as { data: Array<{following_id: string}> | null }).data ?? []).forEach((r) => following.add(r.following_id));
      (repostsRes.data ?? []).forEach((r) => reposted.add(r.post_id as string));
    }

    return (data as unknown as RawPostRow[])
      .map((row) => normalizeRow(row, liked, saved, following, reposted))
      .filter((p): p is FeedPost => p !== null);
  },
);

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

  const { liked, saved, following, reposted } = await batchEngagement(postIds, authorIds, viewerId);
  const posts = postRows
    .map((row) => normalizeRow(row, liked, saved, following, reposted))
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

// -----------------------------------------------------------------------------
// searchPaginated — paginierte Einzel-Kategorie-Suche (v1.w.UI.117).
// Wird von GET /api/search/more?q=&type=users|posts|hashtags&offset=N aufgerufen.
// Kein cache() — nimmt offset-Argument.
// -----------------------------------------------------------------------------

export type SearchType = 'users' | 'posts' | 'hashtags';

export interface SearchPageResult {
  type: SearchType;
  users?: SearchResults['users'];
  posts?: SearchResults['posts'];
  hashtags?: SearchResults['hashtags'];
  hasMore: boolean;
}

const SEARCH_PAGE_LIMIT = 20;

export async function searchPaginated(
  q: string,
  type: SearchType,
  offset: number,
): Promise<SearchPageResult> {
  const query = q.trim();
  if (query.length < 2) {
    return { type, users: [], posts: [], hashtags: [], hasMore: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;
  const like = `%${query.replace(/[%_]/g, '')}%`;

  if (type === 'users') {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .or(`username.ilike.${like},display_name.ilike.${like}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + SEARCH_PAGE_LIMIT - 1);

    const users = ((data ?? []) as Array<{
      id: string; username: string; display_name: string | null;
      avatar_url: string | null; verified: boolean | null;
    }>).map((u) => ({
      id: u.id, username: u.username, display_name: u.display_name,
      avatar_url: u.avatar_url, verified: u.verified ?? false, follower_count: 0,
    }));
    return { type, users, hasMore: users.length >= SEARCH_PAGE_LIMIT };
  }

  if (type === 'posts') {
    const { data } = await supabase
      .from('posts')
      .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
      .ilike('caption', like)
      .eq('privacy', 'public')
      .order('view_count', { ascending: false })
      .range(offset, offset + SEARCH_PAGE_LIMIT - 1);

    const rows = (data ?? []) as unknown as RawPostRow[];
    const postIds = rows.map((r) => r.id);
    const authorIds = Array.from(new Set(rows.map((r) => {
      const a = r.author; const author = Array.isArray(a) ? a[0] : a; return author?.id;
    }).filter((id): id is string => typeof id === 'string')));
    const { liked, saved, following, reposted } = await batchEngagement(postIds, authorIds, viewerId);
    const posts = rows.map((row) => normalizeRow(row, liked, saved, following, reposted)).filter((p): p is FeedPost => p !== null);
    return { type, posts, hasMore: posts.length >= SEARCH_PAGE_LIMIT };
  }

  // hashtags — full list is fetched from trending (max 200), offset in-memory
  const tagLike = query.toLowerCase().replace(/^#/, '');
  const allTags = await getTrendingHashtags(200);
  const filtered = allTags.filter((t) => t.tag.includes(tagLike));
  const page = filtered.slice(offset, offset + SEARCH_PAGE_LIMIT);
  return { type, hashtags: page, hasMore: filtered.length > offset + SEARCH_PAGE_LIMIT };
}

// -----------------------------------------------------------------------------
// getSuggestedFollowsPage — Paginated, non-cached variant of getSuggestedFollows.
//
// Used by /people (dedicated discovery page) and GET /api/people.
// Unlike the cached getSuggestedFollows (sidebar, limit 5–12), this one takes
// an offset so the client can scroll through the full unfiltered list.
//
// Auth-aware: wenn eingeloggt, werden Self + bereits-gefolgte Accounts
// ausgeschlossen. Anon-User sehen alle Profile (kein Ausschluss nötig).
//
// Sortierung: follower_count DESC (beliebteste zuerst) — intentionally
// different from the sidebar variant (created_at DESC) so "people" page shows
// most useful accounts to discover first.
// -----------------------------------------------------------------------------

export const PEOPLE_PAGE_LIMIT = 24;

export interface PeoplePage {
  people: SuggestedFollow[];
  hasMore: boolean;
}

export async function getSuggestedFollowsPage(
  offset: number,
  limit: number = PEOPLE_PAGE_LIMIT,
): Promise<PeoplePage> {
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
    .select('id, username, display_name, avatar_url, verified:is_verified, follower_count')
    .order('follower_count', { ascending: false })
    .range(offset, offset + limit - 1);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data } = await query;
  if (!data) return { people: [], hasMore: false };

  const people = (data as Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean | null;
    follower_count: number | null;
  }>).map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    verified: p.verified ?? false,
    follower_count: p.follower_count ?? 0,
  }));

  return { people, hasMore: people.length >= limit };
}

// -----------------------------------------------------------------------------
// getExploreTrendingFeed — Offset-paginierter Feed sortiert nach view_count DESC.
//
// Für /explore "Trending"-Tab (v1.w.UI.219). Kein cache()-Wrapper wegen offset-
// Argument. Native .range()-Pagination (kein over-fetch+slice wie getForYouFeed).
// -----------------------------------------------------------------------------

export interface ExplorePage {
  posts: FeedPost[];
  hasMore: boolean;
}

export async function getExploreTrendingFeed(
  limit = 12,
  offset = 0,
): Promise<ExplorePage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const { data, error } = await supabase
    .from('posts')
    .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
    .eq('privacy', 'public')
    .order('view_count', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return { posts: [], hasMore: false };

  const rows = data as unknown as RawPostRow[];
  const postIds = rows.map((r) => r.id);
  const authorIds = Array.from(
    new Set(
      rows
        .map((r) => {
          const a = r.author;
          const author = Array.isArray(a) ? a[0] : a;
          return author?.id;
        })
        .filter((id): id is string => typeof id === 'string'),
    ),
  );
  const { liked, saved, following, reposted } = await batchEngagement(postIds, authorIds, viewerId);
  const posts = rows
    .map((row) => normalizeRow(row, liked, saved, following, reposted))
    .filter((p): p is FeedPost => p !== null);

  return { posts, hasMore: posts.length >= limit };
}

// -----------------------------------------------------------------------------
// getExploreNewestFeed — Offset-paginierter Feed sortiert nach created_at DESC.
//
// Für /explore "Newest"-Tab (v1.w.UI.219). Kein cache()-Wrapper wegen offset-
// Argument. Native .range()-Pagination.
// -----------------------------------------------------------------------------

export async function getExploreNewestFeed(
  limit = 12,
  offset = 0,
): Promise<ExplorePage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const { data, error } = await supabase
    .from('posts')
    .select(`${POST_COLUMNS}, ${AUTHOR_JOIN}`)
    .eq('privacy', 'public')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return { posts: [], hasMore: false };

  const rows = data as unknown as RawPostRow[];
  const postIds = rows.map((r) => r.id);
  const authorIds = Array.from(
    new Set(
      rows
        .map((r) => {
          const a = r.author;
          const author = Array.isArray(a) ? a[0] : a;
          return author?.id;
        })
        .filter((id): id is string => typeof id === 'string'),
    ),
  );
  const { liked, saved, following, reposted } = await batchEngagement(postIds, authorIds, viewerId);
  const posts = rows
    .map((row) => normalizeRow(row, liked, saved, following, reposted))
    .filter((p): p is FeedPost => p !== null);

  return { posts, hasMore: posts.length >= limit };
}

// -----------------------------------------------------------------------------
// getDiscoverPeople — Explore "Nutzer entdecken" mit Grund-Labels (v1.w.UI.231)
//
// Parity mit native `useDiscoverPeople()`. Drei Tiers:
//  1. Gleiche Guild  → reason: 'guild'
//  2. Gleiche Interessen (Top-Hashtag aus eigenen Posts) → reason: 'interests'
//  3. Neueste aktive User (Fallback)  → reason: 'new'
//
// Schließt Self + bereits-gefolgte Accounts aus. Max `limit` Empfehlungen.
// Server-side cached via React `cache()` — safe für SSR parallel fetch.
// -----------------------------------------------------------------------------

export type DiscoverReason = 'guild' | 'interests' | 'new';

export interface DiscoverPerson {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  reason: DiscoverReason;
}

export const getDiscoverPeople = cache(async (limit = 12): Promise<DiscoverPerson[]> => {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    // Anon: nur Fallback — neueste Profile ohne Guild/Interest-Matching
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!data) return [];
    return (
      data as Array<{
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        verified: boolean;
      }>
    ).map((p) => ({ ...p, reason: 'new' as DiscoverReason }));
  }

  const userId = user.id;

  // ── Ausschluss-Set: Self + bereits gefolgt ─────────────────────────────────
  const { data: followingRows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  const excludeIds = new Set<string>([
    userId,
    ...(followingRows ?? []).map((r) => r.following_id as string),
  ]);

  const results: DiscoverPerson[] = [];
  const seen = new Set<string>();

  const addUser = (
    u: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      verified: boolean;
    },
    reason: DiscoverReason,
  ) => {
    if (!seen.has(u.id) && !excludeIds.has(u.id)) {
      seen.add(u.id);
      results.push({ ...u, reason });
    }
  };

  // ── Guild-ID des eingeloggten Users ───────────────────────────────────────
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('guild_id')
    .eq('id', userId)
    .maybeSingle();
  const guildId = (myProfile as { guild_id: string | null } | null)?.guild_id ?? null;

  // ── Tier 1: Gleiche Guild ──────────────────────────────────────────────────
  if (guildId) {
    const { data: guildUsers } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .eq('guild_id', guildId)
      .neq('id', userId)
      .limit(8);
    (guildUsers ?? []).forEach((u) =>
      addUser(
        u as {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          verified: boolean;
        },
        'guild',
      ),
    );
  }

  // ── Tier 2: Gleiche Interessen (Top-Hashtag aus eigenen Posts) ────────────
  const { data: myPosts } = await supabase
    .from('posts')
    .select('tags')
    .eq('author_id', userId)
    .limit(20);

  const tagFreq = new Map<string, number>();
  (myPosts ?? []).forEach((p) => {
    ((p.tags as string[]) ?? []).forEach((t) => tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1));
  });
  const topTag = [...tagFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .map(([t]) => t)[0];

  if (topTag) {
    const { data: tagPosts } = await supabase
      .from('posts')
      .select('author_id, profiles!inner(id, username, display_name, avatar_url, verified:is_verified)')
      .contains('tags', [topTag])
      .neq('author_id', userId)
      .limit(20);

    (tagPosts ?? []).forEach((p) => {
      const u = p.profiles as unknown as {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        verified: boolean;
      };
      if (u) addUser(u, 'interests');
    });
  }

  // ── Tier 3: Neueste aktive User (Fallback) ─────────────────────────────────
  if (results.length < limit) {
    const { data: newUsers } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .neq('id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + excludeIds.size);
    (newUsers ?? []).forEach((u) =>
      addUser(
        u as {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          verified: boolean;
        },
        'new',
      ),
    );
  }

  return results.slice(0, limit);
});
