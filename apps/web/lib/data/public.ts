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
//     duration_secs / music_id / allow_stitch / share_count
//                           → existieren nicht → null/0/true-Defaults
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
    .select('id, username, display_name, avatar_url, bio, is_verified')
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
  created_at: string;
  like_count?: unknown; // embedded aggregate
  comment_count?: unknown; // embedded aggregate
};

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
    share_count: 0,
    hashtags: row.tags ?? [],
    music_id: null,
    allow_comments: row.allow_comments ?? true,
    allow_duet: row.allow_duet ?? true,
    allow_stitch: true,
    created_at: row.created_at,
  };
}

// -----------------------------------------------------------------------------
// Posts by a profile — latest first, paginated.
// -----------------------------------------------------------------------------

export const getProfilePosts = cache(
  async (userId: string, limit = 24, before?: string): Promise<Post[]> => {
    const supabase = await createClient();
    let query = supabase
      .from('posts')
      .select(
        `id, author_id, caption, media_url, thumbnail_url, view_count, tags, allow_comments, allow_duet, created_at,
         like_count:likes(count),
         comment_count:comments(count)`,
      )
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as unknown as PostRowMobile[]).map(toPost);
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
}

export const getPost = cache(async (postId: string): Promise<PostWithAuthor | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts')
    .select(
      `id, author_id, caption, media_url, media_type, thumbnail_url, view_count, tags, allow_comments, allow_duet, created_at,
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
  return { ...post, author, media_type };
});

// -----------------------------------------------------------------------------
// Read-only comments for a post — latest-first, capped for public render.
// -----------------------------------------------------------------------------

export interface CommentWithAuthor {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  like_count: number;
  created_at: string;
  author: Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'verified'>;
}

type CommentRowMobile = {
  id: string;
  post_id: string;
  user_id: string;
  text: string | null;
  created_at: string;
  author: AuthorRow | AuthorRow[] | null;
};

export const getPostComments = cache(async (postId: string, limit = 30): Promise<CommentWithAuthor[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('comments')
    .select(
      `id, post_id, user_id, text, created_at,
       author:profiles!comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  const out: CommentWithAuthor[] = [];
  for (const row of data as unknown as CommentRowMobile[]) {
    const author = normalizeAuthor(row.author);
    if (!author) continue;
    out.push({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      body: row.text ?? '',
      like_count: 0, // Mobile-Schema denormalisiert Comment-Likes nicht; Web zeigt 0.
      created_at: row.created_at,
      author,
    });
  }
  return out;
});

// -----------------------------------------------------------------------------
// Story with TTL check — returns null if expired (Mobile hat kein expires_at).
// -----------------------------------------------------------------------------

export interface StoryWithAuthor extends Story {
  author: Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'verified'>;
}

type StoryRowMobile = {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  created_at: string;
  author: AuthorRow | AuthorRow[] | null;
};

export const getStory = cache(async (storyId: string): Promise<StoryWithAuthor | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stories')
    .select(
      `id, user_id, media_url, media_type, created_at,
       author:profiles!stories_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
    )
    .eq('id', storyId)
    .maybeSingle();

  if (error || !data) return null;

  // 24h TTL — Mobile-Schema hat kein explizites expires_at, wir rechnen es.
  const row = data as unknown as StoryRowMobile;
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
