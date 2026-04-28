import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { PublicProfile, Post, Story } from '@shared/types';

// -----------------------------------------------------------------------------
// Schema-Drift-Adapter (Mobile-DB → Web-Type-Contract)
// -----------------------------------------------------------------------------
//
// Die produktive DB wurde vom Mobile-App-Schema angelegt und weicht vom Web-
// Type-Contract in mehreren Namen/Shapes ab. Statt den Web-Contract zu bre-
// chen (Cascade in p/[postId], feed-card, search, messages …), adaptieren
// wir hier zentral auf die echten DB-Spalten:
//
//   profiles:
//     verified              → is_verified
//     (keine denorm. counter) → 3× aggregierte HEAD-Count-Queries
//
//   follows:
//     followed_id           → following_id   (Mobile: follower_id/following_id)
//
//   posts:
//     user_id               → author_id      (FK: posts_author_id_fkey)
//     video_url             → media_url
//     hashtags              → tags
//     duration_secs / music_id / allow_stitch
//                           → existieren nicht → null/true-Defaults
//     like_count / comment_count
//                           → nicht denormalisiert → embedded aggregate
//                             via likes(count) / comments(count)
//
//   comments:
//     body                  → text
//     deleted_at            → existiert nicht → hard-delete-Modell, kein Filter
//     like_count            → existiert nicht → 0-Default
//
//   stories:
//     expires_at / duration_secs / view_count
//                           → existieren nicht → TTL via created_at+24h,
//                             sonstige Felder auf neutralen Defaults
//
// Der Contract darf sich zukünftig vom Mobile-Schema weiter entfernen; der
// Adapter ist die einzige Stelle, die angefasst werden muss, wenn eine Seite
// neue Felder anzeigen soll.
// -----------------------------------------------------------------------------

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

type AuthorRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean | null;
};

type AuthorContract = Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'verified'>;

function normalizeAuthor(a: AuthorRow | AuthorRow[] | null | undefined): AuthorContract | null {
  const raw = Array.isArray(a) ? (a[0] ?? null) : a ?? null;
  if (!raw) return null;
  return {
    id: raw.id,
    username: raw.username,
    display_name: raw.display_name,
    avatar_url: raw.avatar_url,
    verified: raw.verified ?? false,
  };
}

// Embedded aggregate result from Supabase can be `[{count:N}]` or a scalar.
function extractCount(v: unknown): number {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && v.length > 0 && typeof (v[0] as { count?: number }).count === 'number') {
    return (v[0] as { count: number }).count;
  }
  return 0;
}

// -----------------------------------------------------------------------------
// Public profile by username — read-through cache per request.
// -----------------------------------------------------------------------------

export const getPublicProfile = cache(async (username: string): Promise<PublicProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, is_verified, is_private, website, teip')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error || !data) return null;

  const [followerRes, followingRes, postsRes, liveRes] = await Promise.all([
    // Wer folgt MIR? → follows WHERE following_id = me
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', data.id),
    // Wem folge ICH? → follows WHERE follower_id = me
    supabase
      .from('follows')
      .select('following_id', { count: 'exact', head: true })
      .eq('follower_id', data.id),
    // Meine Posts → posts WHERE author_id = me
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', data.id),
    // v1.w.UI.16: aktive Live-Session dieses Hosts, falls vorhanden. Für den
    // Avatar-Gradient-Ring + „LIVE"-Badge auf dem Profil-Hero. Wir nehmen
    // maxStarted (jüngste Session) — doppelte Active-Sessions sollte es nicht
    // geben (Mobile-Flow beendet alte Session beim Start einer neuen), aber
    // falls doch, ist die jüngste die richtige. Nutzt `idx_live_sessions_host`
    // (host_id-Filter verkleinert die Row-Menge auf <10 Sessions pro User
    // Lifetime) + in-memory Status-Filter. Kein zusätzlicher Partial-Index
    // nötig bei dieser Result-Set-Größe.
    supabase
      .from('live_sessions')
      .select('id')
      .eq('host_id', data.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    id: data.id,
    username: data.username,
    display_name: data.display_name,
    avatar_url: data.avatar_url,
    bio: data.bio,
    verified: data.is_verified,
    follower_count: followerRes.count ?? 0,
    following_count: followingRes.count ?? 0,
    post_count: postsRes.count ?? 0,
    is_live: !!liveRes.data?.id,
    live_session_id: liveRes.data?.id ?? null,
    is_private: (data as any).is_private ?? false,
    website: (data as any).website ?? null,
    teip: (data as any).teip ?? null,
  };
});

// -----------------------------------------------------------------------------
// getFollowState — follows + pending follow_request check for the viewer.
// Replaces the bare `isFollowing` cache for profile pages that need to show
// "Anfrage gesendet" when the target has is_private=true.
// -----------------------------------------------------------------------------

export interface FollowState {
  following: boolean;
  pendingRequest: boolean;
}

export const getFollowState = cache(async (targetUserId: string): Promise<FollowState> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === targetUserId) return { following: false, pendingRequest: false };

  const [followRow, requestRow] = await Promise.all([
    supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle(),
    supabase
      .from('follow_requests')
      .select('id')
      .eq('sender_id', user.id)
      .eq('receiver_id', targetUserId)
      .maybeSingle(),
  ]);

  return {
    following: !!followRow.data,
    pendingRequest: !!requestRow.data,
  };
});

