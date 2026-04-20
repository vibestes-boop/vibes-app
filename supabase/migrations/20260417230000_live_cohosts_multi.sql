-- ================================================================
-- Phase 3: Multi-Guest (bis zu 8 Co-Hosts pro Live)
-- ================================================================
-- Erweitert `live_cohosts` (aus 20260417020000_live_cohosts.sql) um
-- Ordering-Support, damit die UI eine stabile Grid-Reihenfolge hat.
--
-- Ein Host kann jetzt MEHRERE Co-Hosts gleichzeitig haben. Die
-- Token-Logik (Edge Function) prüft bereits pro User, ob er in der
-- Whitelist steht — damit funktioniert Multi-Guest ohne weitere
-- Server-Änderungen auf dem Auth-Layer.
--
-- `slot_index`:
--   - 0..7 = fester Grid-Platz
--   - Auto-vergabe: kleinster freier Index in der Session
--   - Hilft der Client-UI, Co-Hosts beim Rejoin an gleicher Position
--     zu zeigen (kein "Tanzen" in der Grid-Ansicht).
-- ================================================================

ALTER TABLE public.live_cohosts
  ADD COLUMN IF NOT EXISTS slot_index int NOT NULL DEFAULT 0
    CHECK (slot_index >= 0 AND slot_index <= 7);

COMMENT ON COLUMN public.live_cohosts.slot_index IS
  'Grid-Position in der Multi-Guest-UI (0..7). Beim Approve vergibt
   approve_cohost den kleinsten freien Slot automatisch.';

-- ─── approve_cohost erweitern: slot_index auto-vergeben ───────────
-- Ersetzt Version aus Phase 5 (20260417210000_live_cohost_blocks.sql).
CREATE OR REPLACE FUNCTION public.approve_cohost(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host       uuid := auth.uid();
  v_slot       int;
  v_active_cnt int;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
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

  -- Phase 5: Block-Check
  IF public.is_cohost_blocked(v_host, p_user_id) THEN
    RAISE EXCEPTION 'User ist blockiert — erst entblocken in den Einstellungen'
      USING ERRCODE = '42501', HINT = 'blocked';
  END IF;

  -- Phase 3: Kapazitäts-Check. Max 8 aktive Co-Hosts pro Session
  -- (9 Streams inkl. Host = TikTok Multi-Guest Limit).
  SELECT COUNT(*) INTO v_active_cnt
    FROM public.live_cohosts
   WHERE session_id = p_session_id
     AND revoked_at IS NULL;

  IF v_active_cnt >= 8 AND NOT EXISTS (
    -- Ausnahme: User ist schon drin (Update-Path bei Re-Approve)
    SELECT 1 FROM public.live_cohosts
     WHERE session_id = p_session_id
       AND user_id = p_user_id
       AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Max. 8 Co-Hosts pro Session erreicht'
      USING ERRCODE = '22023', HINT = 'capacity';
  END IF;

  -- Kleinster freier slot_index finden (0..7).
  -- generate_series liefert 0..7, LEFT JOIN zeigt freie Slots als NULL.
  SELECT s.idx INTO v_slot
    FROM generate_series(0, 7) AS s(idx)
    LEFT JOIN public.live_cohosts lc
      ON lc.session_id = p_session_id
     AND lc.slot_index = s.idx
     AND lc.revoked_at IS NULL
   WHERE lc.user_id IS NULL OR lc.user_id = p_user_id
   ORDER BY s.idx
   LIMIT 1;

  IF v_slot IS NULL THEN
    v_slot := 0; -- fallback (sollte nie passieren wegen Kapazitäts-Check oben)
  END IF;

  INSERT INTO public.live_cohosts (session_id, user_id, invited_by, slot_index)
  VALUES (p_session_id, p_user_id, v_host, v_slot)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET invited_by  = EXCLUDED.invited_by,
        approved_at = now(),
        revoked_at  = NULL,
        slot_index  = EXCLUDED.slot_index;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_cohost(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.approve_cohost(uuid, uuid) TO authenticated;

-- ─── Realtime für live_cohosts einschalten ────────────────────────
-- Damit Viewer neue Co-Hosts live sehen (ohne Polling).
-- Falls Publication bereits existiert → Fehler ignorieren.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_cohosts;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ─── Verifikations-Snippets ───────────────────────────────────────
-- -- Slots einer Session anzeigen:
-- SELECT user_id, slot_index, approved_at, revoked_at
--   FROM live_cohosts
--  WHERE session_id = '<session>'
--  ORDER BY slot_index;
--
-- -- Kapazität testen (9. User → Exception):
-- SELECT approve_cohost('<session>', '<user_9>');
