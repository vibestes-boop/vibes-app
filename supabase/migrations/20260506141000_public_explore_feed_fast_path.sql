-- Public explore feed fast path for Serlo Web.
--
-- The API contract checks exercise /api/feed/explore with forYou, trending,
-- newest and pagination. forYou already uses get_public_feed_web; trending and
-- newest still paid a PostgREST join on posts+profiles. This RPC returns the
-- same card shape in one indexed query.

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
SECURITY INVOKER
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
    COALESCE(p.women_only, false) AS women_only,
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
