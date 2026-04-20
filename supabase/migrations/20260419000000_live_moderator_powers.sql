-- ================================================================
-- v1.23.0 — Live-Moderator-Powers
-- ================================================================
-- In v1.22.3 haben wir das Moderator-System eingeführt (Host kann
-- einzelne Viewer als Mods für seine Session markieren). Bis hierher
-- war die Rolle aber nur ein kosmetisches Badge — die eigentlichen
-- Moderations-RPCs (timeout_chat_user, untimeout_chat_user,
-- set_live_slow_mode) prüften weiterhin strikt auf `host_id = v_host`.
--
-- Diese Migration erweitert das um ECHTE Mod-Befugnisse:
--
--   1. Helper `is_live_session_moderator(session, user)` — zentrale
--      Lookup-Funktion (SECURITY DEFINER, damit RLS nicht kollidiert).
--
--   2. timeout_chat_user / untimeout_chat_user / set_live_slow_mode
--      erlauben jetzt Host ODER Session-Mod. Self-Timeout-Schutz bleibt
--      aber erhalten, und Mods können den Host nicht timeouten.
--
--   3. Neue RPCs `pin_live_comment` + `unpin_live_comment` (SECURITY
--      DEFINER, Host+Mod-gated). Der direkte UPDATE-Pfad aus
--      `usePinComment()` bleibt für den Host funktional (via RLS),
--      wird aber in der nächsten App-Version auf RPC umgestellt.
--
-- Deletions (live_comments) bleiben vorerst clientseitig (Broadcast),
-- weil DB-RLS nur dem Autor schreibenden Zugriff erlaubt und wir die
-- persistenten Chat-Zeilen so oder so aus der Realtime-Query heraushalten
-- — ein Mod-Delete wird in einer späteren Migration mit einem eigenen
-- live_comment_deletions-Audit-Log nachgerüstet.
-- ================================================================

-- ─── 1. Helper: is_live_session_moderator ────────────────────────
-- Liefert TRUE, wenn `p_user_id` in `live_moderators` für die Session
-- hinterlegt ist. SECURITY DEFINER umgeht die Select-Policy nicht
-- (die ist `USING (true)`), aber macht den Aufruf aus anderen
-- SECURITY-DEFINER-Funktionen deterministisch.
CREATE OR REPLACE FUNCTION public.is_live_session_moderator(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.live_moderators m
     WHERE m.session_id = p_session_id
       AND m.user_id    = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_live_session_moderator(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_live_session_moderator(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.is_live_session_moderator(uuid, uuid) IS
  'Prüft, ob ein User Session-Moderator einer live_sessions-Zeile ist.';


-- ─── 2. timeout_chat_user — Host ODER Mod ───────────────────────
-- Preserves all prior validation (duration bounds, active-session check,
-- no-self-timeout) and ADDITIONALLY refuses Mod→Host timeouts.
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
  v_caller  uuid        := auth.uid();
  v_host    uuid;
  v_is_mod  boolean     := false;
  v_until   timestamptz := now() + make_interval(secs => p_seconds);
  v_result  timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_seconds <= 0 OR p_seconds > 86400 THEN
    RAISE EXCEPTION 'Timeout-Dauer muss zwischen 1s und 24h liegen'
      USING ERRCODE = '22023';
  END IF;

  -- Session laden + aktive Validierung
  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
     AND status = 'active'
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden oder nicht aktiv'
      USING ERRCODE = '42501';
  END IF;

  -- Berechtigung: Host ODER Mod
  IF v_caller <> v_host THEN
    v_is_mod := public.is_live_session_moderator(p_session_id, v_caller);
    IF NOT v_is_mod THEN
      RAISE EXCEPTION 'Nicht Host oder Moderator dieser Session'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Self-Timeout blockieren
  IF v_caller = p_user_id THEN
    RAISE EXCEPTION 'Kann dich nicht selbst timeouten' USING ERRCODE = '22023';
  END IF;

  -- Mods dürfen den Host NICHT timeouten
  IF v_is_mod AND p_user_id = v_host THEN
    RAISE EXCEPTION 'Moderatoren können den Host nicht timeouten'
      USING ERRCODE = '42501';
  END IF;

  -- Mods dürfen andere Mods NICHT timeouten (nur der Host darf das)
  IF v_is_mod AND public.is_live_session_moderator(p_session_id, p_user_id) THEN
    RAISE EXCEPTION 'Moderatoren können andere Moderatoren nicht timeouten'
      USING ERRCODE = '42501';
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


-- ─── 3. untimeout_chat_user — Host ODER Mod ─────────────────────
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

  DELETE FROM public.live_chat_timeouts
   WHERE session_id = p_session_id
     AND user_id    = p_user_id;
END;
$$;


-- ─── 4. set_live_slow_mode — Host ODER Mod ──────────────────────
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
  v_caller uuid := auth.uid();
  v_host   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_seconds < 0 OR p_seconds > 300 THEN
    RAISE EXCEPTION 'Slow-Mode muss zwischen 0 und 300s liegen'
      USING ERRCODE = '22023';
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

  UPDATE public.live_sessions
     SET slow_mode_seconds = p_seconds
   WHERE id = p_session_id;
END;
$$;


-- ─── 5. pin_live_comment — NEU, Host ODER Mod ───────────────────
-- Setzt `live_sessions.pinned_comment` auf das übergebene JSON. Wird
-- vom Client für beide Rollen verwendet; der bestehende direkte
-- UPDATE-Pfad aus `usePinComment()` bleibt als Host-Fallback über
-- RLS funktional, aber neuere Clients sollen ausschließlich diese RPC
-- nutzen (damit Mods pinnen können).
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
  v_caller uuid := auth.uid();
  v_host   uuid;
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

  UPDATE public.live_sessions
     SET pinned_comment = p_comment
   WHERE id = p_session_id;
END;
$$;


-- ─── 6. unpin_live_comment — NEU, Host ODER Mod ─────────────────
-- Convenience-Wrapper: setzt pinned_comment auf NULL.
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

  UPDATE public.live_sessions
     SET pinned_comment = NULL
   WHERE id = p_session_id;
END;
$$;


-- ─── 7. Permissions ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.pin_live_comment(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unpin_live_comment(uuid)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pin_live_comment(uuid, jsonb) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.unpin_live_comment(uuid)      TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ v1.23 live_moderator_powers deployed (helper + 3 extended RPCs + 2 new pin RPCs)';
END $$;


-- ─── 8. Verifikations-Snippets ───────────────────────────────────
-- SELECT public.is_live_session_moderator('<session>', '<user>');
-- SELECT public.timeout_chat_user('<session>', '<user>', 60, 'Test');
-- SELECT public.pin_live_comment('<session>', '{"id":"abc","text":"Hi"}'::jsonb);
-- SELECT public.unpin_live_comment('<session>');
