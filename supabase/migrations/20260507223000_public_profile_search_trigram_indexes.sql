-- Faster public profile autocomplete as the profiles table grows.
-- `/api/search/quick` uses case-insensitive substring matching, so btree
-- indexes cannot help. pg_trgm keeps the RPC fast without exposing private
-- profiles because the indexes match the same public predicate as the RPC.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_public_username_trgm
ON public.profiles
USING gin (lower(username) gin_trgm_ops)
WHERE username IS NOT NULL
  AND COALESCE(is_private, false) = false;

CREATE INDEX IF NOT EXISTS idx_profiles_public_display_name_trgm
ON public.profiles
USING gin (lower(display_name) gin_trgm_ops)
WHERE display_name IS NOT NULL
  AND COALESCE(is_private, false) = false;

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_query text := lower(regexp_replace(trim(search_query), '[%_]', '', 'g'));
  like_query text;
BEGIN
  IF length(clean_query) < 2 THEN
    RETURN;
  END IF;

  like_query := '%' || clean_query || '%';

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_verified, false) AS verified
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND COALESCE(p.is_private, false) = false
    AND (
      lower(p.username) LIKE like_query
      OR lower(COALESCE(p.display_name, '')) LIKE like_query
    )
  ORDER BY
    CASE
      WHEN lower(p.username) = clean_query THEN 0
      WHEN lower(p.username) LIKE clean_query || '%' THEN 1
      WHEN lower(COALESCE(p.display_name, '')) LIKE clean_query || '%' THEN 2
      ELSE 3
    END,
    p.created_at DESC,
    p.id DESC
  LIMIT LEAST(GREATEST(result_limit, 1), 20);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_public_profiles_web(text, integer) TO anon, authenticated;
