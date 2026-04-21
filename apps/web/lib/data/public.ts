import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { PublicProfile, Post, Story } from '@shared/types';

// -----------------------------------------------------------------------------
// Public profile by username — read-through cache per request.
// Returns `null` for 404 case; callers should branch to notFound().
//
// Schema-Adapter: Die produktive `profiles`-Tabelle (angelegt vom Mobile-App-
// Schema) hat KEINE denormalisierten Counter-Spalten (`follower_count`,
// `following_count`, `post_count`) und verwendet `is_verified` statt `verified`.
// Wir mappen das hier on-read in die PublicProfile-Shape:
//   1) Basis-Row: selektieren NUR existierende Spalten (sonst PostgREST-42703 → 404).
//   2) Counts: drei parallele `HEAD`-Queries mit `count: 'exact'` — bei indexed
//      FKs auf `follows(follower_id, followed_id)` und `posts(user_id)` billig
//      genug für Profile-Loads im aktuellen Volumen. Bei >10k Follower/Creator
//      kann später eine Migration mit denormalisierten Counters + Triggers
//      folgen, ohne diese Adapter-Stelle zu brechen.
// -----------------------------------------------------------------------------

export const getPublicProfile = cache(async (username: string): Promise<PublicProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, is_verified')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error || !data) return null;

  const [followerRes, followingRes, postsRes] = await Promise.all([
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('followed_id', data.id),
    supabase
      .from('follows')
      .select('followed_id', { count: 'exact', head: true })
      .eq('follower_id', data.id),
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', data.id),
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
  };
});

// -----------------------------------------------------------------------------
// Posts by a profile — latest first, paginated.
// -----------------------------------------------------------------------------

export const getProfilePosts = cache(
  async (userId: string, limit = 24, before?: string): Promise<Post[]> => {
    const supabase = await createClient();
    let query = supabase
      .from('posts')
      .select(
        'id, user_id, caption, video_url, thumbnail_url, duration_secs, view_count, like_count, comment_count, share_count, hashtags, music_id, allow_comments, allow_duet, allow_stitch, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error || !data) return [];
    return data as Post[];
  },
);

// -----------------------------------------------------------------------------
// Single post with author-profile joined.
// -----------------------------------------------------------------------------

export interface PostWithAuthor extends Post {
  author: Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'verified'>;
}

export const getPost = cache(async (postId: string): Promise<PostWithAuthor | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts')
    .select(
      `id, user_id, caption, video_url, thumbnail_url, duration_secs, view_count, like_count, comment_count, share_count, hashtags, music_id, allow_comments, allow_duet, allow_stitch, created_at,
       author:profiles!posts_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified)`,
    )
    .eq('id', postId)
    .maybeSingle();

  if (error || !data || !data.author) return null;
  // Supabase returns the joined row as object or array depending on relationship — normalize.
  const author = Array.isArray(data.author) ? data.author[0] : data.author;
  return { ...(data as unknown as Post), author } as PostWithAuthor;
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

export const getPostComments = cache(async (postId: string, limit = 30): Promise<CommentWithAuthor[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('comments')
    .select(
      `id, post_id, user_id, body, like_count, created_at,
       author:profiles!comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified)`,
    )
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => ({
    ...(row as unknown as CommentWithAuthor),
    author: Array.isArray(row.author) ? row.author[0] : row.author,
  })) as CommentWithAuthor[];
});

// -----------------------------------------------------------------------------
// Story with TTL check — returns null if expired.
// -----------------------------------------------------------------------------

export interface StoryWithAuthor extends Story {
  author: Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'verified'>;
}

export const getStory = cache(async (storyId: string): Promise<StoryWithAuthor | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stories')
    .select(
      `id, user_id, media_url, media_type, duration_secs, expires_at, view_count, created_at,
       author:profiles!stories_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified)`,
    )
    .eq('id', storyId)
    .maybeSingle();

  if (error || !data) return null;

  // 24h TTL guard — respect even if the DB hasn't purged yet.
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  const author = Array.isArray(data.author) ? data.author[0] : data.author;
  return { ...(data as unknown as Story), author } as StoryWithAuthor;
});

// -----------------------------------------------------------------------------
// "Is the current user following this profile?" — used by profile page CTA.
// Returns false when not logged-in (no auth cost).
// -----------------------------------------------------------------------------

export const isFollowing = cache(async (targetUserId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === targetUserId) return false;

  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('followed_id', targetUserId)
    .maybeSingle();

  return !!data;
});
