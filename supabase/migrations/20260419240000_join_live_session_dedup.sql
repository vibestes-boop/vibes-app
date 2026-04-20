-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — join_live_session Dedup (Viewer-Count-Inflation-Schutz)
-- Datum: 2026-04-19
-- Audit-Finding: Phase 2 #8 (3.5 im Audit)
--
-- PROBLEM:
-- Aktuelle join_live_session() RPC (supabase/live_studio.sql:93–103) ist
-- `SECURITY INVOKER` und inkrementiert viewer_count **ohne** Dedup.
-- Angriff: Bot kann mit bekannter session_id 10'000× aufrufen → fake
-- Viewer-Count → Feed-Ranking-Manipulation (viewer_count fließt indirekt
-- in algorithm_v4 Scoring).
--
-- FIX (minimal-invasiv):
-- 1) Neue Tabelle `live_session_viewers(session_id, user_id)` mit PK-Dedup.
-- 2) RLS: Reader/Writer nur für eigenen auth.uid() Eintrag.
-- 3) RPCs neu: INSERT ON CONFLICT DO NOTHING + bedingtes Inc/Dec.
-- 4) ON DELETE CASCADE von live_sessions → bei session-end weg.
-- 5) Auth-Guard: anon-Nutzer können nicht mehr joinen.
--
-- NICHT-GOAL (spätere Phase): Full-Presence via LiveKit-Participants als
-- Source-of-Truth. Hier bleibt DB-Counter + Upsert-Log, das ist ausreichend
-- gegen das konkrete Inflation-Attack-Szenario.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Tabelle für aktive Viewer (per Session dedupliziert)
CREATE TABLE IF NOT EXISTS public.live_session_viewers (
  session_id  UUID        NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_session_viewers_session
  ON public.live_session_viewers(session_id);

CREATE INDEX IF NOT EXISTS idx_live_session_viewers_user_joined
  ON public.live_session_viewers(user_id, joined_at DESC);

-- 2) RLS
ALTER TABLE public.live_session_viewers ENABLE ROW LEVEL SECURITY;

-- Host der Session darf alle Viewer seiner Session sehen (z.B. für Moderator-UIs)
DROP POLICY IF EXISTS "lsv_select_host" ON public.live_session_viewers;
CREATE POLICY "lsv_select_host" ON public.live_session_viewers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
      WHERE s.id = session_id
        AND s.host_id = auth.uid()
    )
  );

-- User darf den eigenen Eintrag sehen
DROP POLICY IF EXISTS "lsv_select_self" ON public.live_session_viewers;
CREATE POLICY "lsv_select_self" ON public.live_session_viewers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Kein direkter INSERT/DELETE via RLS — alles läuft über SECURITY DEFINER RPCs

-- 3) join_live_session neu — SECURITY DEFINER, Auth-Guard, Dedup
CREATE OR REPLACE FUNCTION public.join_live_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_inserted INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- Session muss existieren + active sein
  PERFORM 1 FROM public.live_sessions
   WHERE id = p_session_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN;  -- stilles No-Op statt Fehler (Viewer kann sich später reconnecten)
  END IF;

  -- Upsert-Dedup: erster Join-Call fügt Row ein, alle folgenden sind No-Op
  INSERT INTO public.live_session_viewers (session_id, user_id)
  VALUES (p_session_id, v_user_id)
  ON CONFLICT (session_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;  -- 1 = neu, 0 = schon drin

  -- Nur wenn tatsächlich neu: Counter inkrementieren
  IF v_inserted > 0 THEN
    UPDATE public.live_sessions
    SET
      viewer_count = viewer_count + 1,
      peak_viewers = GREATEST(peak_viewers, viewer_count + 1)
    WHERE id = p_session_id AND status = 'active';
  END IF;
END;
$$;

-- 4) leave_live_session neu — Dedup: nur wenn zuvor joined
CREATE OR REPLACE FUNCTION public.leave_live_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  DELETE FROM public.live_session_viewers
   WHERE session_id = p_session_id AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    UPDATE public.live_sessions
    SET viewer_count = GREATEST(0, viewer_count - 1)
    WHERE id = p_session_id AND status = 'active';
  END IF;
END;
$$;

-- GRANT (SECURITY DEFINER muss explizit granted werden wegen search_path-Reset)
GRANT EXECUTE ON FUNCTION public.join_live_session(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_live_session(UUID) TO authenticated;

-- Alter Invoker-basierter Aufruf (anon) explizit revoken falls er Rest-Grants hat
REVOKE EXECUTE ON FUNCTION public.join_live_session(UUID)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_live_session(UUID) FROM anon;

-- 5) Session-End Cleanup: Wenn Session auf 'ended' wechselt, Viewers wegräumen
-- (zusätzlich zu ON DELETE CASCADE — dieser Trigger greift bei UPDATE status='ended')
CREATE OR REPLACE FUNCTION public._purge_live_session_viewers_on_end()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ended' AND OLD.status <> 'ended' THEN
    DELETE FROM public.live_session_viewers WHERE session_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_live_session_viewers_on_end ON public.live_sessions;
CREATE TRIGGER trg_purge_live_session_viewers_on_end
  AFTER UPDATE OF status ON public.live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public._purge_live_session_viewers_on_end();

-- 6) Optional: live_session_viewers Presence-Count-View (nützlich für Debugging)
-- Zeigt aktuelle Viewer pro Session, kann vom Host-Dashboard konsumiert werden.
CREATE OR REPLACE VIEW public.live_session_viewer_counts AS
SELECT
  session_id,
  COUNT(*) AS active_viewers,
  MAX(joined_at) AS last_join
FROM public.live_session_viewers
GROUP BY session_id;

GRANT SELECT ON public.live_session_viewer_counts TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✅ live_session_viewers Tabelle + dedupe RPCs + Session-End-Trigger angelegt';
END $$;
