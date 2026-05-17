-- Adds enforcement readiness checks to moderation_health_snapshot().

CREATE OR REPLACE FUNCTION public.moderation_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_oldest_pending_age_seconds NUMERIC;
  v_legacy_post_unqueued BIGINT := 0;
  v_legacy_user_unqueued BIGINT := 0;
  v_legacy_live_unqueued BIGINT := 0;
BEGIN
  SELECT EXTRACT(EPOCH FROM (v_generated_at - MIN(created_at)))
    INTO v_oldest_pending_age_seconds
    FROM public.content_reports
   WHERE status = 'pending';

  IF to_regclass('public.post_reports') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.post_reports pr
      WHERE pr.reason = 'report'
        AND NOT EXISTS (
          SELECT 1
          FROM public.content_reports cr
          WHERE cr.reporter_id = pr.reporter_id
            AND cr.target_type = 'post'
            AND cr.target_id = pr.post_id
            AND cr.created_at >= pr.created_at - INTERVAL '1 minute'
        )
    $sql$ INTO v_legacy_post_unqueued;
  END IF;

  IF to_regclass('public.user_reports') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.user_reports ur
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.content_reports cr
        WHERE cr.reporter_id = ur.reporter_id
          AND cr.target_type = 'profile'
          AND cr.target_id = ur.reported_id
          AND cr.created_at >= ur.created_at - INTERVAL '1 minute'
      )
    $sql$ INTO v_legacy_user_unqueued;
  END IF;

  IF to_regclass('public.live_reports') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.live_reports lr
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.content_reports cr
        WHERE cr.reporter_id = lr.reporter_id
          AND cr.target_type = 'live'
          AND cr.target_id = lr.session_id
          AND cr.created_at >= lr.created_at - INTERVAL '1 minute'
      )
    $sql$ INTO v_legacy_live_unqueued;
  END IF;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'sla_hours', 24,
    'content_reports', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.content_reports),
      'pending', (SELECT COUNT(*) FROM public.content_reports WHERE status = 'pending'),
      'reviewed_7d', (
        SELECT COUNT(*)
        FROM public.content_reports
        WHERE reviewed_at >= v_generated_at - INTERVAL '7 days'
      ),
      'pending_over_sla', (
        SELECT COUNT(*)
        FROM public.content_reports
        WHERE status = 'pending'
          AND created_at < v_generated_at - INTERVAL '24 hours'
      ),
      'oldest_pending_age_seconds', v_oldest_pending_age_seconds,
      'by_target_type', COALESCE((
        SELECT jsonb_object_agg(target_type, count)
        FROM (
          SELECT target_type, COUNT(*) AS count
          FROM public.content_reports
          WHERE status = 'pending'
          GROUP BY target_type
          ORDER BY target_type
        ) grouped
      ), '{}'::jsonb)
    ),
    'legacy_unqueued', jsonb_build_object(
      'post_reports', COALESCE(v_legacy_post_unqueued, 0),
      'user_reports', COALESCE(v_legacy_user_unqueued, 0),
      'live_reports', COALESCE(v_legacy_live_unqueued, 0),
      'total',
        COALESCE(v_legacy_post_unqueued, 0) +
        COALESCE(v_legacy_user_unqueued, 0) +
        COALESCE(v_legacy_live_unqueued, 0)
    ),
    'admin_audit', jsonb_build_object(
      'events_7d', (
        SELECT COUNT(*)
        FROM public.admin_audit_log
        WHERE created_at >= v_generated_at - INTERVAL '7 days'
      ),
      'moderation_events_7d', (
        SELECT COUNT(*)
        FROM public.admin_audit_log
        WHERE action LIKE 'moderation.%'
          AND created_at >= v_generated_at - INTERVAL '7 days'
      )
    ),
    'enforcement', jsonb_build_object(
      'rpc_available', to_regprocedure('public.admin_enforce_content_report(uuid,text,text)') IS NOT NULL,
      'profile_ban_column', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_banned'
      ),
      'profile_restrict_columns', (
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_restricted'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'restricted_until'
        )
      ),
      'profile_shadowban_column', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_shadow_banned'
      ),
      'live_mute_table', to_regclass('public.live_chat_timeouts') IS NOT NULL,
      'audit_log_table', to_regclass('public.admin_audit_log') IS NOT NULL
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_health_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.moderation_health_snapshot() TO anon, authenticated;
