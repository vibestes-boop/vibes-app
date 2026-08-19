-- ─────────────────────────────────────────────────────────────────────────────
-- Frauen-Only: vier Kind-Tabellen erben die Schranke ihrer Session
--
-- ⚠️ SERLO-WEIT. Diese Migration ändert Lese-Policies auf Tabellen, die die
-- Serlo-App und Serlo-Web intensiv nutzen (22 Fundstellen). Sie ist am
-- 19.08.2026 bewusst eingespielt worden, obwohl Serlo noch keine echten Nutzer
-- hat — genau deshalb ist jetzt der richtige Zeitpunkt: Ein stiller Bruch
-- kostet heute nichts und nach dem Start alles.
--
-- DER BEFUND
-- `live_sessions` trägt `women_only`, und die Policy dort versteckt eine
-- geschützte Sendung vollständig. Vier ihrer Kind-Tabellen hatten aber
-- `USING (true)` — sie erbten nichts:
--
--   live_cohosts · live_polls · live_moderators · live_viewer_welcomes
--
-- Wer sie liest, sieht `session_id` + `user_id`, also DASS jemand in einer
-- bestimmten Sendung CoHost, Moderator oder Begrüßter war — auch wenn die
-- Sendung selbst unsichtbar ist. Kein Inhalts-Leck (Titel, Cover, Chat sind
-- geschützt), aber ein Metadaten-Leck über die Teilnahme an einem geschützten
-- Raum. In einer konservativen Gemeinschaft ist das nicht nichts.
--
-- Am 19.08.2026 mit dem öffentlichen anon-Schlüssel gemessen (HANDOFF 44):
-- **kein aktives Leck** — aber nur, weil es in der Datenbank kein einziges
-- Frauen-Only-Datum gibt. Der strukturelle Fehler war real und liest sich
-- direkt aus der Policy ab.
--
-- WARUM DAS RISIKO KLEIN IST
--   1. Die Formel unten ist NICHT neu — sie steht wortgleich auf
--      `live_reactions` und läuft dort seit Monaten in Serlo.
--   2. `session_id` ist in allen vier Tabellen NOT NULL. Es gibt keine
--      verwaisten Zeilen, die durch das Erben unsichtbar würden.
--   3. Nur SELECT wird angefasst. INSERT/UPDATE/DELETE bleiben unverändert —
--      auf `live_cohosts` und `live_polls` liegen dafür eigene Policies.
--
-- ⚠️ WAS SICH FÜR EINEN LESER ÄNDERT
-- Wer die Kind-Zeilen einer Sendung liest, die er selbst nicht sehen darf,
-- bekommt jetzt eine LEERE MENGE statt Daten — kein Fehler, keine Meldung.
-- Das ist die Falle aus HANDOFF 3 („PostgREST antwortet mit einer leeren Menge
-- statt einem Fehler"). Für öffentliche Sendungen ändert sich nichts, und nur
-- die sind heute in der Datenbank.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── live_cohosts ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS live_cohosts_select ON public.live_cohosts;
CREATE POLICY live_cohosts_select ON public.live_cohosts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_cohosts.session_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

-- ─── live_polls ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS live_polls_select ON public.live_polls;
CREATE POLICY live_polls_select ON public.live_polls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_polls.session_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

-- ─── live_moderators ─────────────────────────────────────────────────────────
-- Heißt historisch `p_live_moderators_select`; der Name bleibt, damit ein
-- späterer Leser ihn im Bestand wiederfindet.
DROP POLICY IF EXISTS p_live_moderators_select ON public.live_moderators;
CREATE POLICY p_live_moderators_select ON public.live_moderators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_moderators.session_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

-- ─── live_viewer_welcomes ────────────────────────────────────────────────────
DROP POLICY IF EXISTS live_viewer_welcomes_read_all ON public.live_viewer_welcomes;
CREATE POLICY live_viewer_welcomes_read_all ON public.live_viewer_welcomes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_viewer_welcomes.session_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

-- ─── Gegenprobe ──────────────────────────────────────────────────────────────
-- 1. Öffentliche Sendungen unverändert lesbar (die Zahlen vom 19.08.2026):
--      -- als anon:
--      SELECT count(*) FROM live_cohosts;  -- war 15, muss 15 bleiben
--      SELECT count(*) FROM live_polls;    -- war 12, muss 12 bleiben
--
-- 2. Keine schrankenlose Policy mehr auf session-gebundenen Tabellen:
--      SELECT c.relname, p.polname
--        FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--       WHERE pg_get_expr(p.polqual, p.polrelid) = 'true'
--         AND c.relname IN ('live_cohosts','live_polls','live_moderators',
--                           'live_viewer_welcomes');
--      -- muss leer sein
--
-- 3. Der eigentliche Test — sobald es eine Frauen-Only-Sendung gibt:
--      -- als anon oder ungeprüftes Konto:
--      SELECT count(*) FROM live_cohosts WHERE session_id = '<WOZ-Session>';
--      -- muss 0 sein
