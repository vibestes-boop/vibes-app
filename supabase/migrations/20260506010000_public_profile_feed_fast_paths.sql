-- Public profile/feed fast paths for Serlo Web.
--
-- Production timing showed the first anonymous/profile pages spending most of
-- their time in several separate PostgREST reads. These RPCs keep public data
-- in one roundtrip while preserving RLS via SECURITY INVOKER.

CREATE INDEX IF NOT EXISTS idx_profiles_lower_username
  ON public.profiles (lower(username));

CREATE INDEX IF NOT EXISTS idx_follows_following_follower
  ON public.follows (following_id, follower_id);

CREATE INDEX IF NOT EXISTS idx_live_sessions_host_active_started
  ON public.live_sessions (host_id, started_at DESC, id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_products_active_public_popular
  ON public.products (sold_count DESC, created_at DESC, id)
  WHERE is_active = true AND women_only = false;

CREATE OR REPLACE FUNCTION public.get_public_profile_web(p_username text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  is_verified boolean,
  is_private boolean,
  website text,
  teip text,
  follower_count bigint,
  following_count bigint,
  post_count bigint,
  is_live boolean,
  live_session_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH profile AS (
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.bio,
      COALESCE(p.is_verified, false) AS is_verified,
      COALESCE(p.is_private, false) AS is_private,
      p.website,
      p.teip
    FROM public.profiles p
    WHERE lower(p.username) = lower(p_username)
    LIMIT 1
  )
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.is_verified,
    p.is_private,
    p.website,
    p.teip,
    (SELECT count(*) FROM public.follows f WHERE f.following_id = p.id)::bigint AS follower_count,
    (SELECT count(*) FROM public.follows f WHERE f.follower_id = p.id)::bigint AS following_count,
    (SELECT count(*) FROM public.posts po WHERE po.author_id = p.id)::bigint AS post_count,
    (live.id IS NOT NULL) AS is_live,
    live.id AS live_session_id
  FROM profile p
  LEFT JOIN LATERAL (
    SELECT ls.id
    FROM public.live_sessions ls
    WHERE ls.host_id = p.id
      AND ls.status = 'active'
    ORDER BY ls.started_at DESC
    LIMIT 1
  ) live ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_web(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_feed_web(
  result_limit integer DEFAULT 12,
  before_ts timestamptz DEFAULT NULL,
  exclude_post_ids uuid[] DEFAULT '{}'::uuid[]
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
    AND (before_ts IS NULL OR p.created_at < before_ts)
    AND (
      COALESCE(cardinality(exclude_post_ids), 0) = 0
      OR p.id <> ALL(exclude_post_ids)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 12), 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_public_feed_web(integer, timestamptz, uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_trending_hashtags(result_limit integer DEFAULT 20)
RETURNS TABLE(tag text, post_count bigint, total_views bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH recent_posts AS (
    SELECT p.tags, p.view_count
    FROM public.posts p
    WHERE p.privacy = 'public'
      AND p.created_at >= now() - interval '7 days'
      AND p.tags IS NOT NULL
    ORDER BY p.created_at DESC
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
