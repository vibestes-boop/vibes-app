-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ Angekündigte Frauen-Only-Shows und ihre Aufzeichnungen sind öffentlich
--
-- GEFUNDEN am 22.08.2026 im Sicherheits-Audit. Zwei Lese-Policies, beide älter
-- als die Frauen-Only-Schranke, beide beim Nachziehen übersehen:
--
--   scheduled_lives_select_public   USING (status = ANY (…'scheduled',
--                                          'reminded','live'…))
--   live_recordings_select_public   USING (status = 'ready' AND is_public = true)
--
-- Keine der beiden kennt `women_only`. Dabei trägt `scheduled_lives` die Spalte
-- selbst (`women_only boolean DEFAULT false NOT NULL`), und `live_recordings`
-- hängt über `session_id` an einer Sitzung, die sie trägt.
--
-- Folge:
--   * **Titel, Beschreibung und Cover jeder angekündigten Frauen-Only-Sendung
--     sind ohne Anmeldung lesbar** — samt Gastgeberin und Uhrzeit.
--   * **Jede Aufzeichnung einer Frauen-Only-Sendung ebenso**, denn `is_public`
--     steht per Vorgabe auf `true`. Die Schranke der Sitzung wird nicht geerbt.
--
-- Das ist dieselbe Klasse wie die vier Kind-Tabellen vom 19.08.
-- (`20260819140000`) — der Nachzug hat damals die Tabellen mit `session_id`
-- erfasst, aber `scheduled_lives` (hat die Spalte selbst, keine `session_id`)
-- und `live_recordings` (hat eine, stand aber nicht auf der Liste) blieben
-- draussen.
--
-- ⚠️ FÜR BERKAT IST DAS NICHT THEORETISCH: Der „Demnächst"-Streifen auf der
-- Startseite liest `scheduled_lives` ohne Konto (Abschnitt 13). Eine
-- Verkäuferin, die eine Frauen-Only-Auktion ankündigt, steht damit heute mit
-- Namen, Bild und Uhrzeit auf einer öffentlichen Fläche — und hat genau das
-- nicht gewollt, sonst hätte sie nicht Frauen-Only gewählt.
--
-- ⚠️ DIE FORMEL IST NICHT ERFUNDEN, SIE IST ABGESCHRIEBEN
-- Wortgleich mit `live_reactions_select` und den vier Nachzüglern von
-- `20260819140000`. `is_women_only_verified()` prüft intern BEIDES —
-- `gender = 'female' AND women_only_verified = true` — die halbe Schranke aus
-- Abschnitt 57 kann hier also nicht entstehen.
--
-- ⚠️ KEINE ZWEITE PERMISSIVE POLICY DANEBEN
-- Auf beiden Tabellen liegt ausser der öffentlichen nur noch eine
-- `…_select_own` (`auth.uid() = host_id`). Die ist enger und hebelt nichts aus.
-- Genau das war am 19.08. die Gegenprobe, ohne die der Fix wertlos gewesen
-- wäre (Übergabe, Abschnitt 45).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Angekündigte Sendungen ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "scheduled_lives_select_public" ON public.scheduled_lives;

CREATE POLICY "scheduled_lives_select_public" ON public.scheduled_lives
  FOR SELECT
  USING (
    status = ANY (ARRAY['scheduled'::text, 'reminded'::text, 'live'::text])
    AND (
      women_only = false
      OR host_id = auth.uid()
      OR public.is_women_only_verified()
    )
  );

-- ── Aufzeichnungen ───────────────────────────────────────────────────────────
-- Hier wird die Schranke GEERBT statt wiederholt: Die Aufzeichnung trägt keine
-- eigene Kennzeichnung, und eine zweite Wahrheit über denselben Raum ist eine
-- zu viel (die Lehre aus `20260819130000`).
DROP POLICY IF EXISTS "live_recordings_select_public" ON public.live_recordings;

CREATE POLICY "live_recordings_select_public" ON public.live_recordings
  FOR SELECT
  USING (
    status = 'ready'::text
    AND is_public = true
    AND EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_recordings.session_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. Beide Policies tragen die Schranke, und daneben liegt nichts Permissives:
--      SELECT tablename, policyname, cmd, qual
--        FROM pg_policies
--       WHERE schemaname='public'
--         AND tablename IN ('scheduled_lives','live_recordings')
--       ORDER BY tablename, policyname;
--      -- erwartet: je zwei SELECT-Policies (…_select_own und …_select_public),
--      -- keine dritte, keine mit USING(true)
--
-- 2. Der oeffentliche Weg muss UNVERAENDERT funktionieren. Mit dem
--    oeffentlichen Schluessel:
--      GET /rest/v1/scheduled_lives?select=id,title&status=eq.scheduled&app=eq.berkat
--      -- erwartet: dieselbe Zahl wie vor der Migration, solange kein
--      -- women_only-Termin existiert
--    ⚠️ Genau hier liegt die Falle beim Pruefen: Steht die Zahl VOR und NACH
--       der Migration auf demselben Wert, beweist das NICHT, dass die Schranke
--       greift — es beweist nur, dass es keine geschuetzten Zeilen gibt.
--
-- 3. ⚠️ DIE PROBE, DIE ES WIRKLICH ZEIGT, und sie braucht Daten, die es in
--    dieser Datenbank bis heute NICHT gibt (Abschnitt 44: null WOZ-Daten):
--      -- als postgres eine Testzeile anlegen:
--      --   INSERT INTO scheduled_lives (host_id, title, starts_at, women_only, app)
--      --   VALUES (<eine host_id>, 'WOZ-Probe', now() + interval '1 day', true, 'berkat');
--      -- dann als anon:
--      --   GET /rest/v1/scheduled_lives?select=id,title&title=eq.WOZ-Probe
--      --   erwartet: 0 Zeilen  (vor dieser Migration: 1)
--      -- danach die Testzeile wieder loeschen.
--    Das ist der Punkt E3 der Pruefliste (Abschnitt 56) — und der einzige Weg,
--    diese Klasse von Fix je zu belegen statt sie abzulesen.
-- ─────────────────────────────────────────────────────────────────────────────
