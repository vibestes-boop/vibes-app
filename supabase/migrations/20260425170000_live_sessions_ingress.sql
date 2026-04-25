-- ============================================================================
-- v1.w.UI.35 — OBS-WHIP-Ingest (Phase 6b der WEB_ROADMAP)
--
-- Erweitert live_sessions um die Felder die ein externer Streamer (OBS,
-- vMix, Streamlabs etc.) braucht um über WHIP nach LiveKit zu publishen:
--
--   - ingress_id          : LiveKit-seitige Ingress-ID (für Cleanup-DELETE)
--   - ingress_url         : Der WHIP-Endpoint den OBS als Server-URL braucht
--   - ingress_stream_key  : Das Token/Key das OBS als Stream-Key braucht
--                           (SENSITIVE — eigene RLS unten)
--   - ingress_type        : 'whip' | 'rtmp' | NULL (NULL = Browser-Stream).
--                           Heute nur 'whip', RTMP ggf. später für ältere
--                           Streamer-Software.
--
-- Wichtig: alle vier Felder sind NULL wenn die Session per Browser publishet
-- (also der existierende /live/start-Flow). Nur OBS-Sessions haben sie
-- gefüllt. Ein einzelnes BOOLEAN-Flag würde reichen, aber das Type-Feld
-- gibt uns Headroom für RTMP ohne weitere Migration.
-- ============================================================================

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS ingress_id          TEXT,
  ADD COLUMN IF NOT EXISTS ingress_url         TEXT,
  ADD COLUMN IF NOT EXISTS ingress_stream_key  TEXT,
  ADD COLUMN IF NOT EXISTS ingress_type        TEXT
    CHECK (ingress_type IS NULL OR ingress_type IN ('whip', 'rtmp'));

-- Index auf ingress_id damit der Cleanup-Job (oder die Edge-Function im
-- DELETE-Pfad) schnell die Session findet zu einer LiveKit-Ingress.
CREATE INDEX IF NOT EXISTS idx_live_sessions_ingress
  ON public.live_sessions(ingress_id)
  WHERE ingress_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- RLS-Schärfung: ingress_stream_key darf NUR der Host selbst lesen.
-- Die existierende `live_sessions_select`-Policy gibt jedem User Zugriff auf
-- die Row (USING true) — sonst könnte niemand Streams entdecken/joinen. Aber
-- der Stream-Key ist Credentials. Jeder mit Key kann nach LiveKit publishen
-- als der Host → der Stream wäre kompromittiert.
--
-- Lösung: column-level grants. Wir REVOKEN den default-SELECT auf die
-- Ingress-Felder von authenticated und anon, dann GRANT-en wir gezielt nur
-- auf alle anderen Felder. Der Host kann via SECURITY DEFINER RPC
-- (siehe nächste Migration ggf.) seinen eigenen Key abrufen.
--
-- Pragmatischer Ansatz heute: Wir setzen die Ingress-Felder in der
-- Edge-Function direkt im Response zurück an den Host, und der Frontend-
-- Code liest sie NIE direkt aus der live_sessions-Row aus. Heißt:
-- ingress_stream_key wandert vom Edge-Function-Response in den UI-State
-- des Hosts, nicht via DB-SELECT. Die DB-Spalte dient nur als Persistenz
-- für die Edge-Function selbst (Service-Role bypasses RLS sowieso).
--
-- Defensive Maßnahme: explicit column-level REVOKE damit niemand per
-- versehentlichem `select *` an den Key kommt.
-- ----------------------------------------------------------------------------

REVOKE SELECT (ingress_stream_key) ON public.live_sessions FROM authenticated;
REVOKE SELECT (ingress_stream_key) ON public.live_sessions FROM anon;

-- (Service-Role bypasst RLS und Column-Grants — Edge-Function kommt weiter ran.)

-- ----------------------------------------------------------------------------
-- Helper-RPC: get_my_ingress_credentials(session_id)
-- Gibt ingress_url + ingress_stream_key zurück, ABER nur wenn der Caller
-- der Host der Session ist. SECURITY DEFINER damit die Function die
-- column-level-Restrictions bypasst, dafür eigene auth-Logic.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_ingress_credentials(p_session_id UUID)
RETURNS TABLE (
  ingress_url        TEXT,
  ingress_stream_key TEXT,
  ingress_type       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nur authenticated User
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Nur der Host darf seine eigenen Credentials lesen
  RETURN QUERY
    SELECT s.ingress_url, s.ingress_stream_key, s.ingress_type
    FROM public.live_sessions s
    WHERE s.id = p_session_id
      AND s.host_id = auth.uid()
      AND s.ingress_id IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_ingress_credentials(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_ingress_credentials(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_my_ingress_credentials(UUID) TO authenticated;
