-- Public profile RPC hardening.
--
-- Production timing after the web cache deploy still showed cold profile reads
-- spending 1-3s inside get_public_profile_web, and occasional fallback paths
-- were even slower. This RPC only returns public profile metadata and aggregate
-- public counts, so it can run as SECURITY DEFINER while keeping a locked
-- search_path and explicit public visibility filters on posts/live sessions.

CREATE INDEX IF NOT EXISTS idx_posts_author_public_profile_count
  ON public.posts (author_id)
  WHERE privacy = 'public' AND women_only = false;

CREATE INDEX IF NOT EXISTS idx_live_sessions_host_public_active_started
  ON public.live_sessions (host_id, started_at DESC, id)
  WHERE status = 'active' AND women_only = false;

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
SECURITY DEFINER
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
    (
      SELECT count(*)
      FROM public.posts po
      WHERE po.author_id = p.id
        AND COALESCE(po.privacy, 'public') = 'public'
        AND COALESCE(po.women_only, false) = false
    )::bigint AS post_count,
    (live.id IS NOT NULL) AS is_live,
    live.id AS live_session_id
  FROM profile p
  LEFT JOIN LATERAL (
    SELECT ls.id
    FROM public.live_sessions ls
    WHERE ls.host_id = p.id
      AND ls.status = 'active'
      AND COALESCE(ls.women_only, false) = false
    ORDER BY ls.started_at DESC
    LIMIT 1
  ) live ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_web(text) TO anon, authenticated;
