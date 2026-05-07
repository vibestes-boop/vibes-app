-- Public people discovery fast path for logged-out Explore reads.
--
-- The anonymous `/explore` page only needs a small newest-public-profiles list.
-- Keep the user-specific guild/interests logic in the authenticated code path,
-- and serve logged-out discovery from one explicit public RPC.

CREATE INDEX IF NOT EXISTS idx_profiles_public_discover_created_at_id
  ON public.profiles (created_at DESC, id DESC)
  WHERE username IS NOT NULL
    AND COALESCE(is_private, false) = false;

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
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 12), 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_public_discover_people_web(integer) TO anon, authenticated;
