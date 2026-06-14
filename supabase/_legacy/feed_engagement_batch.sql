-- Batch-Aggregate für Feed-Performance (einmal in Supabase SQL ausführen)
-- Liefert Like- und Kommentar-Anzahlen pro Post ohne N einzelne Queries.

CREATE OR REPLACE FUNCTION public.get_post_like_counts(p_post_ids uuid[])
RETURNS TABLE (post_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT l.post_id, COUNT(*)::bigint
  FROM public.likes l
  WHERE l.post_id = ANY(p_post_ids)
  GROUP BY l.post_id;
$$;

CREATE OR REPLACE FUNCTION public.get_post_comment_counts(p_post_ids uuid[])
RETURNS TABLE (post_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.post_id, COUNT(*)::bigint
  FROM public.comments c
  WHERE c.post_id = ANY(p_post_ids)
  GROUP BY c.post_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_like_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_comment_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_like_counts(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_post_comment_counts(uuid[]) TO anon;
