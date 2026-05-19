-- Server-side user directory for /admin/users.
-- Adds pagination and backend filters without exposing auth identity data.

CREATE OR REPLACE FUNCTION public.admin_user_directory_page(
  p_query        TEXT    DEFAULT '',
  p_status       TEXT    DEFAULT 'all',
  p_role         TEXT    DEFAULT 'all',
  p_verification TEXT    DEFAULT 'all',
  p_activity     TEXT    DEFAULT 'all',
  p_risk         TEXT    DEFAULT 'all',
  p_limit        INTEGER DEFAULT 20,
  p_offset       INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                   UUID,
  username             TEXT,
  display_name         TEXT,
  avatar_url           TEXT,
  is_verified          BOOLEAN,
  is_admin             BOOLEAN,
  is_moderator         BOOLEAN,
  is_operator          BOOLEAN,
  is_creator_ops       BOOLEAN,
  is_banned            BOOLEAN,
  is_restricted        BOOLEAN,
  restricted_until     TIMESTAMPTZ,
  is_shadow_banned     BOOLEAN,
  women_only_verified  BOOLEAN,
  is_creator           BOOLEAN,
  created_at           TIMESTAMPTZ,
  post_count           BIGINT,
  follower_count       BIGINT,
  comment_count        BIGINT,
  report_count         BIGINT,
  last_activity_at     TIMESTAMPTZ,
  risk_level           TEXT,
  total_count          BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  WITH post_counts AS (
    SELECT author_id AS user_id, COUNT(*)::BIGINT AS post_count
    FROM public.posts
    WHERE author_id IS NOT NULL
    GROUP BY author_id
  ),
  comment_counts AS (
    SELECT user_id, COUNT(*)::BIGINT AS comment_count
    FROM public.comments
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ),
  follower_counts AS (
    SELECT following_id AS user_id, COUNT(*)::BIGINT AS follower_count
    FROM public.follows
    WHERE following_id IS NOT NULL
    GROUP BY following_id
  ),
  report_counts AS (
    SELECT target_id AS user_id, COUNT(*)::BIGINT AS report_count
    FROM public.content_reports
    WHERE target_type = 'profile'
    GROUP BY target_id
  ),
  activity_events AS (
    SELECT author_id AS user_id, created_at FROM public.posts WHERE author_id IS NOT NULL
    UNION ALL
    SELECT user_id, created_at FROM public.comments WHERE user_id IS NOT NULL
    UNION ALL
    SELECT user_id, created_at FROM public.likes WHERE user_id IS NOT NULL
    UNION ALL
    SELECT user_id, created_at FROM public.bookmarks WHERE user_id IS NOT NULL
    UNION ALL
    SELECT follower_id AS user_id, created_at FROM public.follows WHERE follower_id IS NOT NULL
  ),
  last_activity AS (
    SELECT user_id, MAX(created_at) AS last_activity_at
    FROM activity_events
    GROUP BY user_id
  ),
  enriched AS (
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      COALESCE(p.is_verified, FALSE) AS is_verified,
      COALESCE(p.is_admin, FALSE) AS is_admin,
      COALESCE(p.is_moderator, FALSE) AS is_moderator,
      COALESCE(p.is_operator, FALSE) AS is_operator,
      COALESCE(p.is_creator_ops, FALSE) AS is_creator_ops,
      COALESCE(p.is_banned, FALSE) AS is_banned,
      COALESCE(p.is_restricted, FALSE) AS is_restricted,
      p.restricted_until,
      COALESCE(p.is_shadow_banned, FALSE) AS is_shadow_banned,
      COALESCE(p.women_only_verified, FALSE) AS women_only_verified,
      COALESCE(p.is_creator, FALSE) AS is_creator,
      p.created_at,
      COALESCE(pc.post_count, 0) AS post_count,
      COALESCE(fc.follower_count, 0) AS follower_count,
      COALESCE(cc.comment_count, 0) AS comment_count,
      COALESCE(rc.report_count, 0) AS report_count,
      la.last_activity_at,
      CASE
        WHEN COALESCE(p.is_banned, FALSE)
          OR COALESCE(p.is_shadow_banned, FALSE)
          OR COALESCE(rc.report_count, 0) >= 3 THEN 'high'
        WHEN COALESCE(p.is_restricted, FALSE)
          OR COALESCE(rc.report_count, 0) > 0 THEN 'medium'
        ELSE 'low'
      END AS risk_level,
      au.email
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    LEFT JOIN post_counts pc ON pc.user_id = p.id
    LEFT JOIN follower_counts fc ON fc.user_id = p.id
    LEFT JOIN comment_counts cc ON cc.user_id = p.id
    LEFT JOIN report_counts rc ON rc.user_id = p.id
    LEFT JOIN last_activity la ON la.user_id = p.id
    WHERE public.is_admin()
      AND (
        COALESCE(p_query, '') = ''
        OR p.username ILIKE '%' || p_query || '%'
        OR p.display_name ILIKE '%' || p_query || '%'
        OR p.id::TEXT ILIKE '%' || p_query || '%'
        OR au.email ILIKE '%' || p_query || '%'
      )
  ),
  filtered AS (
    SELECT *
    FROM enriched
    WHERE
      (p_status = 'all'
        OR (p_status = 'banned' AND is_banned)
        OR (p_status = 'restricted' AND (is_restricted OR is_shadow_banned))
        OR (p_status = 'active' AND NOT is_banned AND NOT is_restricted AND NOT is_shadow_banned))
      AND (p_role = 'all'
        OR (p_role = 'admin' AND is_admin)
        OR (p_role = 'moderator' AND is_moderator)
        OR (p_role = 'operator' AND is_operator)
        OR (p_role = 'creator_ops' AND is_creator_ops)
        OR (p_role = 'creator' AND is_creator AND NOT is_admin AND NOT is_moderator AND NOT is_operator AND NOT is_creator_ops)
        OR (p_role = 'user' AND NOT is_admin AND NOT is_moderator AND NOT is_operator AND NOT is_creator_ops AND NOT is_creator))
      AND (p_verification = 'all'
        OR (p_verification = 'verified' AND is_verified)
        OR (p_verification = 'unverified' AND NOT is_verified))
      AND (p_activity = 'all'
        OR (p_activity = 'active_30d' AND last_activity_at >= NOW() - INTERVAL '30 days')
        OR (p_activity = 'inactive_30d' AND (last_activity_at IS NULL OR last_activity_at < NOW() - INTERVAL '30 days')))
      AND (p_risk = 'all' OR risk_level = p_risk)
  )
  SELECT
    filtered.id,
    filtered.username,
    filtered.display_name,
    filtered.avatar_url,
    filtered.is_verified,
    filtered.is_admin,
    filtered.is_moderator,
    filtered.is_operator,
    filtered.is_creator_ops,
    filtered.is_banned,
    filtered.is_restricted,
    filtered.restricted_until,
    filtered.is_shadow_banned,
    filtered.women_only_verified,
    filtered.is_creator,
    filtered.created_at,
    filtered.post_count,
    filtered.follower_count,
    filtered.comment_count,
    filtered.report_count,
    filtered.last_activity_at,
    filtered.risk_level,
    COUNT(*) OVER ()::BIGINT AS total_count
  FROM filtered
  ORDER BY filtered.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.admin_user_directory_page(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_directory_page(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
