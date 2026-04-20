-- ============================================================================
-- 20260418120000_duet_race_fix.sql
--
-- v1.19.0 — Hot-Fix: Race-Condition + Idempotenz in respond_duet_invite.
--
-- Problem 1 (KRITISCH):
--   respond_duet_invite las den Invite OHNE Row-Lock. Bei zwei gleichzeitigen
--   Accept-Calls (Doppel-Tap, zweiter Client, Re-Submit nach flakiger
--   Netzwerk-Antwort) können BEIDE Transaktionen den Invite als 'pending'
--   sehen → beide schreiben eine history-Row und versuchen den cohost-INSERT.
--   Der ON CONFLICT fängt den zweiten cohost-INSERT ab, aber die history-
--   Einträge sind dupliziert.
--
-- Problem 2 (WICHTIG):
--   Wenn der Client den RPC retried (z.B. nach Timeout), sieht er aktuell
--   eine 22023 "Invite nicht mehr offen" und der UI-Flow ist kaputt, obwohl
--   der Accept bereits durchgegangen ist. Wir wollen den bereits-akzeptierten
--   Fall idempotent zurückgeben (gleiches Result wie beim ersten Call).
--
-- Fix:
--   • SELECT … FOR UPDATE serialisiert konkurrierende Calls auf derselben
--     Invite-Row. Die zweite Transaktion sieht nach dem Lock den Status als
--     'accepted' und geht in den idempotenten Zweig.
--   • Idempotenz: accept auf bereits-akzeptiertem Invite durch den richtigen
--     Adressaten → return the same tuple (no-op).
--     Decline auf bereits-declined Invite → no-op mit declined-Response.
--     Alles andere (expired/cancelled, falscher Caller) → weiterhin Error.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.respond_duet_invite(
  p_invite_id UUID,
  p_accept    BOOLEAN,
  p_reason    TEXT DEFAULT NULL
)
RETURNS TABLE (
  status     TEXT,
  session_id UUID,
  host_id    UUID,
  guest_id   UUID,
  layout     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_invite     public.live_duet_invites%ROWTYPE;
  v_slot       INT;
  v_active_cnt INT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- ── Row-Lock: verhindert Race bei parallelen Accept/Decline ─────────
  SELECT * INTO v_invite
    FROM public.live_duet_invites
   WHERE id = p_invite_id
   FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  -- ── Autorisierung: Nur der Adressat darf antworten ──────────────────
  --   host-to-viewer → invitee_id beantwortet
  --   viewer-to-host → host_id beantwortet
  IF v_invite.direction = 'host-to-viewer' AND v_caller <> v_invite.invitee_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;
  IF v_invite.direction = 'viewer-to-host' AND v_caller <> v_invite.host_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;

  -- ── Idempotenz: wenn bereits abgeschlossen, passendes Ergebnis zurück ─
  IF v_invite.status = 'accepted' THEN
    IF p_accept THEN
      -- Retry desselben Calls → gleiches Tupel, no-op.
      RETURN QUERY SELECT 'accepted'::TEXT, v_invite.session_id, v_invite.host_id,
                          v_invite.invitee_id, v_invite.layout;
      RETURN;
    ELSE
      -- Accept ist durch, Decline kann nicht mehr nachgereicht werden.
      RAISE EXCEPTION 'Invite wurde bereits akzeptiert' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_invite.status = 'declined' THEN
    IF NOT p_accept THEN
      RETURN QUERY SELECT 'declined'::TEXT, v_invite.session_id, v_invite.host_id,
                          v_invite.invitee_id, v_invite.layout;
      RETURN;
    ELSE
      RAISE EXCEPTION 'Invite wurde bereits abgelehnt' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_invite.status IN ('expired', 'cancelled') THEN
    RAISE EXCEPTION 'Invite nicht mehr offen (Status: %)', v_invite.status
      USING ERRCODE = '22023';
  END IF;

  -- Ab hier: Status ist 'pending' und Row ist gelockt.

  IF v_invite.expires_at <= NOW() THEN
    UPDATE public.live_duet_invites
       SET status = 'expired', responded_at = NOW()
     WHERE id = p_invite_id;
    RAISE EXCEPTION 'Invite ist abgelaufen' USING ERRCODE = '22023';
  END IF;

  IF p_accept THEN
    -- Kapazitäts-Check (max 8 aktive Co-Hosts)
    SELECT COUNT(*) INTO v_active_cnt
      FROM public.live_cohosts
     WHERE session_id = v_invite.session_id
       AND revoked_at IS NULL;

    IF v_active_cnt >= 8 AND NOT EXISTS (
      SELECT 1 FROM public.live_cohosts
       WHERE session_id = v_invite.session_id
         AND user_id    = v_invite.invitee_id
         AND revoked_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Max. 8 Co-Hosts pro Session erreicht'
        USING ERRCODE = '22023', HINT = 'capacity';
    END IF;

    -- Kleinster freier slot_index (0..7)
    SELECT s.idx INTO v_slot
      FROM generate_series(0, 7) AS s(idx)
      LEFT JOIN public.live_cohosts lc
        ON lc.session_id = v_invite.session_id
       AND lc.slot_index = s.idx
       AND lc.revoked_at IS NULL
     WHERE lc.user_id IS NULL OR lc.user_id = v_invite.invitee_id
     ORDER BY s.idx
     LIMIT 1;

    IF v_slot IS NULL THEN v_slot := 0; END IF;

    INSERT INTO public.live_cohosts (session_id, user_id, invited_by, slot_index)
    VALUES (v_invite.session_id, v_invite.invitee_id, v_invite.host_id, v_slot)
    ON CONFLICT (session_id, user_id) DO UPDATE
      SET invited_by  = EXCLUDED.invited_by,
          approved_at = NOW(),
          revoked_at  = NULL,
          slot_index  = EXCLUDED.slot_index;

    UPDATE public.live_duet_invites
       SET status = 'accepted', responded_at = NOW()
     WHERE id = p_invite_id;

    -- History-Row eröffnen
    INSERT INTO public.live_duet_history (
      session_id, host_id, guest_id, initiated_by, layout
    ) VALUES (
      v_invite.session_id,
      v_invite.host_id,
      v_invite.invitee_id,
      CASE WHEN v_invite.direction = 'host-to-viewer' THEN 'host' ELSE 'guest' END,
      v_invite.layout
    );

    RETURN QUERY SELECT 'accepted'::TEXT, v_invite.session_id, v_invite.host_id,
                        v_invite.invitee_id, v_invite.layout;
  ELSE
    UPDATE public.live_duet_invites
       SET status = 'declined', responded_at = NOW(), decline_reason = p_reason
     WHERE id = p_invite_id;
    RETURN QUERY SELECT 'declined'::TEXT, v_invite.session_id, v_invite.host_id,
                        v_invite.invitee_id, v_invite.layout;
  END IF;
END;
$$;

-- Permissions bleiben identisch — CREATE OR REPLACE setzt sie nicht zurück,
-- aber zur Sicherheit explizit nochmal:
REVOKE ALL ON FUNCTION public.respond_duet_invite(UUID, BOOLEAN, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_duet_invite(UUID, BOOLEAN, TEXT) TO authenticated;
