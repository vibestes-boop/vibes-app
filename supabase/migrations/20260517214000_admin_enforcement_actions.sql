-- Admin enforcement actions for canonical moderation reports.
-- Keeps enforcement behind one audited SECURITY DEFINER RPC.
-- Post deletion relies on the existing posts AFTER DELETE trigger that enqueues
-- media cleanup in public.r2_delete_queue.

CREATE OR REPLACE FUNCTION public.admin_enforce_content_report(
  p_report_id  UUID,
  p_action     TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_report public.content_reports%ROWTYPE;
  v_note TEXT := NULLIF(trim(COALESCE(p_admin_note, '')), '');
  v_deleted_post RECORD;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_admin_id
      AND is_admin = TRUE
  ) THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  SELECT *
    INTO v_report
    FROM public.content_reports
   WHERE id = p_report_id
   FOR UPDATE;

  IF v_report.id IS NULL THEN
    RETURN jsonb_build_object('error', 'report_not_found');
  END IF;

  IF p_action = 'remove_post' THEN
    IF v_report.target_type <> 'post' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    DELETE FROM public.posts p
     WHERE p.id = v_report.target_id
     RETURNING p.id, p.author_id, p.media_url, p.thumbnail_url
      INTO v_deleted_post;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'post_not_found');
    END IF;
  ELSIF p_action = 'ban_profile' THEN
    IF v_report.target_type <> 'profile' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    UPDATE public.profiles
       SET is_banned = TRUE
     WHERE id = v_report.target_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'profile_not_found');
    END IF;
  ELSE
    RETURN jsonb_build_object('error', 'unsupported_action');
  END IF;

  UPDATE public.content_reports
     SET status = 'actioned',
         admin_note = v_note,
         reviewed_by = v_admin_id,
         reviewed_at = NOW()
   WHERE id = p_report_id;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    details
  )
  VALUES (
    v_admin_id,
    'moderation.enforcement.' || p_action,
    v_report.target_type,
    v_report.target_id,
    jsonb_build_object(
      'report_id', v_report.id,
      'reason', v_report.reason,
      'reporter_id', v_report.reporter_id,
      'admin_note_present', v_note IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'action', p_action,
    'report_id', p_report_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_enforce_content_report(UUID, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_enforce_content_report(UUID, TEXT, TEXT) TO authenticated;
