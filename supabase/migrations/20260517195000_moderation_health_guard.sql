-- Trust & Safety guardrails: central report queue, admin audit log, SLA health.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON public.admin_audit_log(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.admin_audit_log(target_type, target_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_log_admin_select" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_admin_select" ON public.admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND is_admin = TRUE
    )
  );

CREATE INDEX IF NOT EXISTS idx_content_reports_pending_sla
  ON public.content_reports(status, created_at)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.create_report(
  p_target_type TEXT,
  p_target_id   UUID,
  p_reason      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter UUID := auth.uid();
  v_existing UUID;
BEGIN
  IF v_reporter IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF p_target_type NOT IN ('post', 'profile', 'comment', 'live', 'product') THEN
    RETURN jsonb_build_object('error', 'invalid_target_type');
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 OR length(p_reason) > 120 THEN
    RETURN jsonb_build_object('error', 'invalid_reason');
  END IF;

  SELECT id
    INTO v_existing
    FROM public.content_reports
   WHERE reporter_id = v_reporter
     AND target_type = p_target_type
     AND target_id = p_target_id
     AND reason = p_reason
     AND status IN ('pending', 'reviewed', 'actioned')
     AND created_at >= NOW() - INTERVAL '30 days'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'report_id', v_existing);
  END IF;

  INSERT INTO public.content_reports (reporter_id, target_type, target_id, reason)
  VALUES (v_reporter, p_target_type, p_target_id, trim(p_reason))
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'report_id', v_existing);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_content_report(
  p_report_id   UUID,
  p_status      TEXT,
  p_admin_note  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_report public.content_reports%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_actor
      AND is_admin = TRUE
  ) THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  IF p_status NOT IN ('reviewed', 'actioned', 'dismissed') THEN
    RETURN jsonb_build_object('error', 'invalid_status');
  END IF;

  UPDATE public.content_reports
     SET status = p_status,
         admin_note = NULLIF(trim(COALESCE(p_admin_note, '')), ''),
         reviewed_at = NOW(),
         reviewed_by = v_actor
   WHERE id = p_report_id
   RETURNING * INTO v_report;

  IF v_report.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    v_actor,
    'moderation.report.' || p_status,
    v_report.target_type,
    v_report.target_id,
    jsonb_build_object(
      'report_id', v_report.id,
      'reason', v_report.reason,
      'reporter_id', v_report.reporter_id,
      'admin_note_present', COALESCE(p_admin_note, '') <> ''
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.moderation_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    )
  );
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.post_reports') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.content_reports (reporter_id, target_type, target_id, reason, created_at)
      SELECT pr.reporter_id, 'post', pr.post_id, pr.reason, pr.created_at
      FROM public.post_reports pr
      WHERE pr.reason = 'report'
        AND NOT EXISTS (
          SELECT 1
          FROM public.content_reports cr
          WHERE cr.reporter_id = pr.reporter_id
            AND cr.target_type = 'post'
            AND cr.target_id = pr.post_id
            AND cr.reason = pr.reason
        )
    $sql$;
  END IF;

  IF to_regclass('public.user_reports') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.content_reports (reporter_id, target_type, target_id, reason, created_at)
      SELECT ur.reporter_id, 'profile', ur.reported_id, ur.reason, ur.created_at
      FROM public.user_reports ur
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.content_reports cr
        WHERE cr.reporter_id = ur.reporter_id
          AND cr.target_type = 'profile'
          AND cr.target_id = ur.reported_id
          AND cr.reason = ur.reason
      )
    $sql$;
  END IF;

  IF to_regclass('public.live_reports') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.content_reports (reporter_id, target_type, target_id, reason, created_at)
      SELECT lr.reporter_id, 'live', lr.session_id, lr.reason, lr.created_at
      FROM public.live_reports lr
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.content_reports cr
        WHERE cr.reporter_id = lr.reporter_id
          AND cr.target_type = 'live'
          AND cr.target_id = lr.session_id
          AND cr.reason = lr.reason
      )
    $sql$;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.create_report(TEXT, UUID, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.admin_resolve_content_report(UUID, TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.moderation_health_snapshot() FROM public;

GRANT EXECUTE ON FUNCTION public.create_report(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_content_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_health_snapshot() TO anon, authenticated;