// -----------------------------------------------------------------------------
// Shared row→Post transformer (Mobile-shape → Web-Post-contract).
// -----------------------------------------------------------------------------

type PostRowMobile = {
  id: string;
  author_id: string;
  caption: string | null;
  media_url: string | null;
  // Mobile-Schema diskriminiert Bild vs. Video über `media_type`. Für den
  // Post-Detail-Branch (VideoPlayer vs. <img>) müssen wir den Wert lesen.
  // Optional + Default 'video' weil ältere Rows vor der media_type-Einführung
  // reine Video-Posts waren.
  media_type?: 'image' | 'video' | null;
  thumbnail_url: string | null;
  view_count: number | null;
  tags: string[] | null;
  allow_comments: boolean | null;
  allow_duet: boolean | null;
  // v1.w.UI.169 — WOZ badge in PostGrid
  women_only?: boolean | null;
  // v1.w.UI.171 — real share count from DB
  share_count?: number | null;
  // v1.w.UI.179 — pinned to author profile
  is_pinned?: boolean | null;
  // v1.w.UI.205 — aspect ratio at upload time
  aspect_ratio?: 'portrait' | 'landscape' | 'square' | null;
  created_at: string;
  like_count?: unknown; // embedded aggregate
  comment_count?: unknown; // embedded aggregate
};

const VALID_RATIOS = ['portrait', 'landscape', 'square'] as const;

function toPost(row: PostRowMobile): Post {
  return {
    id: row.id,
    user_id: row.author_id,
    caption: row.caption,
    // Mobile-Schema kennt nur media_url — Web-Contract heißt aus historischen
    // Gründen video_url, trägt aber auch Bild-URLs (media_type differenziert,
    // wird derzeit Web-seitig nicht benötigt).
    video_url: row.media_url ?? '',
    thumbnail_url: row.thumbnail_url,
    duration_secs: null,
    view_count: row.view_count ?? 0,
    like_count: extractCount(row.like_count),
    comment_count: extractCount(row.comment_count),
    share_count: row.share_count ?? 0,
    hashtags: row.tags ?? [],
    music_id: null,
    allow_comments: row.allow_comments ?? true,
    allow_duet: row.allow_duet ?? true,
    allow_stitch: true,
    women_only: row.women_only ?? false,
    // v1.w.UI.179 — carry pinned flag through so PostGrid can badge it
    is_pinned: row.is_pinned ?? false,
    // v1.w.UI.205 — carry aspect_ratio through for PostGrid display
    aspect_ratio: VALID_RATIOS.includes(row.aspect_ratio as 'portrait' | 'landscape' | 'square')
      ? (row.aspect_ratio as 'portrait' | 'landscape' | 'square')
      : 'portrait',
    created_at: row.created_at,
  };
}

// -----------------------------------------------------------------------------
// Posts by a profile — latest first, paginated.
// -----------------------------------------------------------------------------

// v1.w.UI.212 — sort key for profile post-grid (matches mobile sort bar).
export type ProfileSortKey = 'newest' | 'views' | 'likes';

/** Returns the secondary order-by column for the given sort key. */
function profileSortOrder(sort: ProfileSortKey): string {
  if (sort === 'views') return 'view_count';
  if (sort === 'likes') return 'like_count';
  return 'created_at';
}

export const getProfilePosts = cache(
  async (userId: string, limit = 24, before?: string, sort: ProfileSortKey = 'newest'): Promise<Post[]> => {
    const supabase = await createClient();
    // v1.w.UI.179 — include is_pinned; order pinned post first.
    // v1.w.UI.212 — secondary sort driven by `sort` param.
    let query = supabase
      .from('posts')
      .select(
        `id, author_id, caption, media_url, thumbnail_url, view_count, share_count, tags, allow_comments, allow_duet, women_only, is_pinned, aspect_ratio, created_at,
         like_count:likes(count),
         comment_count:comments(count)`,
      )
      .eq('author_id', userId)
      .order('is_pinned', { ascending: false })
      .order(profileSortOrder(sort), { ascending: false })
      .limit(limit);

    if (before && sort === 'newest') query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as unknown as PostRowMobile[]).map(toPost);
  },
);

// -----------------------------------------------------------------------------
// getProfilePostsPage — non-cached, offset-based variant of getProfilePosts.
// Used by GET /api/posts/user/[userId] for PostGrid infinite scroll.
// v1.w.UI.121
// -----------------------------------------------------------------------------

