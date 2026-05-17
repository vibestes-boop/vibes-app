-- Hide banned and shadowbanned profiles from public profile discovery.
--
-- Feed/detail RPCs already filter moderated authors. This closes the adjacent
-- public surfaces: profile pages, people discovery, and quick profile search.

CREATE INDEX IF NOT EXISTS idx_profiles_public_discover_visible_created_at_id
  ON public.profiles (created_at DESC, id DESC)
  WHERE username IS NOT NULL
    AND COALESCE(is_private, false) = false
    AND COALESCE(is_banned, false) = false
    AND COALESCE(is_shadow_banned, false) = false;

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
      AND COALESCE(p.is_banned, false) = false
      AND COALESCE(p.is_shadow_banned, false) = false
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

CREATE OR REPLACE FUNCTION public.search_public_profiles_web(
  search_query text,
  result_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH input AS (
    SELECT NULLIF(regexp_replace(trim(COALESCE(search_query, '')), '[%_]', '', 'g'), '') AS q
  )
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_verified, false) AS verified
  FROM public.profiles p
  CROSS JOIN input i
  WHERE i.q IS NOT NULL
    AND length(i.q) >= 2
    AND p.username IS NOT NULL
    AND COALESCE(p.is_private, false) = false
    AND COALESCE(p.is_banned, false) = false
    AND COALESCE(p.is_shadow_banned, false) = false
    AND (
      p.username ILIKE '%' || i.q || '%'
      OR COALESCE(p.display_name, '') ILIKE '%' || i.q || '%'
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 5), 20));
$$;

GRANT EXECUTE ON FUNCTION public.search_public_profiles_web(text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_discover_people_web(
  result_limit integer DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  verified boolean,
  reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_verified, false) AS verified,
    'new'::text AS reason
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND COALESCE(p.is_private, false) = false
    AND COALESCE(p.is_banned, false) = false
    AND COALESCE(p.is_shadow_banned, false) = false
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 12), 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_public_discover_people_web(integer) TO anon, authenticated;
