-- ============================================================================
-- Direktes, protokolliertes Admin-Löschen eines Posts (ohne vorherige Meldung).
--
-- Ergänzt den bestehenden melde-getriebenen Weg (admin_enforce_content_report):
-- Ein Admin kann einen beliebigen Post sofort entfernen. Jede Entfernung wird
-- im admin_audit_log protokolliert; offene Meldungen zu diesem Post werden als
-- 'actioned' abgeschlossen. Die Medien-Bereinigung läuft automatisch über den
-- bestehenden posts AFTER DELETE-Trigger (enqueue_r2_media_delete → r2_delete_queue).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_remove_post(
  p_post_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_reason   TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_deleted  RECORD;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_admin_id AND is_admin = TRUE
  ) THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  DELETE FROM public.posts p
   WHERE p.id = p_post_id
   RETURNING p.id, p.author_id INTO v_deleted;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'post_not_found');
  END IF;

  -- Offene Meldungen zu diesem Post automatisch abschließen.
  UPDATE public.content_reports
     SET status      = 'actioned',
         reviewed_by = v_admin_id,
         reviewed_at = NOW()
   WHERE target_type = 'post'
     AND target_id   = p_post_id
     AND status      = 'pending';

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, details
  )
  VALUES (
    v_admin_id,
    'moderation.remove_post.direct',
    'post',
    v_deleted.id,
    jsonb_build_object('author_id', v_deleted.author_id, 'reason', v_reason)
  );

  RETURN jsonb_build_object('success', TRUE, 'post_id', v_deleted.id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_post(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_post(UUID, TEXT) TO authenticated;
