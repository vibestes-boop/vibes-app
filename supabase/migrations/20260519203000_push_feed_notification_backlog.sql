-- Adds safer notification backlog diagnostics to the push/feed health snapshot.
--
-- This intentionally exposes only aggregate counts. The snapshot is callable by
-- anon/authenticated health guards, so it must not return recipient ids, emails,
-- tokens, endpoints, or notification content.

CREATE INDEX IF NOT EXISTS idx_notifications_unread_created
  ON public.notifications (created_at)
  WHERE read = false;

CREATE OR REPLACE FUNCTION public.push_feed_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_push_tokens JSONB := jsonb_build_object('available', false);
  v_web_push JSONB := jsonb_build_object('available', false);
  v_notifications JSONB := jsonb_build_object('available', false);
  v_feed JSONB;
  v_triggers JSONB;
BEGIN
  IF to_regclass('public.push_tokens') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT jsonb_build_object(
        'available', true,
        'total', COUNT(*),
        'active_30d', COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days'),
        'stale_90d', COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '90 days'),
        'platforms', COALESCE((
          SELECT jsonb_object_agg(platform, count)
          FROM (
            SELECT COALESCE(platform, 'unknown') AS platform, COUNT(*) AS count
            FROM public.push_tokens
            GROUP BY COALESCE(platform, 'unknown')
            ORDER BY COALESCE(platform, 'unknown')
          ) grouped
        ), '{}'::jsonb)
      )
      FROM public.push_tokens
    $sql$ INTO v_push_tokens;
  END IF;

  IF to_regclass('public.web_push_subscriptions') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT jsonb_build_object(
        'available', true,
        'total', COUNT(*),
        'active_30d', COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days'),
        'active_60d', COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '60 days'),
        'stale_60d', COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '60 days')
      )
      FROM public.web_push_subscriptions
    $sql$ INTO v_web_push;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT jsonb_build_object(
        'available', true,
        'total', COUNT(*),
        'created_24h', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'),
        'created_7d', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),
        'unread_total', COUNT(*) FILTER (WHERE read = false),
        'unread_30d_plus', COUNT(*) FILTER (
          WHERE read = false
            AND created_at < NOW() - INTERVAL '30 days'
        ),
        'unread_60d_plus', COUNT(*) FILTER (
          WHERE read = false
            AND created_at < NOW() - INTERVAL '60 days'
        ),
        'unread_90d_plus', COUNT(*) FILTER (
          WHERE read = false
            AND created_at < NOW() - INTERVAL '90 days'
        ),
        'oldest_unread_age_seconds',
          EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE read = false))),
        'by_type_7d', COALESCE((
          SELECT jsonb_object_agg(type, count)
          FROM (
            SELECT type, COUNT(*) AS count
            FROM public.notifications
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY type
            ORDER BY type
          ) grouped
        ), '{}'::jsonb),
        'by_type_unread', COALESCE((
          SELECT jsonb_object_agg(type, count)
          FROM (
            SELECT type, COUNT(*) AS count
            FROM public.notifications
            WHERE read = false
            GROUP BY type
            ORDER BY type
          ) grouped
        ), '{}'::jsonb),
        'recipient_backlog', COALESCE((
          SELECT jsonb_build_object(
            'users_with_unread', COUNT(*),
            'users_over_50', COUNT(*) FILTER (WHERE unread_count > 50),
            'users_over_100', COUNT(*) FILTER (WHERE unread_count > 100),
            'max_unread_for_one_user', COALESCE(MAX(unread_count), 0),
            'oldest_unread_for_one_user_age_seconds', COALESCE(MAX(oldest_age_seconds), 0)
          )
          FROM (
            SELECT
              recipient_id,
              COUNT(*) AS unread_count,
              EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) AS oldest_age_seconds
            FROM public.notifications
            WHERE read = false
            GROUP BY recipient_id
          ) grouped
        ), jsonb_build_object(
          'users_with_unread', 0,
          'users_over_50', 0,
          'users_over_100', 0,
          'max_unread_for_one_user', 0,
          'oldest_unread_for_one_user_age_seconds', 0
        ))
      )
      FROM public.notifications
    $sql$ INTO v_notifications;
  END IF;

  SELECT jsonb_build_object(
    'public_posts_total', COUNT(*) FILTER (WHERE privacy = 'public'),
    'public_posts_7d', COUNT(*) FILTER (
      WHERE privacy = 'public'
        AND created_at >= v_generated_at - INTERVAL '7 days'
    ),
    'public_media_posts_total', COUNT(*) FILTER (
      WHERE privacy = 'public'
        AND media_url IS NOT NULL
    ),
    'public_video_posts_without_thumbnail', COUNT(*) FILTER (
      WHERE privacy = 'public'
        AND media_type = 'video'
        AND thumbnail_url IS NULL
    ),
    'latest_public_post_age_seconds',
      EXTRACT(EPOCH FROM (v_generated_at - MAX(created_at) FILTER (WHERE privacy = 'public')))
  )
  INTO v_feed
  FROM public.posts;

  SELECT jsonb_build_object(
    'notifications_push_trigger', EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'notifications'
        AND t.tgname = 'trg_push_notification'
        AND NOT t.tgisinternal
    ),
    'messages_web_push_trigger', EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'messages'
        AND t.tgname = 'on_message_insert_web_push'
        AND NOT t.tgisinternal
    ),
    'send_push_notification_function', to_regprocedure('public.fn_send_push_on_notification()') IS NOT NULL,
    'notify_web_push_on_dm_function', to_regprocedure('public.notify_web_push_on_dm()') IS NOT NULL,
    'pg_net_available', to_regnamespace('net') IS NOT NULL
  )
  INTO v_triggers;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'push', jsonb_build_object(
      'native_tokens', v_push_tokens,
      'web_subscriptions', v_web_push,
      'notifications', v_notifications,
      'triggers', v_triggers
    ),
    'feed', v_feed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.push_feed_health_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.push_feed_health_snapshot() TO anon, authenticated;