export async function getProfilePostsPage(
  userId: string,
  offset: number,
  limit: number,
  sort: ProfileSortKey = 'newest',
): Promise<Post[]> {
  const supabase = await createClient();
  // v1.w.UI.179 — include is_pinned; pinned posts always sort first.
  // v1.w.UI.212 — secondary sort driven by `sort` param.
  const { data, error } = await supabase
    .from('posts')
    .select(
      `id, author_id, caption, media_url, thumbnail_url, view_count, share_count, tags, allow_comments, allow_duet, women_only, is_pinned, aspect_ratio, created_at,
       like_count:likes(count),
       comment_count:comments(count)`,
    )
    .eq('author_id', userId)
    .order('is_pinned', { ascending: false })
    .order(profileSortOrder(sort), { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];
  return (data as unknown as PostRowMobile[]).map(toPost);
}

// -----------------------------------------------------------------------------
// getBookmarkedPostsPage — non-cached, offset-based variant of getBookmarkedPosts.
// Used by GET /api/saved for PostGrid infinite scroll on /saved.
// v1.w.UI.121
// -----------------------------------------------------------------------------

export async function getBookmarkedPostsPage(
  offset: number,
  limit: number,
): Promise<Post[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('bookmarks')
    .select(
      `bookmarked_at:created_at,
       post:posts!bookmarks_post_id_fkey (
         id, author_id, caption, media_url, thumbnail_url, view_count, share_count, tags,
         allow_comments, allow_duet, aspect_ratio, created_at,
         like_count:likes(count),
         comment_count:comments(count)
       )`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];

  const posts: Post[] = [];
  for (const row of data as unknown as BookmarkJoinRow[]) {
    if (!row.post) continue;
    posts.push(toPost(row.post));
  }
  return posts;
}

// -----------------------------------------------------------------------------
// getLikedPostsPage — non-cached, offset-based variant for infinite scroll.
// Auth-scoped: returns posts liked by the authenticated user only (likes are
// private — only shown on isSelf profile tab). v1.w.UI.126
// -----------------------------------------------------------------------------

export async function getLikedPostsPage(
  offset: number,
  limit: number,
): Promise<Post[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('likes')
    .select(
      `liked_at:created_at,
       post:posts!likes_post_id_fkey (
         id, author_id, caption, media_url, thumbnail_url, view_count, share_count, tags,
         allow_comments, allow_duet, aspect_ratio, created_at,
         like_count:likes(count),
         comment_count:comments(count)
       )`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];

  const posts: Post[] = [];
  for (const row of data as unknown as LikesJoinRow[]) {
    if (!row.post) continue;
    posts.push(toPost(row.post));
  }
  return posts;
}

// -----------------------------------------------------------------------------
// Posts liked by a profile — newest like first, capped at limit.
//
// Sichtbarkeit: In der nativen App und hier auf Web sind Likes privat —
// der Likes-Tab wird auf dem Profil-Screen nur für `isSelf` gerendert.
// Die Funktion selbst macht keinen Auth-Check (RLS `using (true)`) — die
// Sichtbarkeits-Entscheidung liegt beim Aufrufer (Profile-Page: isSelf-Guard).
// -----------------------------------------------------------------------------

type LikesJoinRow = {
  liked_at: string;
  post: PostRowMobile | null;
};

export const getProfileLikedPosts = cache(
  async (userId: string, limit = 24): Promise<Post[]> => {
    const supabase = await createClient();

    // Via likes → posts join: newest-liked zuerst.
    const { data, error } = await supabase
      .from('likes')
      .select(
        `liked_at:created_at,
         post:posts!likes_post_id_fkey (
           id, author_id, caption, media_url, thumbnail_url, view_count, share_count, tags,
           allow_comments, allow_duet, aspect_ratio, created_at,
           like_count:likes(count),
           comment_count:comments(count)
         )`,
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    const posts: Post[] = [];
    for (const row of data as unknown as LikesJoinRow[]) {
      if (!row.post) continue;
      posts.push(toPost(row.post));
    }
    return posts;
  },
);

// -----------------------------------------------------------------------------
// Posts bookmarked by the authenticated user — newest bookmark first.
//
// Rein privat — Bookmarks sind nur für den eingeloggten User selbst sichtbar.
// RLS auf `bookmarks`: `for select using (auth.uid() = user_id)` → fremde
// User können diese Funktion aufrufen, bekommen aber 0 Ergebnisse zurück.
// Die /saved-Page macht zusätzlich einen Auth-Redirect-Guard.
// -----------------------------------------------------------------------------

type BookmarkJoinRow = {
  bookmarked_at: string;
  post: PostRowMobile | null;
};

export const getBookmarkedPosts = cache(
  async (limit = 48): Promise<Post[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('bookmarks')
      .select(
        `bookmarked_at:created_at,
         post:posts!bookmarks_post_id_fkey (
           id, author_id, caption, media_url, thumbnail_url, view_count, share_count, tags,
           allow_comments, allow_duet, aspect_ratio, created_at,
           like_count:likes(count),
           comment_count:comments(count)
         )`,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    const posts: Post[] = [];
    for (const row of data as unknown as BookmarkJoinRow[]) {
      if (!row.post) continue;
      posts.push(toPost(row.post));
    }
    return posts;
  },
);

// -----------------------------------------------------------------------------
// getBattleHistory — v1.w.UI.52 Profil Battles-Tab.
//
// Liefert alle Battles eines Users (als Host oder Guest) aus
// `live_battle_history`, jeweils mit Opponent-Profil.
// Public lesbar (RLS: authenticated), kein Auth-Gate nötig außer für
// den Battle-Ergebnis-Hinweis (won/lost/draw relative zum Viewer).
// -----------------------------------------------------------------------------

export interface BattleRecord {
  id: string;
  session_id: string;
  /** Der User selbst: score des angezeigten Profils */
  my_score: number;
  /** Der Gegner: score */
  opponent_score: number;
  /** 'won' | 'lost' | 'draw' — relativ zum Profil-User */
  result: 'won' | 'lost' | 'draw';
  duration_secs: number;
  ended_at: string;
  opponent: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export const getBattleHistory = cache(
  async (userId: string, limit = 30): Promise<BattleRecord[]> => {
    const supabase = await createClient();

    // Zwei separate Queries (als Host / als Guest) + client-side merge,
    // weil PostgREST kein OR über FKs in einem Select unterstützt.
    const [hostRes, guestRes] = await Promise.all([
      supabase
        .from('live_battle_history')
        .select(
          `id, session_id, host_score, guest_score, winner, duration_secs, ended_at,
           opponent:profiles!live_battle_history_guest_id_fkey (
             id, username, display_name, avatar_url
           )`,
        )
        .eq('host_id', userId)
        .order('ended_at', { ascending: false })
        .limit(limit),
      supabase
        .from('live_battle_history')
        .select(
          `id, session_id, host_score, guest_score, winner, duration_secs, ended_at,
           opponent:profiles!live_battle_history_host_id_fkey (
             id, username, display_name, avatar_url
           )`,
        )
        .eq('guest_id', userId)
        .order('ended_at', { ascending: false })
        .limit(limit),
    ]);

    type RawRow = {
      id: string;
      session_id: string;
      host_score: number;
      guest_score: number;
      winner: string;
      duration_secs: number;
      ended_at: string;
      opponent: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
    };

    const toRecord = (row: RawRow, role: 'host' | 'guest'): BattleRecord | null => {
      if (!row.opponent) return null;
      const myScore   = role === 'host' ? row.host_score  : row.guest_score;
      const oppScore  = role === 'host' ? row.guest_score : row.host_score;
      const winner    = row.winner; // 'host' | 'guest' | 'draw'
      const result: BattleRecord['result'] =
        winner === 'draw' ? 'draw'
        : (winner === 'host') === (role === 'host') ? 'won' : 'lost';
      return { id: row.id, session_id: row.session_id, my_score: myScore, opponent_score: oppScore, result, duration_secs: row.duration_secs, ended_at: row.ended_at, opponent: row.opponent };
    };

    const hostRows   = ((hostRes.data  ?? []) as unknown as RawRow[]).map((r) => toRecord(r, 'host')).filter((r): r is BattleRecord => r !== null);
    const guestRows  = ((guestRes.data ?? []) as unknown as RawRow[]).map((r) => toRecord(r, 'guest')).filter((r): r is BattleRecord => r !== null);

    // Merge + sort by ended_at desc, deduplicate by id, cap at limit
    const all = [...hostRows, ...guestRows]
      .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
      .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
      .slice(0, limit);

    return all;
  },
);

// -----------------------------------------------------------------------------
// Single post with author-profile joined.
//
// `media_type` wird zusätzlich zum Post-Contract durchgereicht, damit die
// Detail-Page Bild- vs. Video-Posts korrekt rendern kann (sonst landet jeder
// Image-Post im VideoPlayer → native onError → „Das Video konnte nicht
// geladen werden."). Der Web-Contract bleibt unberührt, das Feld wird
// punktuell an der Grenze zwischen Adapter und Page angeflanscht.
// -----------------------------------------------------------------------------

export interface PostWithAuthor extends Post {
  author: Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'verified'>;
  media_type: 'image' | 'video';
  /** Privacy-Setting: 'public' | 'friends' | 'private'. Default 'public' für Legacy-Rows. */
  privacy: 'public' | 'friends' | 'private';
  allow_download: boolean;
  women_only: boolean;
  /** Seitenverhältnis für format-aware Layout. Default 'portrait' für Legacy-Rows. */
  aspect_ratio: 'portrait' | 'landscape' | 'square';
  /** v1.w.UI.211 — background audio track URL; null if no music was added. */
  audio_url: string | null;
  /** v1.w.UI.211 — audio track volume 0–1; null = creator default 0.8. */
  audio_volume: number | null;
}

export const getPost = cache(async (postId: string): Promise<PostWithAuthor | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts')
    .select(
      `id, author_id, caption, media_url, media_type, thumbnail_url, view_count, share_count, tags, allow_comments, allow_duet, allow_download, privacy, women_only, aspect_ratio, audio_url, audio_volume, created_at,
       like_count:likes(count),
       comment_count:comments(count),
       author:profiles!posts_author_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
    )
    .eq('id', postId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as PostRowMobile & { author: AuthorRow | AuthorRow[] | null };
  const author = normalizeAuthor(row.author);
  if (!author) return null;

  const post = toPost(row);
  // Default auf 'video' — Legacy-Rows vor der media_type-Einführung waren
  // ausschließlich Videos, und VideoPlayer ist unser Default-Renderer.
  const media_type: 'image' | 'video' = row.media_type === 'image' ? 'image' : 'video';
  const rowAny = row as Record<string, unknown>;
  const privacy = (['public', 'friends', 'private'] as const).includes(rowAny.privacy as 'public' | 'friends' | 'private')
    ? (rowAny.privacy as 'public' | 'friends' | 'private')
    : 'public';
  const allow_download = typeof rowAny.allow_download === 'boolean' ? rowAny.allow_download : true;
  const women_only = typeof rowAny.women_only === 'boolean' ? rowAny.women_only : false;
  const aspect_ratio = (['portrait', 'landscape', 'square'] as const).includes(rowAny.aspect_ratio as 'portrait' | 'landscape' | 'square')
    ? (rowAny.aspect_ratio as 'portrait' | 'landscape' | 'square')
    : 'portrait';
  const audio_url = typeof rowAny.audio_url === 'string' ? rowAny.audio_url : null;
  const audio_volume = typeof rowAny.audio_volume === 'number' ? rowAny.audio_volume : null;
  return { ...post, author, media_type, privacy, allow_download, women_only, aspect_ratio, audio_url, audio_volume };
});

// -----------------------------------------------------------------------------
// Read-only comments for a post — latest-first, capped for public render.
// -----------------------------------------------------------------------------

export interface CommentWithAuthor {
  id: string;
  post_id: string;
  user_id: string;
  /** null = Top-Level-Kommentar; uuid = Reply auf einen anderen Kommentar. */
  parent_id: string | null;
  body: string;
  like_count: number;
  /** true wenn der aktuelle Viewer diesen Kommentar geliked hat. */
  liked_by_me: boolean;
  created_at: string;
  /** Anzahl direkter Antworten (denormalisiert via Sub-Query in getPostComments). */
  reply_count: number;
  author: Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'verified'>;
}

type CommentRowMobile = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  text: string | null;
  created_at: string;
  reply_count?: { count: number }[] | number | null;
  author: AuthorRow | AuthorRow[] | null;
};

// Hilfsfunktion — normalisiert PostgREST count-embedding auf Zahl.
function extractCommentCount(raw: CommentRowMobile['reply_count']): number {
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0]?.count ?? 0;
  return 0;
}

// getPostComments — nur Top-Level-Kommentare (parent_id IS NULL), älteste zuerst.
// reply_count wird als aggregiertes COUNT eingebettet.
// viewerId optional — wenn gesetzt, werden liked_by_me + like_count per Batch befüllt.
export const getPostComments = cache(async (
  postId: string,
  limit = 30,
  viewerId?: string | null,
): Promise<CommentWithAuthor[]> => {
  const supabase = await createClient();

  // Primärer Query: mit parent_id-Filter + Reply-Count (setzt parent_id-Spalte voraus).
  // Hint via Spaltenname (`comments!parent_id`), nicht Constraint-Name — robuster
  // gegen Constraint-Renames und matched die anonyme FK aus der Migration.
  let data: unknown[] | null = null;
  let hasParentId = true;

  const { data: d1, error: e1 } = await supabase
    .from('comments')
    .select(
      `id, post_id, user_id, parent_id, text, created_at,
       reply_count:comments!parent_id(count),
       author:profiles!comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
    )
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!e1 && d1) {
    data = d1;
  } else if (e1?.code === '42703') {
    // Migration-rollout safety net: code may land on Vercel before
    // `supabase db push` ran. Catch only "column missing" (42703);
    // every other error must surface so we can fix it.
    hasParentId = false;
    const { data: d2, error: e2 } = await supabase
      .from('comments')
      .select(
        `id, post_id, user_id, text, created_at,
         author:profiles!comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (e2 || !d2) return [];
    data = d2;
  } else {
    // Anderer Fehler — nicht maskieren, leere Liste konsistent mit den
    // anderen Data-Layer-Functions (siehe `feed.ts`-Pattern).
    return [];
  }

  if (!data) return [];

  const rows = data as unknown as CommentRowMobile[];
  const ids = rows.map((r) => r.id);

  // Batch-fetch comment_likes für Like-Count + liked_by_me.
  const [allLikesRes, myLikesRes] = await Promise.all([
    ids.length > 0
      ? supabase.from('comment_likes').select('comment_id').in('comment_id', ids)
      : Promise.resolve({ data: [] as { comment_id: string }[], error: null }),
    ids.length > 0 && viewerId
      ? supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', viewerId)
          .in('comment_id', ids)
      : Promise.resolve({ data: [] as { comment_id: string }[], error: null }),
  ]);

  const countMap = new Map<string, number>();
  for (const r of allLikesRes.data ?? []) {
    countMap.set(r.comment_id, (countMap.get(r.comment_id) ?? 0) + 1);
  }
  const likedSet = new Set((myLikesRes.data ?? []).map((r) => r.comment_id));

  const out: CommentWithAuthor[] = [];
  for (const row of rows) {
    const author = normalizeAuthor(row.author);
    if (!author) continue;
    out.push({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      parent_id: hasParentId ? (row.parent_id ?? null) : null,
      body: row.text ?? '',
      like_count: countMap.get(row.id) ?? 0,
      liked_by_me: likedSet.has(row.id),
      reply_count: hasParentId ? extractCommentCount(row.reply_count) : 0,
      created_at: row.created_at,
      author,
    });
  }
  return out;
});

// getCommentReplies — Replies zu einem Top-Level-Kommentar, älteste zuerst.
// Kein React.cache() — wird client-seitig via Server Action aufgerufen,
// per-request-Dedup bringt dort nichts.
// viewerId optional — befüllt liked_by_me + like_count per Batch.
export async function getCommentReplies(
  parentId: string,
  limit = 20,
  viewerId?: string | null,
): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('comments')
    .select(
      `id, post_id, user_id, parent_id, text, created_at,
       author:profiles!comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
    )
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  const rows = data as unknown as CommentRowMobile[];
  const ids = rows.map((r) => r.id);

  const [allLikesRes, myLikesRes] = await Promise.all([
    ids.length > 0
      ? supabase.from('comment_likes').select('comment_id').in('comment_id', ids)
      : Promise.resolve({ data: [] as { comment_id: string }[], error: null }),
    ids.length > 0 && viewerId
      ? supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', viewerId)
          .in('comment_id', ids)
      : Promise.resolve({ data: [] as { comment_id: string }[], error: null }),
  ]);

  const countMap = new Map<string, number>();
  for (const r of allLikesRes.data ?? []) {
    countMap.set(r.comment_id, (countMap.get(r.comment_id) ?? 0) + 1);
  }
  const likedSet = new Set((myLikesRes.data ?? []).map((r) => r.comment_id));

  const out: CommentWithAuthor[] = [];
  for (const row of rows) {
    const author = normalizeAuthor(row.author);
    if (!author) continue;
    out.push({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      parent_id: row.parent_id ?? null,
      body: row.text ?? '',
      like_count: countMap.get(row.id) ?? 0,
      liked_by_me: likedSet.has(row.id),
      reply_count: 0, // Replies haben keine weiteren Replies (1 Ebene max.)
      created_at: row.created_at,
      author,
    });
  }
  return out;
}

// getMoreComments — Offset-Pagination für Top-Level-Kommentare.
// Kein React.cache() — wird client-seitig via Server Action aufgerufen.
// Gleiche Semantik wie getPostComments aber mit .range(offset, offset+limit-1).
export async function getMoreComments(
  postId: string,
  offset: number,
  limit = 20,
  viewerId?: string | null,
): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('comments')
    .select(
      `id, post_id, user_id, parent_id, text, created_at,
       reply_count:comments!parent_id(count),
       author:profiles!comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
    )
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];

  const rows = data as unknown as CommentRowMobile[];
  const ids = rows.map((r) => r.id);

  const [allLikesRes, myLikesRes] = await Promise.all([
    ids.length > 0
      ? supabase.from('comment_likes').select('comment_id').in('comment_id', ids)
      : Promise.resolve({ data: [] as { comment_id: string }[], error: null }),
    ids.length > 0 && viewerId
      ? supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', viewerId)
          .in('comment_id', ids)
      : Promise.resolve({ data: [] as { comment_id: string }[], error: null }),
  ]);

  const countMap = new Map<string, number>();
  for (const r of allLikesRes.data ?? []) {
    countMap.set(r.comment_id, (countMap.get(r.comment_id) ?? 0) + 1);
  }
  const likedSet = new Set((myLikesRes.data ?? []).map((r) => r.comment_id));

  const out: CommentWithAuthor[] = [];
  for (const row of rows) {
    const author = normalizeAuthor(row.author);
    if (!author) continue;
    out.push({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      parent_id: row.parent_id ?? null,
      body: row.text ?? '',
      like_count: countMap.get(row.id) ?? 0,
      liked_by_me: likedSet.has(row.id),
      reply_count: extractCommentCount(row.reply_count),
      created_at: row.created_at,
      author,
    });
  }
  return out;
}

// -----------------------------------------------------------------------------
// Story with TTL check — returns null if expired (Mobile hat kein expires_at).
// v1.w.UI.161: Extended with interactive poll data + vote counts.
// -----------------------------------------------------------------------------

export type StoryPoll = {
  type: 'poll';
  question: string;
  options: string[];
};

export interface StoryWithAuthor extends Story {
  author: Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'verified'>;
  // v1.w.UI.161: Poll fields — present when stories.interactive is set.
  poll?: StoryPoll | null;
  poll_votes?: number[];  // vote count per option index (length === options.length)
  my_vote?: number | null; // option_idx the current user voted, null = not voted
}

type StoryRowMobile = {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  created_at: string;
  interactive: unknown | null;
  author: AuthorRow | AuthorRow[] | null;
};

export const getStory = cache(async (storyId: string): Promise<StoryWithAuthor | null> => {
  const supabase = await createClient();

  const [storyRes, { data: { user } }] = await Promise.all([
    supabase
      .from('stories')
      .select(
        `id, user_id, media_url, media_type, created_at, interactive,
         author:profiles!stories_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
      )
      .eq('id', storyId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (storyRes.error || !storyRes.data) return null;

  // 24h TTL — Mobile-Schema hat kein explizites expires_at, wir rechnen es.
  const row = storyRes.data as unknown as StoryRowMobile;
  const createdMs = new Date(row.created_at).getTime();
  const expiresMs = createdMs + STORY_TTL_MS;
  if (expiresMs < Date.now()) return null;

  const author = normalizeAuthor(row.author);
  if (!author) return null;

  const story: Story = {
    id: row.id,
    user_id: row.user_id,
    media_url: row.media_url ?? '',
    media_type: row.media_type ?? 'image',
    duration_secs: 0,
    expires_at: new Date(expiresMs).toISOString(),
    view_count: 0,
    created_at: row.created_at,
  };

  // v1.w.UI.161: Parse poll + fetch vote counts if interactive is set.
  const interactiveRaw = row.interactive as { type?: string; question?: string; options?: string[] } | null;
  if (interactiveRaw?.type === 'poll' && Array.isArray(interactiveRaw.options)) {
    const poll: StoryPoll = {
      type: 'poll',
      question: interactiveRaw.question ?? '',
      options: interactiveRaw.options as string[],
    };

    // Fetch all votes for this story + optionally the current user's vote.
    const [votesRes, myVoteRes] = await Promise.all([
      supabase
        .from('story_votes')
        .select('option_idx')
        .eq('story_id', storyId),
      user
        ? supabase
            .from('story_votes')
            .select('option_idx')
            .eq('story_id', storyId)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Tally votes per option.
    const tallied = new Array<number>(poll.options.length).fill(0);
    for (const v of votesRes.data ?? []) {
      const idx = v.option_idx as number;
      if (idx >= 0 && idx < tallied.length) tallied[idx]++;
    }

    const myVote = myVoteRes.data ? (myVoteRes.data.option_idx as number) : null;

    return { ...story, author, poll, poll_votes: tallied, my_vote: myVote };
  }

  return { ...story, author };
});

// -----------------------------------------------------------------------------
// "Is the current user following this profile?" — used by profile page CTA.
// -----------------------------------------------------------------------------

export const isFollowing = cache(async (targetUserId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === targetUserId) return false;

  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('following_id', targetUserId)
    .maybeSingle();

  return !!data;
});

// -----------------------------------------------------------------------------
// getPostInteractionState — liked + saved state für den eingeloggten User.
// Wird von /p/[postId] genutzt um Like- und Bookmark-Buttons korrekt
// vorzubelegen. Gibt { liked: false, saved: false } zurück wenn nicht authed.
// -----------------------------------------------------------------------------

export interface PostInteractionState {
  liked: boolean;
  saved: boolean;
}

export const getPostInteractionState = cache(
  async (postId: string): Promise<PostInteractionState> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { liked: false, saved: false };

    const [{ count: likeCount }, { count: saveCount }] = await Promise.all([
      supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('post_id', postId),
      supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('post_id', postId),
    ]);

    return { liked: (likeCount ?? 0) > 0, saved: (saveCount ?? 0) > 0 };
  },
);

// -----------------------------------------------------------------------------
// getProfileFollowers / getProfileFollowing — für /u/[username]/followers +
// /u/[username]/following. Beide liefern dasselbe Shape (id, username,
// display_name, avatar_url, verified) — damit dieselbe UserRow-Komponente
// in beiden Seiten genutzt werden kann.
//
// Pagination via `offset` — ausreichend für Listen bis ~500 (UI zeigt max 100).
// Für sehr große Follow-Listen wäre Keyset-Pagination über follows.created_at
// nötig, aber das ist ein v2-Topic.
// -----------------------------------------------------------------------------

export interface FollowUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

export const getProfileFollowers = cache(
  async (userId: string, limit = 50, offset = 0): Promise<FollowUser[]> => {
    const supabase = await createClient();

    // follows WHERE following_id = userId → follower_id-Liste
    const { data: follows } = await supabase
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const ids = (follows ?? []).map((f) => f.follower_id as string);
    if (ids.length === 0) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .in('id', ids);

    const byId = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          id: p.id as string,
          username: p.username as string,
          display_name: p.display_name as string | null,
          avatar_url: p.avatar_url as string | null,
          verified: (p.verified as boolean | null) ?? false,
        } satisfies FollowUser,
      ]),
    );

    return ids
      .map((id) => byId.get(id))
      .filter((u): u is FollowUser => u !== undefined);
  },
);

