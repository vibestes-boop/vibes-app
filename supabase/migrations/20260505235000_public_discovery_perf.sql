-- Public discovery/feed performance helpers.
--
-- These keep the public explore/sidebar paths cheap:
--   - hashtag pages/searches can use a GIN index on posts.tags
--   - newest-profile suggestions can use a created_at index
--   - trending hashtag aggregation stays bounded to recent public posts

CREATE INDEX IF NOT EXISTS idx_posts_public_tags_gin
  ON public.posts USING gin (tags)
  WHERE privacy = 'public';

CREATE INDEX IF NOT EXISTS idx_profiles_created_at_id
  ON public.profiles (created_at DESC, id DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'follower_count'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_follower_count_id ON public.profiles (follower_count DESC NULLS LAST, id DESC)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_trending_hashtags(result_limit integer DEFAULT 20)
RETURNS TABLE(tag text, post_count bigint, total_views bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      lower(regexp_replace(trim(both from raw_tag), '^#', '')) AS tag,
      COALESCE(p.view_count, 0)::bigint AS views
    FROM public.posts p
    CROSS JOIN LATERAL unnest(COALESCE(p.tags, ARRAY[]::text[])) AS tags(raw_tag)
    WHERE p.privacy = 'public'
      AND p.created_at >= now() - interval '7 days'
      AND p.tags IS NOT NULL
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
