-- ============================================================================
-- 20260418090000_live_duet_invites.sql
--
-- v1.19.0 — Duett-System.
--
-- Erweitert das bestehende Multi-Guest-System (`live_cohosts`) um einen
-- bidirektionalen Invite-Flow:
--
--   • Host → Viewer  ("host-to-viewer")  — Host lädt gezielt EINEN Viewer ein
--   • Viewer → Host  ("viewer-to-host")  — bestehende Request-Queue, jetzt
--                                           persistiert für History/Analytics
--
-- Der Accept-Pfad nutzt intern `approve_cohost()` — der Duett-Gast ist
-- technisch ein Co-Host mit slot_index 0. Nach dem Duett wird automatisch
-- ein Row in `live_duet_history` geschrieben (Triggers).
-- ============================================================================

-- ─── live_duet_invites (ephemer, Lifecycle einer Einladung) ─────────────────
CREATE TABLE IF NOT EXISTS public.live_duet_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_id         UUID NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  invitee_id      UUID NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,

  -- Wer hat die Einladung ausgelöst?
  direction       TEXT NOT NULL
                    CHECK (direction IN ('host-to-viewer', 'viewer-to-host')),

  -- Gewünschtes Duett-Layout
  layout          TEXT NOT NULL DEFAULT 'side-by-side'
                    CHECK (layout IN ('top-bottom', 'side-by-side', 'pip', 'battle')),

  -- Optional für Battle-Layout
  battle_duration INT CHECK (battle_duration IS NULL OR battle_duration BETWEEN 30 AND 600),

  -- Optionale Nachricht (z.B. "Komm ins Duett, Battle um Coins")
  message         TEXT CHECK (message IS NULL OR char_length(message) <= 200),

  -- Status-Flow
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  decline_reason  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 seconds',
  responded_at    TIMESTAMPTZ
);

