-- Extended audited moderation enforcement actions.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS restricted_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_moderation_flags
  ON public.profiles (is_banned, is_restricted, is_shadow_banned)
  WHERE is_banned = TRUE OR is_restricted = TRUE OR is_shadow_banned = TRUE;

CREATE OR REPLACE FUNCTION public.admin_enforce_content_report(
  p_report_id  UUID,
  p_action     TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_report public.content_reports%ROWTYPE;
  v_note TEXT := NULLIF(trim(COALESCE(p_admin_note, '')), '');
  v_deleted_post RECORD;
  v_live_session RECORD;
  v_restricted_until TIMESTAMPTZ := NOW() + INTERVAL '7 days';
  v_live_mute_until TIMESTAMPTZ := NOW() + INTERVAL '1 hour';
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
  ELSIF p_action = 'restrict_profile' THEN
    IF v_report.target_type <> 'profile' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    UPDATE public.profiles
       SET is_restricted = TRUE,
           restricted_until = GREATEST(COALESCE(restricted_until, v_restricted_until), v_restricted_until)
     WHERE id = v_report.target_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'profile_not_found');
    END IF;
  ELSIF p_action = 'shadowban_profile' THEN
    IF v_report.target_type <> 'profile' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    UPDATE public.profiles
       SET is_shadow_banned = TRUE
     WHERE id = v_report.target_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'profile_not_found');
    END IF;
  ELSIF p_action = 'mute_live_host' THEN
    IF v_report.target_type <> 'live' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    SELECT id, host_id
      INTO v_live_session
      FROM public.live_sessions
     WHERE id = v_report.target_id;

    IF v_live_session.id IS NULL THEN
      RETURN jsonb_build_object('error', 'live_session_not_found');
    END IF;

    INSERT INTO public.live_chat_timeouts (session_id, user_id, until_at, reason)
    VALUES (v_live_session.id, v_live_session.host_id, v_live_mute_until, COALESCE(v_note, 'admin_moderation'))
    ON CONFLICT (session_id, user_id) DO UPDATE
      SET until_at = GREATEST(public.live_chat_timeouts.until_at, EXCLUDED.until_at),
          reason = COALESCE(EXCLUDED.reason, public.live_chat_timeouts.reason);
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
      'admin_note_present', v_note IS NOT NULL,
      'restricted_until', CASE WHEN p_action = 'restrict_profile' THEN v_restricted_until ELSE NULL END,
      'live_mute_until', CASE WHEN p_action = 'mute_live_host' THEN v_live_mute_until ELSE NULL END
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
