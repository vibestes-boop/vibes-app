-- Anonymous discovery fast paths for Serlo Web.
--
-- These RPCs back public /explore and search sidebar reads. They intentionally
-- return only public, non-women-only content, so logged-out cache misses do not
-- pay per-row RLS checks while still preserving the public visibility contract.

CREATE INDEX IF NOT EXISTS idx_posts_public_visible_recent_tags
  ON public.posts (created_at DESC, id DESC)
  WHERE privacy = 'public'
    AND COALESCE(women_only, false) = false
    AND tags IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_public_visible_trending
  ON public.posts (view_count DESC, created_at DESC, id DESC)
  WHERE privacy = 'public'
    AND COALESCE(women_only, false) = false;

CREATE OR REPLACE FUNCTION public.get_trending_hashtags(result_limit integer DEFAULT 20)
RETURNS TABLE(tag text, post_count bigint, total_views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent_posts AS (
    SELECT p.tags, p.view_count
    FROM public.posts p
    WHERE p.privacy = 'public'
      AND COALESCE(p.women_only, false) = false
      AND p.created_at >= now() - interval '7 days'
      AND p.tags IS NOT NULL
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 500
  ),
  normalized AS (
    SELECT
      lower(regexp_replace(trim(both from raw_tag), '^#', '')) AS tag,
      COALESCE(rp.view_count, 0)::bigint AS views
    FROM recent_posts rp
    CROSS JOIN LATERAL unnest(COALESCE(rp.tags, ARRAY[]::text[])) AS tags(raw_tag)
  )
  SELECT
    normalized.tag,
    count(*)::bigint AS post_count,
    COALESCE(sum(normalized.views), 0)::bigint AS total_views
  FROM normalized
  WHERE normalized.tag <> ''
  GROUP BY normalized.tag
  ORDER BY total_views DESC, post_count DESC, normalized.tag ASC
  LIMIT greatest(1, least(COALESCE(result_limit, 20), 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_hashtags(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_explore_feed_web(
  result_limit integer DEFAULT 12,
  result_offset integer DEFAULT 0,
  sort_key text DEFAULT 'newest'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  caption text,
  video_url text,
  media_type text,
  thumbnail_url text,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  hashtags text[],
  allow_comments boolean,
  allow_duet boolean,
  allow_download boolean,
  women_only boolean,
  privacy text,
  aspect_ratio text,
  audio_url text,
  audio_volume double precision,
  created_at timestamptz,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  author_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.author_id AS user_id,
    p.caption,
    COALESCE(p.media_url, '') AS video_url,
    p.media_type,
    p.thumbnail_url,
    COALESCE(p.view_count, 0)::bigint AS view_count,
    COALESCE(p.like_count, 0)::bigint AS like_count,
    COALESCE(p.comment_count, 0)::bigint AS comment_count,
    COALESCE(p.tags, ARRAY[]::text[]) AS hashtags,
    COALESCE(p.allow_comments, true) AS allow_comments,
    COALESCE(p.allow_duet, true) AS allow_duet,
    COALESCE(p.allow_download, true) AS allow_download,
    false AS women_only,
    COALESCE(p.privacy, 'public') AS privacy,
    COALESCE(p.aspect_ratio, 'portrait') AS aspect_ratio,
    p.audio_url,
    p.audio_volume::double precision AS audio_volume,
    p.created_at,
    pr.id AS author_id,
    pr.username AS author_username,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    COALESCE(pr.is_verified, false) AS author_verified
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.privacy = 'public'
    AND COALESCE(p.women_only, false) = false
  ORDER BY
    CASE
      WHEN lower(COALESCE(sort_key, 'newest')) = 'trending'
      THEN COALESCE(p.view_count, 0)
    END DESC NULLS LAST,
    p.created_at DESC,
    p.id DESC
  OFFSET greatest(0, COALESCE(result_offset, 0))
  LIMIT greatest(1, least(COALESCE(result_limit, 12), 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_public_explore_feed_web(integer, integer, text) TO anon, authenticated;