-- Pro Session + Invitee darf immer nur EIN pending Invite offen sein
CREATE UNIQUE INDEX IF NOT EXISTS uq_duet_invites_pending
  ON public.live_duet_invites(session_id, invitee_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_duet_invites_host_pending
  ON public.live_duet_invites(host_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_duet_invites_invitee_pending
  ON public.live_duet_invites(invitee_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_duet_invites_expires
  ON public.live_duet_invites(expires_at)
  WHERE status = 'pending';

-- ─── live_duet_history (persistent, für Analytics + „Meine Duette") ────────
CREATE TABLE IF NOT EXISTS public.live_duet_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_id           UUID NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  guest_id          UUID NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,

  -- Wer hat initiert?
  initiated_by      TEXT NOT NULL
                      CHECK (initiated_by IN ('host', 'guest')),

  -- Welches Layout lief
  layout            TEXT NOT NULL
                      CHECK (layout IN ('top-bottom', 'side-by-side', 'pip', 'battle', 'grid-2x2', 'grid-3x3')),

  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  duration_secs     INT,

  -- Aggregierte Stats (können später nachgerechnet werden)
  gift_coins_total  INT NOT NULL DEFAULT 0,
  end_reason        TEXT
                      CHECK (end_reason IS NULL OR end_reason IN (
                        'host-ended', 'guest-left', 'kicked', 'session-ended', 'disconnect'
                      ))
);

CREATE INDEX IF NOT EXISTS idx_duet_history_host
  ON public.live_duet_history(host_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_duet_history_guest
  ON public.live_duet_history(guest_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_duet_history_session
  ON public.live_duet_history(session_id);

-- Ein Paar darf innerhalb einer Session mehrfach duetten (Re-Join);
-- wir identifizieren eine Duett-Episode über session_id + guest_id + started_at.

-- ─── RLS: live_duet_invites ─────────────────────────────────────────────────
ALTER TABLE public.live_duet_invites ENABLE ROW LEVEL SECURITY;

-- Beide beteiligten Parteien sehen den Invite
DROP POLICY IF EXISTS "duet_invites_select_participants" ON public.live_duet_invites;
CREATE POLICY "duet_invites_select_participants"
  ON public.live_duet_invites FOR SELECT
  USING (auth.uid() = host_id OR auth.uid() = invitee_id);

-- Direkter INSERT ist nicht erlaubt — nur via RPC `create_duet_invite`.
-- Direkter UPDATE/DELETE auch nicht — nur via RPCs `respond_duet_invite` +
-- `cancel_duet_invite` + `expire_duet_invites` (SECURITY DEFINER).

-- ─── RLS: live_duet_history ─────────────────────────────────────────────────
ALTER TABLE public.live_duet_history ENABLE ROW LEVEL SECURITY;

-- Beide Beteiligten sehen eigene Duette
DROP POLICY IF EXISTS "duet_history_select_participants" ON public.live_duet_history;
CREATE POLICY "duet_history_select_participants"
  ON public.live_duet_history FOR SELECT
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- Write only via Trigger (SECURITY DEFINER); keine Client-Policies nötig.

-- ─── RPC: Invite erstellen ─────────────────────────────────────────────────
-- Beide Richtungen über eine Funktion — Caller-Check bestimmt direction.
CREATE OR REPLACE FUNCTION public.create_duet_invite(
  p_session_id      UUID,
  p_invitee_id      UUID,
  p_layout          TEXT DEFAULT 'side-by-side',
  p_battle_duration INT  DEFAULT NULL,
  p_message         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_host        UUID;
  v_session_status TEXT;
  v_direction   TEXT;
  v_invite_id   UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Session + Host laden
  SELECT host_id, status INTO v_host, v_session_status
    FROM public.live_sessions WHERE id = p_session_id;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_session_status <> 'active' THEN
    RAISE EXCEPTION 'Session ist nicht aktiv' USING ERRCODE = '22023';
  END IF;

  -- Richtung bestimmen
  IF v_caller = v_host THEN
    -- Host lädt Viewer ein
    IF p_invitee_id = v_host THEN
      RAISE EXCEPTION 'Host kann sich nicht selbst einladen' USING ERRCODE = '22023';
    END IF;
    v_direction := 'host-to-viewer';
  ELSIF v_caller = p_invitee_id THEN
    -- Viewer fragt Host um Duett an (invitee_id = Viewer-ID = caller)
    v_direction := 'viewer-to-host';
  ELSE
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;

  -- Block-Check: wenn Host den Viewer geblockt hat, kein Invite möglich
  IF public.is_cohost_blocked(v_host, p_invitee_id) THEN
    RAISE EXCEPTION 'User ist für Duette geblockt' USING ERRCODE = '42501';
  END IF;

  -- Alte pending Invites expiren (damit unique-index nicht knallt)
  UPDATE public.live_duet_invites
     SET status = 'expired', responded_at = NOW()
   WHERE session_id = p_session_id
     AND invitee_id = p_invitee_id
     AND status = 'pending';

  -- Invite anlegen
  INSERT INTO public.live_duet_invites (
    session_id, host_id, invitee_id, direction,
    layout, battle_duration, message
  ) VALUES (
    p_session_id, v_host, p_invitee_id, v_direction,
    COALESCE(p_layout, 'side-by-side'),
    CASE WHEN p_layout = 'battle' THEN COALESCE(p_battle_duration, 60) ELSE NULL END,
    p_message
  )
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

-- ─── RPC: Invite beantworten (Accept/Decline) ──────────────────────────────
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
  v_caller    UUID := auth.uid();
  v_invite    public.live_duet_invites%ROWTYPE;
  v_slot      INT;
  v_active_cnt INT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_invite FROM public.live_duet_invites WHERE id = p_invite_id;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  -- Nur der Adressat darf antworten:
  --   host-to-viewer → invitee_id beantwortet
  --   viewer-to-host → host_id beantwortet
  IF v_invite.direction = 'host-to-viewer' AND v_caller <> v_invite.invitee_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;
  IF v_invite.direction = 'viewer-to-host' AND v_caller <> v_invite.host_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite nicht mehr offen (Status: %)', v_invite.status
      USING ERRCODE = '22023';
  END IF;

  IF v_invite.expires_at <= NOW() THEN
    UPDATE public.live_duet_invites
       SET status = 'expired', responded_at = NOW()
     WHERE id = p_invite_id;
    RAISE EXCEPTION 'Invite ist abgelaufen' USING ERRCODE = '22023';
  END IF;

  IF p_accept THEN
    -- Accept: direkt Co-Host whitelisten. Wir duplizieren die Slot-Logik
    -- aus approve_cohost inline (weil auth.uid() hier der Invitee ist,
    -- nicht der Host — approve_cohost würde mit 42501 scheitern).

    -- Kapazitäts-Check (max 8 aktive Co-Hosts, ohne den Inviter selbst)
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

-- ─── RPC: Invite abbrechen (Sender zieht zurück) ───────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_duet_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_invite public.live_duet_invites%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_invite FROM public.live_duet_invites WHERE id = p_invite_id;
  IF v_invite.id IS NULL THEN RETURN; END IF;

  -- Sender = host bei host-to-viewer; invitee bei viewer-to-host
  IF v_invite.direction = 'host-to-viewer' AND v_caller <> v_invite.host_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;
  IF v_invite.direction = 'viewer-to-host' AND v_caller <> v_invite.invitee_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_duet_invites
     SET status = 'cancelled', responded_at = NOW()
   WHERE id = p_invite_id AND status = 'pending';
END;
$$;

-- ─── RPC: Abgelaufene Invites aufräumen (Client-seitig periodisch) ─────────
CREATE OR REPLACE FUNCTION public.expire_duet_invites()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  UPDATE public.live_duet_invites
     SET status = 'expired', responded_at = NOW()
   WHERE status = 'pending' AND expires_at <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Trigger: Bei Co-Host Revoke → History-Row schließen ───────────────────
CREATE OR REPLACE FUNCTION public._close_duet_history_on_revoke()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND (OLD.revoked_at IS NULL) THEN
    UPDATE public.live_duet_history
       SET ended_at      = NEW.revoked_at,
           duration_secs = GREATEST(0, EXTRACT(EPOCH FROM (NEW.revoked_at - started_at))::INT),
           end_reason    = COALESCE(end_reason, 'host-ended')
     WHERE session_id = NEW.session_id
       AND guest_id   = NEW.user_id
       AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_duet_history_on_revoke ON public.live_cohosts;
CREATE TRIGGER trg_close_duet_history_on_revoke
  AFTER UPDATE ON public.live_cohosts
  FOR EACH ROW
  EXECUTE FUNCTION public._close_duet_history_on_revoke();

-- Session beendet → offene History-Rows schließen
CREATE OR REPLACE FUNCTION public._close_duet_history_on_session_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ended' AND (OLD.status IS DISTINCT FROM 'ended') THEN
    UPDATE public.live_duet_history
       SET ended_at      = COALESCE(ended_at, NOW()),
           duration_secs = COALESCE(duration_secs, GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::INT)),
           end_reason    = COALESCE(end_reason, 'session-ended')
     WHERE session_id = NEW.id
       AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_duet_history_on_session_end ON public.live_sessions;
CREATE TRIGGER trg_close_duet_history_on_session_end
  AFTER UPDATE ON public.live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public._close_duet_history_on_session_end();

-- ─── Grants ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_duet_invite(UUID, UUID, TEXT, INT, TEXT)  FROM public, anon;
REVOKE ALL ON FUNCTION public.respond_duet_invite(UUID, BOOLEAN, TEXT)          FROM public, anon;
REVOKE ALL ON FUNCTION public.cancel_duet_invite(UUID)                          FROM public, anon;
REVOKE ALL ON FUNCTION public.expire_duet_invites()                             FROM public, anon;

GRANT EXECUTE ON FUNCTION public.create_duet_invite(UUID, UUID, TEXT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_duet_invite(UUID, BOOLEAN, TEXT)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_duet_invite(UUID)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_duet_invites()                           TO authenticated, anon;

-- ─── Realtime ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_duet_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_duet_invites;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
