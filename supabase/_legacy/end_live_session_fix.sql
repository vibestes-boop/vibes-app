-- ── end_live_session RPC Fix ─────────────────────────────────────────────────
-- Stellt sicher dass viewer_count auf 0 gesetzt wird wenn Session beendet wird.
-- Führe im Supabase SQL-Editor aus.

CREATE OR REPLACE FUNCTION end_live_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.live_sessions
  SET
    status       = 'ended',
    ended_at     = NOW(),
    viewer_count = 0          -- ← Fix: wird nun explizit auf 0 gesetzt
  WHERE id = p_session_id
    AND host_id = auth.uid(); -- nur der Host kann beenden
END;
$$;
