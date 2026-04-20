-- ================================================================
-- v1.16.0 — Battle-History Persistenz
-- ================================================================
-- Speichert jedes beendete Battle mit Scores + Winner für:
--   1. Profil-Display: „Battles: 42 gewonnen · 8 verloren · 3 unentschieden"
--   2. Leaderboards / Stats (Zukunft)
--   3. Anti-Abuse-Analyse (wiederkehrende Opponenten)
-- ================================================================

-- ─── 1. Tabelle ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_battle_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_id       uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  guest_id      uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  host_score    int         NOT NULL DEFAULT 0 CHECK (host_score  >= 0),
  guest_score   int         NOT NULL DEFAULT 0 CHECK (guest_score >= 0),
  winner        text        NOT NULL CHECK (winner IN ('host','guest','draw')),
  duration_secs int         NOT NULL DEFAULT 0 CHECK (duration_secs >= 0),
  ended_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_battle CHECK (host_id <> guest_id)
);

-- Profil-Query („alle Battles von User X") bleibt O(log n) mit Indexen.
-- Beide IDs indexiert, weil wir sowohl „als Host" als auch „als Guest" aggregieren.
CREATE INDEX IF NOT EXISTS idx_battle_history_host
  ON public.live_battle_history (host_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS idx_battle_history_guest
  ON public.live_battle_history (guest_id, ended_at DESC);

-- ─── 2. RLS ──────────────────────────────────────────────────────
ALTER TABLE public.live_battle_history ENABLE ROW LEVEL SECURITY;

-- Alle authenticated dürfen lesen (öffentliche W-L-Bilanz wie bei Sport-Athleten)
DROP POLICY IF EXISTS "battle_history_select_all" ON public.live_battle_history;
CREATE POLICY "battle_history_select_all" ON public.live_battle_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Kein direktes INSERT vom Client — nur via SECURITY DEFINER RPC (finalize_battle)
-- damit Scores nicht gefälscht werden können.

-- ─── 3. RPC: Host finalisiert ein Battle ──────────────────────────
-- Wird von useBattle.endBattle() aufgerufen wenn der Timer abläuft ODER
-- der Host manuell „Force-End" drückt. Überschreibt NICHT bestehende
-- Einträge — wenn das Battle schon finalisiert wurde, wirft es ein Warning.
CREATE OR REPLACE FUNCTION public.finalize_battle(
  p_session_id    uuid,
  p_guest_id      uuid,
  p_host_score    int,
  p_guest_score   int,
  p_duration_secs int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host        uuid := auth.uid();
  v_winner      text;
  v_id          uuid;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Guards
  IF p_host_score < 0 OR p_guest_score < 0 OR p_duration_secs < 0 THEN
    RAISE EXCEPTION 'Scores und Dauer müssen >= 0 sein' USING ERRCODE = '22023';
  END IF;

  IF v_host = p_guest_id THEN
    RAISE EXCEPTION 'Host und Guest können nicht identisch sein' USING ERRCODE = '22023';
  END IF;

  -- Nur der Host der Session darf finalisieren
  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
     WHERE id = p_session_id
       AND host_id = v_host
  ) THEN
    RAISE EXCEPTION 'Nicht Host dieser Session' USING ERRCODE = '42501';
  END IF;

  -- Winner berechnen (Ties = draw)
  v_winner := CASE
    WHEN p_host_score > p_guest_score THEN 'host'
    WHEN p_guest_score > p_host_score THEN 'guest'
    ELSE 'draw'
  END;

  -- Idempotent: wenn das Battle für diese Session+Paarung schon existiert,
  -- einfach zurückgeben (verhindert Duplikate bei Retry/Netzwerk-Wackler).
  SELECT id INTO v_id
    FROM public.live_battle_history
   WHERE session_id = p_session_id
     AND host_id    = v_host
     AND guest_id   = p_guest_id
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.live_battle_history (
    session_id, host_id, guest_id,
    host_score, guest_score, winner, duration_secs
  )
  VALUES (
    p_session_id, v_host, p_guest_id,
    p_host_score, p_guest_score, v_winner, p_duration_secs
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── 4. View: Battle-Stats pro User ──────────────────────────────
-- Aggregiert W/L/D sowohl als Host als auch als Guest.
-- Wird via useBattleStats(userId) vom Profil-Screen gelesen.
CREATE OR REPLACE VIEW public.user_battle_stats AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE result = 'win')  AS wins,
  COUNT(*) FILTER (WHERE result = 'loss') AS losses,
  COUNT(*) FILTER (WHERE result = 'draw') AS draws,
  COUNT(*)                                AS total_battles
FROM (
  -- Als Host
  SELECT
    host_id AS user_id,
    CASE WHEN winner = 'host' THEN 'win'
         WHEN winner = 'draw' THEN 'draw'
         ELSE 'loss' END AS result
  FROM public.live_battle_history
  UNION ALL
  -- Als Guest
  SELECT
    guest_id AS user_id,
    CASE WHEN winner = 'guest' THEN 'win'
         WHEN winner = 'draw'  THEN 'draw'
         ELSE 'loss' END AS result
  FROM public.live_battle_history
) x
GROUP BY user_id;

-- View muss für authenticated lesbar sein
GRANT SELECT ON public.user_battle_stats TO authenticated;

REVOKE ALL ON FUNCTION public.finalize_battle(uuid, uuid, int, int, int) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.finalize_battle(uuid, uuid, int, int, int) TO authenticated;

-- ─── 5. Verifikations-Snippets ────────────────────────────────────
-- -- Host beendet Battle:
-- SELECT finalize_battle('<session-id>', '<guest-id>', 3200, 2100, 300);
-- -- Stats für mich:
-- SELECT * FROM user_battle_stats WHERE user_id = auth.uid();
-- -- Letzte 10 Battles global:
-- SELECT * FROM live_battle_history ORDER BY ended_at DESC LIMIT 10;
