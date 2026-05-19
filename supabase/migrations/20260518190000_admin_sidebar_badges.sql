-- Admin sidebar badges: real counts for navigation urgency.

CREATE OR REPLACE FUNCTION public.admin_sidebar_badges_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_pending_reports BIGINT := 0;
  v_reports_over_sla BIGINT := 0;
  v_open_support BIGINT := 0;
  v_support_over_sla BIGINT := 0;
  v_r2_errors BIGINT := 0;
  v_public_video_missing_thumb BIGINT := 0;
BEGIN
  IF NOT public.has_admin_console_access() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT COUNT(*)
    INTO v_pending_reports
    FROM public.content_reports
   WHERE status = 'pending';

  SELECT COUNT(*)
    INTO v_reports_over_sla
    FROM public.content_reports
   WHERE status = 'pending'
     AND created_at < v_generated_at - INTERVAL '24 hours';

  IF to_regclass('public.admin_support_threads') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.admin_support_threads
      WHERE status IN ('open', 'pending')
    $sql$ INTO v_open_support;

    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.admin_support_threads
      WHERE status IN ('open', 'pending')
        AND created_at < NOW() - INTERVAL '24 hours'
    $sql$ INTO v_support_over_sla;
  END IF;

  IF to_regclass('public.r2_delete_queue') IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_r2_errors
      FROM public.r2_delete_queue
     WHERE status = 'error';
  END IF;

  SELECT COUNT(*)
    INTO v_public_video_missing_thumb
    FROM public.posts
   WHERE privacy = 'public'
     AND media_type = 'video'
     AND thumbnail_url IS NULL;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'reports', jsonb_build_object(
      'pending', v_pending_reports,
      'over_sla', v_reports_over_sla
    ),
    'support', jsonb_build_object(
      'open', v_open_support,
      'over_sla', v_support_over_sla
    ),
    'campaigns', jsonb_build_object(
      'active', 0,
      'failed', 0,
      'status', 'missing_model'
    ),
    'security', jsonb_build_object(
      'critical', v_reports_over_sla + v_support_over_sla + v_r2_errors + v_public_video_missing_thumb,
      'r2_errors', v_r2_errors,
      'video_missing_thumbnail', v_public_video_missing_thumb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sidebar_badges_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_sidebar_badges_snapshot() TO authenticated;
