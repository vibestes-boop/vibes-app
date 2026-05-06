-- Profile post-grid fast path for Serlo Web.
--
-- Production timing showed /u/[username] still paying for PostgREST embedded
-- aggregates (`likes(count)`, `comments(count)`) after the profile-header RPC
-- landed. The posts table already carries denormalized counters, so this RPC
-- serves the profile grid in one indexed read and lets RLS decide visibility.

CREATE INDEX IF NOT EXISTS idx_posts_author_profile_newest
  ON public.posts (
    author_id,
    (COALESCE(is_pinned, false)) DESC,
    created_at DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS idx_posts_author_profile_views
  ON public.posts (
    author_id,
    (COALESCE(is_pinned, false)) DESC,
    (COALESCE(view_count, 0)) DESC,
    created_at DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS idx_posts_author_profile_likes
  ON public.posts (
    author_id,
    (COALESCE(is_pinned, false)) DESC,
    (COALESCE(like_count, 0)) DESC,
    created_at DESC,
    id DESC
  );

CREATE OR REPLACE FUNCTION public.get_profile_posts_web(
  p_user_id uuid,
  result_limit integer DEFAULT 24,
  result_offset integer DEFAULT 0,
  before_ts timestamptz DEFAULT NULL,
  sort_key text DEFAULT 'newest'
)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  caption text,
  media_url text,
  media_type text,
  thumbnail_url text,
  view_count bigint,
  tags text[],
  allow_comments boolean,
  allow_duet boolean,
  women_only boolean,
  is_pinned boolean,
  aspect_ratio text,
  created_at timestamptz,
  like_count bigint,
  comment_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.author_id,
    p.caption,
    COALESCE(p.media_url, '') AS media_url,
    p.media_type,
    p.thumbnail_url,
    COALESCE(p.view_count, 0)::bigint AS view_count,
    COALESCE(p.tags, ARRAY[]::text[]) AS tags,
    COALESCE(p.allow_comments, true) AS allow_comments,
    COALESCE(p.allow_duet, true) AS allow_duet,
    COALESCE(p.women_only, false) AS women_only,
    COALESCE(p.is_pinned, false) AS is_pinned,
    COALESCE(p.aspect_ratio, 'portrait') AS aspect_ratio,
    p.created_at,
    COALESCE(p.like_count, 0)::bigint AS like_count,
    COALESCE(p.comment_count, 0)::bigint AS comment_count
  FROM public.posts p
  WHERE p.author_id = p_user_id
    AND (
      before_ts IS NULL
      OR lower(COALESCE(sort_key, 'newest')) <> 'newest'
      OR p.created_at < before_ts
    )
  ORDER BY
    COALESCE(p.is_pinned, false) DESC,
    CASE
      WHEN lower(COALESCE(sort_key, 'newest')) = 'views'
      THEN COALESCE(p.view_count, 0)
    END DESC NULLS LAST,
    CASE
      WHEN lower(COALESCE(sort_key, 'newest')) = 'likes'
      THEN COALESCE(p.like_count, 0)
    END DESC NULLS LAST,
    p.created_at DESC,
    p.id DESC
  OFFSET greatest(0, COALESCE(result_offset, 0))
  LIMIT greatest(1, least(COALESCE(result_limit, 24), 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_posts_web(uuid, integer, integer, timestamptz, text) TO anon, authenticated;
