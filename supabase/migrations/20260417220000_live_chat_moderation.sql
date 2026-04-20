-- ================================================================
-- Phase 6: Erweiterte Live-Chat-Moderation
-- ================================================================
-- Erweitert das bestehende Shadow-Ban-System (live_moderation.sql)
-- um zwei zusätzliche Moderations-Instrumente:
--
--   1. Slow-Mode: Host setzt N Sekunden Cool-Down zwischen Messages
--      pro User (Spam-Schutz). Clients enforcen das.
--
--   2. Timeouts: Host kann einzelne User für X Sekunden muten.
--      Timeouts werden via Broadcast kommuniziert — für Persistenz
--      (über App-Restart hinweg) gibt es aber auch einen DB-Fallback,
--      damit frisch verbundene Viewer laufende Timeouts sehen.
-- ================================================================

-- ─── 1. Slow-Mode Spalte ──────────────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS slow_mode_seconds int NOT NULL DEFAULT 0
    CHECK (slow_mode_seconds >= 0 AND slow_mode_seconds <= 300);

COMMENT ON COLUMN public.live_sessions.slow_mode_seconds IS
  'Sekunden Cool-Down zwischen Messages pro User. 0 = deaktiviert.';

-- ─── 2. Timeouts-Tabelle ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_chat_timeouts (
  session_id  uuid        NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  until_at    timestamptz NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- Hinweis: KEIN Partial-Index mit `WHERE until_at > now()` — Postgres
-- verbietet STABLE-Funktionen im Index-Predicate (ERROR 42P17). Runtime-
-- Filtering passiert in timeout_chat_user / Client-Side.
CREATE INDEX IF NOT EXISTS idx_chat_timeouts_session
  ON public.live_chat_timeouts (session_id);

-- ─── 3. RLS ──────────────────────────────────────────────────────
ALTER TABLE public.live_chat_timeouts ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten User dürfen Timeouts lesen (frisch verbundene
-- Viewer müssen sehen können, welcher User aktuell gemutet ist um
-- korrekt shadow-zu-bannen).
DROP POLICY IF EXISTS "chat_timeouts_select_all" ON public.live_chat_timeouts;
CREATE POLICY "chat_timeouts_select_all" ON public.live_chat_timeouts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Nur Host der Session darf Timeouts setzen/ändern/löschen
DROP POLICY IF EXISTS "chat_timeouts_write_host" ON public.live_chat_timeouts;
CREATE POLICY "chat_timeouts_write_host" ON public.live_chat_timeouts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_chat_timeouts.session_id
         AND s.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_chat_timeouts.session_id
         AND s.host_id = auth.uid()
    )
  );

-- ─── 4. Helper-RPCs ──────────────────────────────────────────────

-- Host timeouted einen User für N Sekunden.
-- Überschreibt bestehenden Timeout wenn vorhanden (längerer Timeout hat Priorität).
CREATE OR REPLACE FUNCTION public.timeout_chat_user(
  p_session_id uuid,
  p_user_id    uuid,
  p_seconds    int,
  p_reason     text DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host    uuid := auth.uid();
  v_until   timestamptz := now() + make_interval(secs => p_seconds);
  v_result  timestamptz;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_seconds <= 0 OR p_seconds > 86400 THEN
    RAISE EXCEPTION 'Timeout-Dauer muss zwischen 1s und 24h liegen'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
     WHERE id = p_session_id
       AND host_id = v_host
       AND status  = 'active'
  ) THEN
    RAISE EXCEPTION 'Nicht Host dieser aktiven Session'
      USING ERRCODE = '42501';
  END IF;

  IF v_host = p_user_id THEN
    RAISE EXCEPTION 'Kann dich nicht selbst timeouten' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_chat_timeouts (session_id, user_id, until_at, reason)
  VALUES (p_session_id, p_user_id, v_until, p_reason)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET until_at = GREATEST(live_chat_timeouts.until_at, EXCLUDED.until_at),
        reason   = COALESCE(EXCLUDED.reason, live_chat_timeouts.reason)
  RETURNING until_at INTO v_result;

  RETURN v_result;
END;
$$;

-- Host hebt Timeout wieder auf
CREATE OR REPLACE FUNCTION public.untimeout_chat_user(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid := auth.uid();
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
     WHERE id = p_session_id
       AND host_id = v_host
  ) THEN
    RAISE EXCEPTION 'Nicht Host dieser Session'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.live_chat_timeouts
   WHERE session_id = p_session_id
     AND user_id    = p_user_id;
END;
$$;

-- Host setzt Slow-Mode. `p_seconds = 0` deaktiviert ihn.
CREATE OR REPLACE FUNCTION public.set_live_slow_mode(
  p_session_id uuid,
  p_seconds    int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid := auth.uid();
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_seconds < 0 OR p_seconds > 300 THEN
    RAISE EXCEPTION 'Slow-Mode muss zwischen 0 und 300s liegen'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_sessions
     SET slow_mode_seconds = p_seconds
   WHERE id = p_session_id
     AND host_id = v_host
     AND status  = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nicht Host dieser aktiven Session'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.timeout_chat_user(uuid, uuid, int, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.untimeout_chat_user(uuid, uuid)          FROM public, anon;
REVOKE ALL ON FUNCTION public.set_live_slow_mode(uuid, int)            FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.timeout_chat_user(uuid, uuid, int, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.untimeout_chat_user(uuid, uuid)          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.set_live_slow_mode(uuid, int)            TO authenticated;

-- ─── 5. Verifikations-Snippets ────────────────────────────────────
-- -- Als Host: User für 5min timeouten:
-- SELECT timeout_chat_user('<session-id>', '<user-id>', 300, 'Spam');
-- -- Slow-Mode auf 3s setzen:
-- SELECT set_live_slow_mode('<session-id>', 3);
-- -- Timeout aufheben:
-- SELECT untimeout_chat_user('<session-id>', '<user-id>');
