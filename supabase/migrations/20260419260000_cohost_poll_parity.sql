-- ================================================================
-- v1.27.4 — CoHost-Poll-Parity
-- ================================================================
-- Problem (vor v1.27.4):
--   Die RLS-Policies auf `live_polls` waren strikt host-only:
--     INSERT:  auth.uid() = host_id AND session.host_id = auth.uid()
--     UPDATE:  auth.uid() = host_id
--     DELETE:  auth.uid() = host_id
--   Ein aktiver CoHost — gleichberechtigt auf der Bühne, mit Chat-Mod-
--   Autorität seit v1.27.2 — konnte keine Umfrage starten, schließen
--   oder löschen. Asymmetrie zur TikTok/Twitch-Referenz, wo beide
--   Co-Streamer interaktive Audience-Engagement-Tools kontrollieren.
--
-- Lösung:
--   Dieselben drei Policies so erweitern, dass entweder
--     (a) der User Haupthost der Session ist, ODER
--     (b) der User im Moderator-Kreis der Session ist — via
--         `is_live_session_moderator(session_id, auth.uid())`.
--
--   Der Helper wurde in v1.27.2 bereits erweitert und liefert TRUE
--   für aktive CoHosts (`live_cohosts.revoked_at IS NULL`) UND für
--   explizite Session-Mods (`live_moderators`). Dadurch greifen die
--   Poll-Rechte identisch zur Chat-Moderation — kein neuer Check,
--   kein zusätzlicher Helper, Single-Source-of-Truth bleibt.
--
-- Semantik von `host_id`:
--   Die Spalte heißt historisch `host_id`, wird aber ab v1.27.4 als
--   „Author-ID" verwendet (Wer-hat-die-Poll-erstellt). Kein Rename,
--   damit bestehende Hooks / Queries nicht brechen. Dokumentiert in
--   CLAUDE.md v1.27.4.
--
-- Warum kein RPC-Wrapper?
--   Die Poll-Erstellung läuft direkt via `.from('live_polls').insert()`
--   im Frontend (siehe `lib/useLivePolls.ts`). RLS ist die einzige
--   Security-Schicht — das ist okay weil die Validierungs-Checks
--   (question length, options array 2-4) bereits auf Spalten-Ebene
--   als CHECK-Constraints leben.
-- ================================================================

-- ─── INSERT: Author-ID == auth.uid() AND (Host ODER Moderator) ──

DROP POLICY IF EXISTS "live_polls_insert" ON public.live_polls;

CREATE POLICY "live_polls_insert"
  ON public.live_polls FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND (
      EXISTS (
        SELECT 1 FROM public.live_sessions s
         WHERE s.id = session_id AND s.host_id = auth.uid()
      )
      OR public.is_live_session_moderator(session_id, auth.uid())
    )
  );

-- ─── UPDATE: Author ODER Session-Host ODER Moderator ────────────
-- Author darf eigene Poll schließen. Session-Host + Moderatoren
-- (inkl. CoHost via v1.27.2-Helper) dürfen JEDE Poll dieser Session
-- schließen — wichtig für den „ein-aktiv-gleichzeitig"-Invariant:
-- wenn Host eine neue Poll startet während CoHost eine laufende hat,
-- muss der Close-Pre-Update-Call auch die CoHost-Poll schließen dürfen.

DROP POLICY IF EXISTS "live_polls_update" ON public.live_polls;

CREATE POLICY "live_polls_update"
  ON public.live_polls FOR UPDATE
  USING (
    auth.uid() = host_id
    OR EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = session_id AND s.host_id = auth.uid()
    )
    OR public.is_live_session_moderator(session_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = host_id
    OR EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = session_id AND s.host_id = auth.uid()
    )
    OR public.is_live_session_moderator(session_id, auth.uid())
  );

-- ─── DELETE: Author ODER Session-Host ODER Moderator ────────────

DROP POLICY IF EXISTS "live_polls_delete" ON public.live_polls;

CREATE POLICY "live_polls_delete"
  ON public.live_polls FOR DELETE
  USING (
    auth.uid() = host_id
    OR EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = session_id AND s.host_id = auth.uid()
    )
    OR public.is_live_session_moderator(session_id, auth.uid())
  );

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ v1.27.4 CoHost-Poll-Parity RLS deployed';
END $$;

-- ─── Test-Snippets (manuell) ────────────────────────────────────
-- Setup: Session S, Host H, CoHost C (aktiv in live_cohosts), Viewer V
--
-- Test 1: CoHost darf Poll anlegen
--   SET ROLE authenticated; SET request.jwt.claim.sub TO '<C>';
--   INSERT INTO public.live_polls (session_id, host_id, question, options)
--     VALUES ('<S>', '<C>', 'Wer gewinnt heute?',
--             '["Team Rot","Team Blau"]'::jsonb);
--   → Erfolg
--
-- Test 2: Viewer darf KEINE Poll anlegen
--   SET request.jwt.claim.sub TO '<V>';
--   INSERT ... host_id = '<V>' ...
--   → RLS-Verletzung
--
-- Test 3: CoHost kann Host-Poll schließen (new-active-Invariant)
--   SET request.jwt.claim.sub TO '<C>';
--   UPDATE public.live_polls SET closed_at = now()
--     WHERE session_id = '<S>' AND host_id = '<H>' AND closed_at IS NULL;
--   → Erfolg
--
-- Test 4: Ex-CoHost (revoked) darf KEINE Poll mehr anlegen
--   UPDATE public.live_cohosts SET revoked_at = now() WHERE ...;
--   SET request.jwt.claim.sub TO '<C>';
--   INSERT ...
--   → RLS-Verletzung (Helper gibt FALSE für revoked CoHost zurück)
