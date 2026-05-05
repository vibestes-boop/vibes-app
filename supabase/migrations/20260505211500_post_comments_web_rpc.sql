-- One roundtrip comment list for the web feed comment panel/sheet.
-- Keeps comment opening fast by aggregating author data, like counts, viewer
-- like state, and reply counts in Postgres instead of issuing several browser
-- Supabase requests.

CREATE OR REPLACE FUNCTION public.get_post_comments_web(
  p_post_id uuid,
  p_limit integer DEFAULT 30,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  post_id uuid,
  user_id uuid,
  parent_id uuid,
  body text,
  like_count bigint,
  liked_by_me boolean,
  reply_count bigint,
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
  WITH base AS (
    SELECT
      c.id,
      c.post_id,
      c.user_id,
      c.parent_id,
      c.text AS body,
      c.created_at
    FROM public.comments c
    WHERE c.post_id = p_post_id
      AND c.parent_id IS NULL
    ORDER BY c.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100)
  ),
  like_counts AS (
    SELECT cl.comment_id, COUNT(*)::bigint AS like_count
    FROM public.comment_likes cl
    JOIN base b ON b.id = cl.comment_id
    GROUP BY cl.comment_id
  ),
  viewer_likes AS (
    SELECT cl.comment_id
    FROM public.comment_likes cl
    JOIN base b ON b.id = cl.comment_id
    WHERE p_viewer_id IS NOT NULL
      AND cl.user_id = p_viewer_id
  ),
  reply_counts AS (
    SELECT r.parent_id AS comment_id, COUNT(*)::bigint AS reply_count
    FROM public.comments r
    JOIN base b ON b.id = r.parent_id
    GROUP BY r.parent_id
  )
  SELECT
    b.id,
    b.post_id,
    b.user_id,
    b.parent_id,
    COALESCE(b.body, '') AS body,
    COALESCE(lc.like_count, 0) AS like_count,
    (vl.comment_id IS NOT NULL) AS liked_by_me,
    COALESCE(rc.reply_count, 0) AS reply_count,
    b.created_at,
    p.id AS author_id,
    p.username AS author_username,
    p.display_name AS author_display_name,
    p.avatar_url AS author_avatar_url,
    COALESCE(p.is_verified, false) AS author_verified
  FROM base b
  JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN like_counts lc ON lc.comment_id = b.id
  LEFT JOIN viewer_likes vl ON vl.comment_id = b.id
  LEFT JOIN reply_counts rc ON rc.comment_id = b.id
  ORDER BY b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_comments_web(uuid, integer, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_post_comments_web(uuid, integer, uuid) TO authenticated;
