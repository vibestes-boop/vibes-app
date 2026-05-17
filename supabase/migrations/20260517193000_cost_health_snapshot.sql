-- Cost health snapshot for weekly budget reviews.
-- Uses actual tracked AI image cost plus production usage proxies for features
-- that do not yet expose provider billing APIs.

CREATE OR REPLACE FUNCTION public.cost_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start TIMESTAMPTZ := DATE_TRUNC('month', NOW());
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
  audience AS (
    SELECT COUNT(DISTINCT user_id) AS mau
    FROM events
    WHERE created_at >= NOW() - INTERVAL '30 days'
  ),
  ai AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= v_month_start) AS generations_month,
      COALESCE(SUM(cost_cents) FILTER (WHERE created_at >= v_month_start), 0) AS cost_cents_month,
      COUNT(*) FILTER (WHERE created_at >= v_month_start AND error IS NOT NULL) AS errors_month,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_month_start) AS creators_month
    FROM public.ai_image_generations
  ),
  uploads AS (
    SELECT
      COUNT(*) FILTER (WHERE media_url IS NOT NULL AND created_at >= v_month_start) AS media_uploads_month,
      COUNT(*) FILTER (WHERE thumbnail_url IS NOT NULL AND created_at >= v_month_start) AS thumbnail_uploads_month,
      COUNT(*) FILTER (WHERE media_type = 'video' AND created_at >= v_month_start) AS video_posts_month,
      COUNT(*) FILTER (WHERE media_type = 'image' AND created_at >= v_month_start) AS image_posts_month,
      COUNT(*) FILTER (WHERE media_url IS NOT NULL OR thumbnail_url IS NOT NULL) AS referenced_media_objects
    FROM public.posts
  ),
  live AS (
    SELECT
      COUNT(*) FILTER (WHERE started_at >= v_month_start) AS sessions_month,
      COALESCE(
        SUM(
          GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) / 60
        ) FILTER (WHERE started_at >= v_month_start),
        0
      ) AS minutes_month,
      COALESCE(MAX(peak_viewers) FILTER (WHERE started_at >= v_month_start), 0) AS peak_viewers_month
    FROM public.live_sessions
  ),
  recordings AS (
    SELECT
      COUNT(*) FILTER (WHERE started_at >= v_month_start) AS recordings_month,
      COALESCE(SUM(duration_secs) FILTER (WHERE started_at >= v_month_start), 0) / 60.0 AS recording_minutes_month
    FROM public.live_recordings
  ),
  edge_db AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= v_month_start) AS r2_queue_rows_month,
      COUNT(*) FILTER (WHERE created_at >= v_month_start AND status = 'error') AS r2_queue_errors_month
    FROM public.r2_delete_queue
  ),
  db_activity AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'view' AND created_at >= v_month_start) AS post_views_month,
      COUNT(*) FILTER (WHERE event_type = 'post' AND created_at >= v_month_start) AS posts_month,
      COUNT(*) FILTER (WHERE event_type = 'comment' AND created_at >= v_month_start) AS comments_month,
      COUNT(*) FILTER (WHERE event_type = 'like' AND created_at >= v_month_start) AS likes_month,
      COUNT(*) FILTER (WHERE event_type = 'bookmark' AND created_at >= v_month_start) AS bookmarks_month,
      COUNT(*) FILTER (WHERE event_type = 'follow' AND created_at >= v_month_start) AS follows_month
    FROM events
  )
  SELECT JSONB_BUILD_OBJECT(
    'generated_at', NOW(),
    'month_start', v_month_start,
    'audience', JSONB_BUILD_OBJECT(
      'mau', COALESCE(audience.mau, 0)
    ),
    'ai', JSONB_BUILD_OBJECT(
      'image_generations_month', COALESCE(ai.generations_month, 0),
      'cost_cents_month', COALESCE(ai.cost_cents_month, 0),
      'errors_month', COALESCE(ai.errors_month, 0),
      'creators_month', COALESCE(ai.creators_month, 0)
    ),
    'media', JSONB_BUILD_OBJECT(
      'media_uploads_month', COALESCE(uploads.media_uploads_month, 0),
      'thumbnail_uploads_month', COALESCE(uploads.thumbnail_uploads_month, 0),
      'image_posts_month', COALESCE(uploads.image_posts_month, 0),
      'video_posts_month', COALESCE(uploads.video_posts_month, 0),
      'referenced_media_objects', COALESCE(uploads.referenced_media_objects, 0)
    ),
    'live', JSONB_BUILD_OBJECT(
      'sessions_month', COALESCE(live.sessions_month, 0),
      'minutes_month', ROUND(COALESCE(live.minutes_month, 0)::NUMERIC, 2),
      'peak_viewers_month', COALESCE(live.peak_viewers_month, 0),
      'recordings_month', COALESCE(recordings.recordings_month, 0),
      'recording_minutes_month', ROUND(COALESCE(recordings.recording_minutes_month, 0)::NUMERIC, 2)
    ),
    'edge_db_proxies', JSONB_BUILD_OBJECT(
      'r2_queue_rows_month', COALESCE(edge_db.r2_queue_rows_month, 0),
      'r2_queue_errors_month', COALESCE(edge_db.r2_queue_errors_month, 0),
      'post_views_month', COALESCE(db_activity.post_views_month, 0),
      'posts_month', COALESCE(db_activity.posts_month, 0),
      'comments_month', COALESCE(db_activity.comments_month, 0),
      'likes_month', COALESCE(db_activity.likes_month, 0),
      'bookmarks_month', COALESCE(db_activity.bookmarks_month, 0),
      'follows_month', COALESCE(db_activity.follows_month, 0)
    ),
    'unit_economics', JSONB_BUILD_OBJECT(
      'tracked_cost_cents_month', COALESCE(ai.cost_cents_month, 0),
      'tracked_cost_cents_per_mau',
        CASE WHEN COALESCE(audience.mau, 0) = 0 THEN NULL
        ELSE ROUND((ai.cost_cents_month::NUMERIC / audience.mau::NUMERIC), 2)
        END,
      'ai_cost_cents_per_generation',
        CASE WHEN COALESCE(ai.generations_month, 0) = 0 THEN NULL
        ELSE ROUND((ai.cost_cents_month::NUMERIC / ai.generations_month::NUMERIC), 2)
        END
    )
  )
  INTO v_snapshot
  FROM audience, ai, uploads, live, recordings, edge_db, db_activity;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.cost_health_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.cost_health_snapshot() TO anon, authenticated;
