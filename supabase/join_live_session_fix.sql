-- join_live_session_fix.sql
-- Ändert join/leave RPC auf SECURITY DEFINER damit Supabase RLS nicht blockiert.
-- Im Supabase SQL-Editor ausführen.

CREATE OR REPLACE FUNCTION public.join_live_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.live_sessions
  SET
    viewer_count = viewer_count + 1,
    peak_viewers = GREATEST(peak_viewers, viewer_count + 1)
  WHERE id = p_session_id AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_live_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.live_sessions
  SET viewer_count = GREATEST(0, viewer_count - 1)
  WHERE id = p_session_id AND status = 'active';
END;
$$;
