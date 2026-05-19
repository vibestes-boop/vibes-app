-- Product Recovery: actionable creator-activation snapshot for North Star = 0.
--
-- This is admin/operator-only because it returns creator/usernames for an
-- operational activation review. It does not expose email, tokens, or private
-- profile fields.

CREATE OR REPLACE FUNCTION public.creator_activation_recovery_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin() OR public.can_operate() OR public.can_creator_ops()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH posts_30d AS (
    SELECT id, author_id, created_at
    FROM public.posts
    WHERE created_at >= NOW() - INTERVAL '30 days'
      AND COALESCE(privacy, 'public') <> 'private'
  ),
  posts_7d AS (
    SELECT id, author_id, created_at
    FROM public.posts
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND COALESCE(privacy, 'public') <> 'private'
  ),
  engagement_30d AS (
    SELECT
      p.id AS post_id,
      p.author_id,
      (
        SELECT COUNT(*)
        FROM public.likes l
        WHERE l.post_id = p.id
          AND l.created_at >= p.created_at
      ) AS likes,
      (
        SELECT COUNT(*)
        FROM public.comments c
        WHERE c.post_id = p.id
          AND c.created_at >= p.created_at
      ) AS comments,
      (
        SELECT COUNT(*)
        FROM public.bookmarks b
        WHERE b.post_id = p.id
          AND b.created_at >= p.created_at
      ) AS bookmarks,
      (
        SELECT COUNT(*)
        FROM public.post_views_log v
        WHERE v.post_id = p.id
          AND v.viewed_at >= p.created_at
      ) AS views,
      (
        SELECT COUNT(*)
        FROM public.follows f
        WHERE f.following_id = p.author_id
          AND f.created_at >= p.created_at
      ) AS follows
    FROM posts_30d p
  ),
  creator_rollup AS (
    SELECT
      p.author_id,
      COUNT(*) AS posts_30d,
      MAX(p.created_at) AS latest_post_at,
      COALESCE(SUM(e.likes), 0) AS likes,
      COALESCE(SUM(e.comments), 0) AS comments,
      COALESCE(SUM(e.bookmarks), 0) AS bookmarks,
      COALESCE(SUM(e.views), 0) AS views,
      COALESCE(SUM(e.follows), 0) AS follows
    FROM posts_30d p
    LEFT JOIN engagement_30d e ON e.post_id = p.id
    GROUP BY p.author_id
  ),
  summary AS (
    SELECT jsonb_build_object(
      'new_users_30d', (
        SELECT COUNT(*)
        FROM public.profiles
        WHERE created_at >= NOW() - INTERVAL '30 days'
      ),
      'users_without_first_post_30d', (
        SELECT COUNT(*)
        FROM public.profiles pr
        WHERE pr.created_at >= NOW() - INTERVAL '30 days'
          AND NOT EXISTS (
            SELECT 1 FROM public.posts po WHERE po.author_id = pr.id
          )
      ),
      'posts_7d', (SELECT COUNT(*) FROM posts_7d),
      'posts_30d', (SELECT COUNT(*) FROM posts_30d),
      'active_creators_7d', (SELECT COUNT(DISTINCT author_id) FROM posts_7d),
      'creators_with_posts_30d', (SELECT COUNT(*) FROM creator_rollup),
      'creators_with_zero_engagement_30d', (
        SELECT COUNT(*)
        FROM creator_rollup
        WHERE likes + comments + bookmarks + follows = 0
      ),
      'posts_with_meaningful_engagement_30d', (
        SELECT COUNT(*)
        FROM engagement_30d
        WHERE likes + comments + bookmarks + follows > 0
      ),
      'views_30d', (SELECT COALESCE(SUM(views), 0) FROM engagement_30d),
      'meaningful_engagement_30d', (
        SELECT COALESCE(SUM(likes + comments + bookmarks + follows), 0)
        FROM engagement_30d
      )
    ) AS data
  ),
  need_first_post AS (
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) AS data
    FROM (
      SELECT jsonb_build_object(
        'user_id', LEFT(pr.id::TEXT, 8),
        'username', pr.username,
        'display_name', pr.display_name,
        'created_at', pr.created_at,
        'days_since_signup', FLOOR(EXTRACT(EPOCH FROM (NOW() - pr.created_at)) / 86400)
      ) AS row_data
      FROM public.profiles pr
      WHERE pr.created_at >= NOW() - INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM public.posts po WHERE po.author_id = pr.id
        )
      ORDER BY pr.created_at DESC
      LIMIT 12
    ) rows
  ),
  need_engagement AS (
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) AS data
    FROM (
      SELECT jsonb_build_object(
        'user_id', LEFT(cr.author_id::TEXT, 8),
        'username', pr.username,
        'display_name', pr.display_name,
        'posts_30d', cr.posts_30d,
        'latest_post_at', cr.latest_post_at,
        'views', cr.views,
        'likes', cr.likes,
        'comments', cr.comments,
        'bookmarks', cr.bookmarks,
        'follows', cr.follows
      ) AS row_data
      FROM creator_rollup cr
      JOIN public.profiles pr ON pr.id = cr.author_id
      WHERE cr.likes + cr.comments + cr.bookmarks + cr.follows = 0
      ORDER BY cr.latest_post_at DESC
      LIMIT 12
    ) rows
  )
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'summary', summary.data,
    'need_first_post', need_first_post.data,
    'need_engagement', need_engagement.data,
    'next_actions', jsonb_build_array(
      'Guide new users without first post to create one public post',
      'Review creators with posts but no meaningful engagement',
      'Seed engagement loops through comments, follows, saves, or creator prompts',
      'Pause non-activation features while weekly active creators stays at 0'
    )
  )
  INTO v_snapshot
  FROM summary, need_first_post, need_engagement;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.creator_activation_recovery_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.creator_activation_recovery_snapshot() TO authenticated, service_role;
