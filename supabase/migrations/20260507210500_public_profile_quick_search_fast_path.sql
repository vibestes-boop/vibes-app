-- Public profile quick-search fast path.
--
-- `/api/search/quick` only needs public profile suggestions for anonymous
-- autocomplete. This RPC keeps the contract explicit and avoids direct
-- profiles table reads in the hot search path.

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
    AND (
      p.username ILIKE '%' || i.q || '%'
      OR COALESCE(p.display_name, '') ILIKE '%' || i.q || '%'
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 5), 20));
$$;

GRANT EXECUTE ON FUNCTION public.search_public_profiles_web(text, integer) TO anon, authenticated;
