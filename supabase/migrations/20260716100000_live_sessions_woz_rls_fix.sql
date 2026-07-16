-- ─────────────────────────────────────────────────────────────────────────────
-- Women-Only-Lives waren für ALLE lesbar (WOZ-Audit 16.7.2026).
--
-- Ursache: Auf live_sessions lagen ZWEI permissive SELECT-Policies:
--   1) live_sessions_select                  USING (true)          ← Altbestand
--   2) live_sessions_select_with_women_only  USING (women_only=false OR host OR verified)
-- Postgres verknüpft permissive Policies mit OR → USING(true) gewann immer,
-- die women_only-Policy war wirkungslos. Die WOZ-Migration (20260414100000)
-- hatte nur "live_sessions are viewable by everyone" gedroppt, nicht
-- live_sessions_select.
--
-- Fix: Alt-Policy droppen; die strikte Policy deterministisch neu anlegen.
-- Nicht-WOZ-Lives bleiben für alle (auch anonym) lesbar — Verhalten der
-- öffentlichen /live-Liste ändert sich nur für women_only-Zeilen.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS live_sessions_select ON public.live_sessions;
DROP POLICY IF EXISTS live_sessions_select_with_women_only ON public.live_sessions;

CREATE POLICY live_sessions_select_with_women_only
  ON public.live_sessions
  FOR SELECT
  USING (
    women_only = false
    OR host_id = auth.uid()
    OR public.is_women_only_verified()
  );
