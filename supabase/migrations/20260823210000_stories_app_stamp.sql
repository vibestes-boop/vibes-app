-- Stories und Highlights bekommen einen App-Stempel
-- ============================================================================
--
-- Zaur will Stories und Highlights in Berkat, ausdrücklich als Anwerbe-Argument:
-- Ein Verkäufer, der überlegt mitzumachen, schaut sich die App an — und ein
-- statisches Regal sieht tot aus. Das Anwerben ist der Engpass.
--
-- ── ⚠️ WARUM DIESE MIGRATION VOR JEDER ZEILE CLIENT KOMMT ───────────────────
--
-- `stories` und `story_highlights` sind GEERBTE Serlo-Tabellen und haben keine
-- `app`-Spalte. Ihre Lese-Policies sind weit offen:
--
--   stories_own_archived_select   USING (auth.uid() = user_id OR archived = false)
--   story_highlights_select       USING (true)
--
-- Ohne Stempel würde Berkats Story-Ring also **Serlos Stories anzeigen** — und
-- umgekehrt landete jede Berkat-Story in Serlos Feed. Am 23.08.2026 ist genau
-- diese Klasse Fehler viermal aufgetreten (`notifications`, `messages`,
-- `live_sessions`, `scheduled_lives`). Sie wird hier vorweggenommen statt
-- nachträglich behoben.
--
-- Dieselbe Form wie `messages.app` (`20260823200000`): nullable, additiv,
-- CHECK auf die zwei erlaubten Werte, `NULL` gilt als `'serlo'`. Serlo schreibt
-- und liest die Spalte nicht — für Serlo ändert sich nichts.
--
-- ⚠️ Die Trennung liegt im CLIENT-Filter, nicht in der Policy. Das ist bewusst
-- und entspricht `live_sessions.app` und `scheduled_lives.app`: Eine Policy,
-- die nach App filtert, müsste die App aus dem Aufruf kennen — die steht aber
-- nirgends im JWT. Der Stempel ist eine Zuordnung, keine Schranke; die
-- Schranke ist weiterhin, wem die Zeile gehört.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS app text;

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_app_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_app_check
  CHECK (app IS NULL OR app IN ('serlo', 'berkat'));

ALTER TABLE public.story_highlights
  ADD COLUMN IF NOT EXISTS app text;

ALTER TABLE public.story_highlights DROP CONSTRAINT IF EXISTS story_highlights_app_check;
ALTER TABLE public.story_highlights ADD CONSTRAINT story_highlights_app_check
  CHECK (app IS NULL OR app IN ('serlo', 'berkat'));

-- ── Indizes für die zwei Abfragen, die Berkat wirklich stellt ───────────────
--
-- 1. „Welche Berkat-Stories der letzten 24 Stunden gibt es?" — der Ring auf der
--    Startseite. Teil-Index auf die Berkat-Zeilen, sortiert nach Zeit.
-- 2. „Welche Highlights hat dieser Verkäufer?" — die Profilseite.
--
-- Beide bewusst PARTIAL: Serlos Bestand ist um Grössenordnungen grösser und hat
-- in diesen Indizes nichts zu suchen.

CREATE INDEX IF NOT EXISTS idx_stories_berkat_recent
  ON public.stories(created_at DESC)
  WHERE app = 'berkat' AND archived = false;

CREATE INDEX IF NOT EXISTS idx_story_highlights_berkat_user
  ON public.story_highlights(user_id, created_at DESC)
  WHERE app = 'berkat';

COMMENT ON COLUMN public.stories.app IS
  'Aus welcher App diese Story stammt. Nullable und additiv — Serlo schreibt '
  'sie nicht, NULL gilt als serlo. Ohne diese Spalte zeigte Berkats Story-Ring '
  'Serlos Stories (23.08.2026).';

COMMENT ON COLUMN public.story_highlights.app IS
  'Aus welcher App dieses Highlight stammt. Siehe stories.app.';

-- ── ⚠️ Regel 11: ist die Spaltenliste eingefroren? ──────────────────────────
--
-- Ein gezieltes `REVOKE SELECT (<spalte>)` löst das Tabellen-Recht auf und
-- schreibt Einzelrechte für die DAMALS vorhandenen Spalten. Jede später
-- hinzugefügte Spalte wäre für `anon`/`authenticated` unsichtbar — und ein
-- Filter darauf scheitert mit `42501`, auch wenn die Spalte gar nicht
-- selektiert wird.
--
-- ⚠️ Gefragt wird `pg_attribute.attacl`, NICHT
-- `information_schema.column_privileges`. Letztere fächert auch Rechte auf, die
-- aus dem TABELLEN-Recht folgen, und meldet damit jede normale Tabelle als
-- eingefroren — die Probe aus `20260822140000` hat aus genau diesem Grund am
-- 23.08.2026 eine Migration zu Unrecht abgebrochen.
DO $do$
DECLARE t text; v_frozen int;
BEGIN
  FOREACH t IN ARRAY ARRAY['stories', 'story_highlights'] LOOP
    SELECT count(*) INTO v_frozen
      FROM pg_attribute a
     WHERE a.attrelid = ('public.' || t)::regclass
       AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL;
    IF v_frozen > 0 THEN
      RAISE EXCEPTION
        '% hat Spalten-Rechte auf % Spalten: Regel 11 greift, es fehlt '
        'GRANT SELECT, INSERT (app) ON public.% TO anon, authenticated', t, v_frozen, t;
    END IF;
  END LOOP;
END $do$;

-- ── Zählprobe ───────────────────────────────────────────────────────────────
--
-- Erfolgsmeldung ist kein Nachweis — die Lehre aus `ON CONFLICT DO NOTHING`
-- vom selben Tag. Hier wird nachgesehen, ob beide Spalten tatsächlich stehen.
DO $do$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND ((table_name = 'stories' AND column_name = 'app')
       OR (table_name = 'story_highlights' AND column_name = 'app'));
  IF v <> 2 THEN
    RAISE EXCEPTION 'Erwartet 2 app-Spalten, gefunden %', v;
  END IF;
END $do$;

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Beide Spalten da und nullable. Erwartet: zwei Zeilen, beide YES.
--
--      SELECT table_name, is_nullable FROM information_schema.columns
--       WHERE table_schema='public' AND column_name='app'
--         AND table_name IN ('stories','story_highlights');
--
-- 2) Serlos Bestand ist unberührt — alle Alt-Zeilen tragen NULL.
--    Erwartet: 0.
--
--      SELECT count(*) FROM public.stories WHERE app IS NOT NULL;
--
-- 3) ⚠️ Die Probe, die zählt, geht erst nach dem Client: In Berkat eine Story
--    aufnehmen. Sie muss in BERKATS Ring erscheinen — und in Serlos Feed NICHT.
--    Gegenrichtung: Serlos Stories dürfen in Berkat nicht auftauchen.
--    Gehört zu E-Gruppe der Prüfliste (beide Apps, dasselbe Gerät).