export const getProfileFollowing = cache(
  async (userId: string, limit = 50, offset = 0): Promise<FollowUser[]> => {
    const supabase = await createClient();

    // follows WHERE follower_id = userId → following_id-Liste
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const ids = (follows ?? []).map((f) => f.following_id as string);
    if (ids.length === 0) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .in('id', ids);

    const byId = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          id: p.id as string,
          username: p.username as string,
          display_name: p.display_name as string | null,
          avatar_url: p.avatar_url as string | null,
          verified: (p.verified as boolean | null) ?? false,
        } satisfies FollowUser,
      ]),
    );

    return ids
      .map((id) => byId.get(id))
      .filter((u): u is FollowUser => u !== undefined);
  },
);

// -----------------------------------------------------------------------------
// getViewerFollowingSet — Set<userId> denen der eingeloggte Viewer folgt.
// Wird von Follower/Following-Listen genutzt um FollowButton korrekt
// vorzubelegen. Gibt leeres Set zurück wenn nicht eingeloggt.
// Cap 500 — ausreichend für die initiale Listen-Ansicht.
// -----------------------------------------------------------------------------

export const getViewerFollowingSet = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .limit(500);

  return new Set((data ?? []).map((f) => f.following_id as string));
});

// -----------------------------------------------------------------------------
// getProfileReposts — v1.w.UI.164
//
// Liefert die Posts die ein User repostet hat (aus `reposts`-Tabelle),
// geordnet nach Repost-Datum DESC. Identisches Datenmuster wie auf Mobile
// (UserProfileContent.tsx: reposts Tab).
//
// Zwei-stufig:
//   1. reposts WHERE user_id = userId ORDER BY created_at DESC LIMIT limit
//   2. posts IN (post_ids) → gemappt auf Post[]
//
// Öffentlich lesbar (RLS: SELECT true auf reposts — jeder kann sehen was
// ein User geteilt hat, entspricht TikTok-Verhalten).
// -----------------------------------------------------------------------------

