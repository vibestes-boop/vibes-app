-- ══════════════════════════════════════════════════════════════════════════
-- 20260412_followers_only_chat.sql
-- Nur-Follower-Chat Toggle für Live Sessions
--
-- Fügt live_sessions.followers_only_chat hinzu.
-- Host kann damit den Chat auf seine Follower beschränken.
-- Viewer-seitig wird via RPC geprüft ob User dem Host folgt.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Spalte hinzufügen (default: false = jeder darf chatten)
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS followers_only_chat BOOLEAN NOT NULL DEFAULT false;

-- 2. RPC: Host kann die Einstellung toggeln (Security Definer → verhindert direkte Updates)
CREATE OR REPLACE FUNCTION toggle_followers_only_chat(
  p_session_id UUID,
  p_enabled    BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.live_sessions
  SET followers_only_chat = p_enabled
  WHERE id = p_session_id
    AND host_id = auth.uid();   -- nur eigene Session
END;
$$;

-- 3. RPC: Viewer prüft ob er dem Host folgt (atomic, kein extra SELECT im Client)
CREATE OR REPLACE FUNCTION is_following_host(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_host_id UUID;
  v_follows  BOOLEAN;
BEGIN
  -- Host-ID aus Session laden
  SELECT host_id INTO v_host_id
  FROM public.live_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Ist der aktuelle User ein Follower des Hosts?
  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = auth.uid()
      AND following_id = v_host_id
  ) INTO v_follows;

  RETURN v_follows;
END;
$$;
