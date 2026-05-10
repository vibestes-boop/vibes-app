-- Keep the persisted live_comments.pinned state in sync with the moderator RPCs.
-- The UI subscribes to live_comments UPDATE events, while older RPC versions only
-- wrote the pinned JSON snapshot to live_sessions.pinned_comment.

CREATE OR REPLACE FUNCTION public.pin_live_comment(
  p_session_id uuid,
  p_comment    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_host       uuid;
  v_comment_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
     AND status = 'active'
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden oder nicht aktiv'
      USING ERRCODE = '42501';
  END IF;

  IF v_caller <> v_host
     AND NOT public.is_live_session_moderator(p_session_id, v_caller) THEN
    RAISE EXCEPTION 'Nicht Host oder Moderator dieser Session'
      USING ERRCODE = '42501';
  END IF;

  v_comment_id := NULLIF(p_comment->>'id', '')::uuid;

  UPDATE public.live_comments
     SET pinned = false
   WHERE session_id = p_session_id
     AND pinned IS TRUE;

  UPDATE public.live_comments
     SET pinned = true
   WHERE session_id = p_session_id
     AND id = v_comment_id;

  UPDATE public.live_sessions
     SET pinned_comment = jsonb_set(p_comment, '{pinned}', 'true'::jsonb, true)
   WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpin_live_comment(
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_host   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden' USING ERRCODE = '42501';
  END IF;

  IF v_caller <> v_host
     AND NOT public.is_live_session_moderator(p_session_id, v_caller) THEN
    RAISE EXCEPTION 'Nicht Host oder Moderator dieser Session'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_comments
     SET pinned = false
   WHERE session_id = p_session_id
     AND pinned IS TRUE;

  UPDATE public.live_sessions
     SET pinned_comment = NULL
   WHERE id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pin_live_comment(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unpin_live_comment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pin_live_comment(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpin_live_comment(uuid) TO authenticated;