export const getProfileReposts = cache(async (userId: string, limit = 48): Promise<Post[]> => {
  const supabase = await createClient();

  const { data: repostRows } = await supabase
    .from('reposts')
    .select('post_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!repostRows || repostRows.length === 0) return [];

  const postIds = (repostRows as { post_id: string }[]).map((r) => r.post_id).filter(Boolean);
  if (postIds.length === 0) return [];

  const { data, error } = await supabase
    .from('posts')
    .select(
      `id, author_id, caption, media_url, thumbnail_url, view_count, share_count, tags, allow_comments, allow_duet, aspect_ratio, created_at,
       like_count:likes(count),
       comment_count:comments(count)`,
    )
    .in('id', postIds);

  if (error || !data) return [];

  // Preserve repost-date order (post created_at ≠ repost created_at).
  const byId = new Map((data as unknown as PostRowMobile[]).map((p) => [p.id, toPost(p)]));
  return postIds.map((id) => byId.get(id)).filter((p): p is Post => p !== undefined);
});

// -----------------------------------------------------------------------------
// getWOZFeed — Women-Only Zone Feed.
// v1.w.UI.167: Parity mit app/women-only/index.tsx.
// RLS-Policies auf `posts` schränken `women_only=true` automatisch auf
// verifizierte Nutzerinnen ein. `is_women_only_verified()` DB-Helper greift.
// Non-verified User erhalten leere Liste (RLS returns 0 rows).
// -----------------------------------------------------------------------------

export const getWOZFeed = cache(async (limit = 60): Promise<Post[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts')
    .select(
      `id, author_id, caption, media_url, thumbnail_url, view_count, share_count, tags, allow_comments, allow_duet, aspect_ratio, created_at,
       like_count:likes(count),
       comment_count:comments(count)`,
    )
    .eq('women_only', true)
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as PostRowMobile[]).map(toPost);
});

// -----------------------------------------------------------------------------
// getWOZFeedPage — non-cached, offset-based variant for infinite scroll.
// Used by GET /api/posts/woz for PostGrid pagination.
// RLS on `posts` restricts women_only=true rows to verified members.
// v1.w.UI.213
// -----------------------------------------------------------------------------

export async function getWOZFeedPage(
  offset: number,
  limit: number,
): Promise<Post[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts')
    .select(
      `id, author_id, caption, media_url, thumbnail_url, view_count, share_count, tags, allow_comments, allow_duet, aspect_ratio, created_at,
       like_count:likes(count),
       comment_count:comments(count)`,
    )
    .eq('women_only', true)
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];
  return (data as unknown as PostRowMobile[]).map(toPost);
}
