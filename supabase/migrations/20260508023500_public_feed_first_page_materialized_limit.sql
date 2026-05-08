-- Keep the anonymous first public feed page cheap under cache misses.
--
-- The previous fast path already removed cursor/exclude predicates, but the
-- planner can still consider the posts/profiles join while choosing the top
-- posts. This version materializes the small visible post slice first and only
-- then joins author profiles. The result contract stays identical.

CREATE OR REPLACE FUNCTION public.get_public_feed_web_anon_first_page(
  result_limit integer DEFAULT 12
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
  WITH visible_posts AS MATERIALIZED (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      p.thumbnail_url,
      p.view_count,
      p.like_count,
      p.comment_count,
      p.tags,
      p.allow_comments,
      p.allow_duet,
      p.allow_download,
      p.privacy,
      p.aspect_ratio,
      p.audio_url,
      p.audio_volume,
      p.created_at
    FROM public.posts p
    WHERE p.privacy = 'public'
      AND COALESCE(p.women_only, false) = false
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT greatest(1, least(COALESCE(result_limit, 12), 100))
  )
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
  FROM visible_posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  ORDER BY p.created_at DESC, p.id DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_feed_web_anon_first_page(integer) TO anon, authenticated;
