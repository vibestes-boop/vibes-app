-- Product health snapshot for weekly product reviews.
-- Aggregates only; intended for CI/reporting, not per-user analytics.

CREATE OR REPLACE FUNCTION public.product_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  WITH events AS (
    SELECT author_id AS user_id, created_at, 'post'::TEXT AS event_type FROM public.posts
    UNION ALL SELECT user_id, created_at, 'like' FROM public.likes
    UNION ALL SELECT user_id, created_at, 'comment' FROM public.comments
    UNION ALL SELECT user_id, created_at, 'bookmark' FROM public.bookmarks
    UNION ALL SELECT follower_id AS user_id, created_at, 'follow' FROM public.follows
    UNION ALL SELECT user_id, viewed_at AS created_at, 'view' FROM public.post_views_log
  ),
  posts_7d AS (
    SELECT id, author_id, created_at
    FROM public.posts
    WHERE created_at >= NOW() - INTERVAL '7 days'
  ),
  meaningful_engagement_7d AS (
    SELECT p.author_id AS creator_id, p.id AS post_id
    FROM posts_7d p
    WHERE EXISTS (
      SELECT 1 FROM public.likes l
      WHERE l.post_id = p.id AND l.created_at >= p.created_at
    )
    OR EXISTS (
      SELECT 1 FROM public.comments c
      WHERE c.post_id = p.id AND c.created_at >= p.created_at
    )
    OR EXISTS (
      SELECT 1 FROM public.bookmarks b
      WHERE b.post_id = p.id AND b.created_at >= p.created_at
    )
    OR EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.following_id = p.author_id AND f.created_at >= p.created_at
    )
  ),
  active AS (
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS wau,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS mau
    FROM events
  ),
  signup_cohorts AS (
    SELECT
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '7 days'
      ) AS new_users_7d,
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '30 days'
      ) AS new_users_30d,
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '8 days'
          AND created_at < NOW() - INTERVAL '1 day'
      ) AS d1_cohort,
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days'
      ) AS d7_cohort
    FROM public.profiles
  ),
  retention AS (
    SELECT
      COUNT(DISTINCT p.id) FILTER (
        WHERE p.created_at >= NOW() - INTERVAL '8 days'
          AND p.created_at < NOW() - INTERVAL '1 day'
          AND EXISTS (
            SELECT 1 FROM events e
            WHERE e.user_id = p.id
              AND e.created_at >= p.created_at + INTERVAL '1 day'
              AND e.created_at < p.created_at + INTERVAL '2 days'
          )
      ) AS d1_retained,
      COUNT(DISTINCT p.id) FILTER (
        WHERE p.created_at >= NOW() - INTERVAL '14 days'
          AND p.created_at < NOW() - INTERVAL '7 days'
          AND EXISTS (
            SELECT 1 FROM events e
            WHERE e.user_id = p.id
              AND e.created_at >= p.created_at + INTERVAL '7 days'
              AND e.created_at < p.created_at + INTERVAL '8 days'
          )
      ) AS d7_retained
    FROM public.profiles p
  ),
  activity_7d AS (
    SELECT
      (SELECT COUNT(*) FROM posts_7d) AS posts,
      COUNT(*) FILTER (WHERE event_type = 'like' AND created_at >= NOW() - INTERVAL '7 days') AS likes,
      COUNT(*) FILTER (WHERE event_type = 'comment' AND created_at >= NOW() - INTERVAL '7 days') AS comments,
      COUNT(*) FILTER (WHERE event_type = 'bookmark' AND created_at >= NOW() - INTERVAL '7 days') AS bookmarks,
      COUNT(*) FILTER (WHERE event_type = 'follow' AND created_at >= NOW() - INTERVAL '7 days') AS follows,
      COUNT(*) FILTER (WHERE event_type = 'view' AND created_at >= NOW() - INTERVAL '7 days') AS views,
      0 AS dwell_events
    FROM events
  ),
  creator_activation AS (
    SELECT
      COUNT(DISTINCT author_id) AS active_creators_7d,
      COUNT(DISTINCT author_id) FILTER (
        WHERE id IN (SELECT post_id FROM meaningful_engagement_7d)
      ) AS activated_creators_7d,
      COUNT(*) FILTER (
        WHERE id IN (SELECT post_id FROM meaningful_engagement_7d)
      ) AS posts_with_meaningful_engagement_7d
    FROM posts_7d
  ),
  first_post AS (
    SELECT
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (first_post_at - created_at))
      ) AS median_seconds
    FROM (
      SELECT p.id, p.created_at, MIN(po.created_at) AS first_post_at
      FROM public.profiles p
      JOIN public.posts po ON po.author_id = p.id
      GROUP BY p.id, p.created_at
    ) x
    WHERE first_post_at >= created_at
  ),
  first_meaningful_interaction AS (
    SELECT
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (first_interaction_at - created_at))
      ) AS median_seconds
    FROM (
      SELECT p.id, p.created_at, MIN(e.created_at) AS first_interaction_at
      FROM public.profiles p
      JOIN events e ON e.user_id = p.id AND e.event_type IN ('like', 'comment', 'bookmark', 'follow')
      GROUP BY p.id, p.created_at
    ) x
    WHERE first_interaction_at >= created_at
  )
  SELECT JSONB_BUILD_OBJECT(
    'generated_at', NOW(),
    'north_star', JSONB_BUILD_OBJECT(
      'name', 'weekly_active_creators_with_meaningful_engagement',
      'value', COALESCE(ca.activated_creators_7d, 0),
      'active_creators_7d', COALESCE(ca.active_creators_7d, 0),
      'posts_with_meaningful_engagement_7d', COALESCE(ca.posts_with_meaningful_engagement_7d, 0),
      'activation_rate',
        CASE WHEN COALESCE(ca.active_creators_7d, 0) = 0 THEN 0
        ELSE ROUND((ca.activated_creators_7d::NUMERIC / ca.active_creators_7d::NUMERIC), 4)
        END
    ),
    'audience', JSONB_BUILD_OBJECT(
      'wau', COALESCE(a.wau, 0),
      'mau', COALESCE(a.mau, 0),
      'wau_mau',
        CASE WHEN COALESCE(a.mau, 0) = 0 THEN 0
        ELSE ROUND((a.wau::NUMERIC / a.mau::NUMERIC), 4)
        END,
      'new_users_7d', COALESCE(sc.new_users_7d, 0),
      'new_users_30d', COALESCE(sc.new_users_30d, 0)
    ),
    'retention', JSONB_BUILD_OBJECT(
      'd1_cohort', COALESCE(sc.d1_cohort, 0),
      'd1_retained', COALESCE(r.d1_retained, 0),
      'd1_rate',
        CASE WHEN COALESCE(sc.d1_cohort, 0) = 0 THEN NULL
        ELSE ROUND((r.d1_retained::NUMERIC / sc.d1_cohort::NUMERIC), 4)
        END,
      'd7_cohort', COALESCE(sc.d7_cohort, 0),
      'd7_retained', COALESCE(r.d7_retained, 0),
      'd7_rate',
        CASE WHEN COALESCE(sc.d7_cohort, 0) = 0 THEN NULL
        ELSE ROUND((r.d7_retained::NUMERIC / sc.d7_cohort::NUMERIC), 4)
        END
    ),
    'engagement_7d', JSONB_BUILD_OBJECT(
      'posts', COALESCE(act.posts, 0),
      'views', COALESCE(act.views, 0),
      'dwell_events', COALESCE(act.dwell_events, 0),
      'likes', COALESCE(act.likes, 0),
      'comments', COALESCE(act.comments, 0),
      'bookmarks', COALESCE(act.bookmarks, 0),
      'follows', COALESCE(act.follows, 0),
      'engagement_events', COALESCE(act.likes, 0) + COALESCE(act.comments, 0) + COALESCE(act.bookmarks, 0) + COALESCE(act.follows, 0),
      'engagement_per_view',
        CASE WHEN COALESCE(act.views, 0) = 0 THEN NULL
        ELSE ROUND(((act.likes + act.comments + act.bookmarks + act.follows)::NUMERIC / act.views::NUMERIC), 4)
        END,
      'comment_per_view',
        CASE WHEN COALESCE(act.views, 0) = 0 THEN NULL
        ELSE ROUND((act.comments::NUMERIC / act.views::NUMERIC), 4)
        END
    ),
    'activation_speed', JSONB_BUILD_OBJECT(
      'median_time_to_first_post_seconds', ROUND(COALESCE(fp.median_seconds, 0)::NUMERIC, 0),
      'median_time_to_first_meaningful_interaction_seconds', ROUND(COALESCE(fmi.median_seconds, 0)::NUMERIC, 0)
    )
  )
  INTO v_snapshot
  FROM active a
  CROSS JOIN signup_cohorts sc
  CROSS JOIN retention r
  CROSS JOIN activity_7d act
  CROSS JOIN creator_activation ca
  CROSS JOIN first_post fp
  CROSS JOIN first_meaningful_interaction fmi;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.product_health_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.product_health_snapshot() TO anon, authenticated;
