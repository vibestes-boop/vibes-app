-- Fast public post detail RPC.
--
-- After stricter posts RLS, direct /p/[postId] reads can spend seconds in the
-- table select. This RPC serves only public, non-women-only post detail rows and
-- uses denormalized counters, so public pages avoid embedded aggregate + RLS
-- overhead. Authenticated owner/private access still falls back to RLS reads in
-- the app if this RPC returns no row.

CREATE OR REPLACE FUNCTION public.get_public_post_web(p_post_id uuid)
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
  allow_download boolean,
  privacy text,
  women_only boolean,
  aspect_ratio text,
  audio_url text,
  audio_volume double precision,
  created_at timestamptz,
  like_count bigint,
  comment_count bigint,
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
    p.author_id,
    p.caption,
    COALESCE(p.media_url, '') AS media_url,
    p.media_type,
    p.thumbnail_url,
    COALESCE(p.view_count, 0)::bigint AS view_count,
    COALESCE(p.tags, ARRAY[]::text[]) AS tags,
    COALESCE(p.allow_comments, true) AS allow_comments,
    COALESCE(p.allow_duet, true) AS allow_duet,
    COALESCE(p.allow_download, true) AS allow_download,
    COALESCE(p.privacy, 'public') AS privacy,
    COALESCE(p.women_only, false) AS women_only,
    COALESCE(p.aspect_ratio, 'portrait') AS aspect_ratio,
    p.audio_url,
    p.audio_volume,
    p.created_at,
    COALESCE(p.like_count, 0)::bigint AS like_count,
    COALESCE(p.comment_count, 0)::bigint AS comment_count,
    pr.username AS author_username,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    COALESCE(pr.is_verified, false) AS author_verified
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.id = p_post_id
    AND COALESCE(p.privacy, 'public') = 'public'
    AND COALESCE(p.women_only, false) = false
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_post_web(uuid) TO anon, authenticated;
