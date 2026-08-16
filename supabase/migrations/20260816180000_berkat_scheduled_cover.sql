-- Bild für angekündigte Shows
--
-- WARUM
-- Ein Termin im „Demnächst"-Streifen hatte bis hierher einen Namen und eine
-- Uhrzeit — sonst nichts. Das ist dieselbe Lücke wie am 16.08.2026 bei den
-- Dauerangeboten, nur einen Bildschirm weiter: In einer laufenden Show hält der
-- Verkäufer den Artikel in die Kamera, das Vorschaubild ist Zugabe. Eine
-- ANKÜNDIGUNG hat keine Kamera, keine Ware und keinen Preis. Dort ist das Bild
-- die ganze Auslage.
--
-- Und es ist die Fläche, die am meisten trägt: Solange niemand sendet — also
-- rund 94 % der Zeit — IST der Streifen die Startseite. Darunter steht nur
-- „Gerade ist niemand live".
--
-- Whatnot macht es genauso: Beim Planen füllt ein Verkäufer Titel, THUMBNAIL und
-- Kategorie aus; es gibt dafür eine offizielle Vorlage samt Safe Zones, und
-- gestartet wird die Show später, indem man auf ihr Thumbnail tippt.
--
-- RÜCKFALL STATT ZWANG
-- Wer kein Bild wählt, bekommt das Cover seiner letzten eigenen Berkat-Show.
-- Dasselbe Muster wie beim Zusteller in den Bestellungen (HANDOFF § 18): Die
-- Vorbelegung kommt aus dem, was der Verkäufer TATSÄCHLICH zuletzt getan hat,
-- nicht aus einer Einstellung, die jemand einmal gesetzt hat und die danach
-- veraltet. Kein neuer Speicher, keine zweite Wahrheit.
--
-- Ein Bild-Zwang wäre der falsche Preis: Genau der Verkäufer, der abends schnell
-- einen Termin einträgt, bricht sonst ab — und ein angekündigter Abend ohne Bild
-- ist immer noch unendlich viel besser als kein angekündigter Abend.
--
-- ⚠️ WARUM DIE FUNKTION GELÖSCHT UND NEU ANGELEGT WIRD
-- Ein defaultierter Parameter erzeugt in Postgres eine ÜBERLADUNG, keine
-- geänderte Funktion — und zwei Überladungen machen PostgREST mehrdeutig
-- (HTTP 300, gemessen bei `publish_due_scheduled_posts`). Bei `schedule_live`
-- ist das der Grund, sie NICHT anzufassen: Ausgelieferte Serlo-Versionen rufen
-- sie weiter. `schedule_berkat_show` dagegen ruft nur Berkat, und Berkat ist in
-- keinem Store — ein DROP ist hier gefahrlos, ein zweiter Eintrag im Katalog
-- nicht.
--
-- ⚠️ UND WARUM DIE RECHTE DARUNTER STEHEN MÜSSEN
-- Ein DROP+CREATE fällt auf den Postgres-Standard zurück: EXECUTE für PUBLIC,
-- und PUBLIC schließt `anon` ein. Genau so wurde `credit_coins` am 14.08.2026
-- ohne Anmeldung aufrufbar. Die zwei Zeilen am Ende sind kein Ritual.
--
-- ⚠️ WAS HIER AUSDRÜCKLICH NICHT NÖTIG IST
-- Kein `GRANT SELECT (cover_url)`. Die Falle mit der eingefrorenen Spaltenliste
-- betrifft nur Tabellen mit einem spaltenweisen REVOKE — `live_sessions`,
-- `user_whip_ingresses` und seit dem 14.08. `profiles`. `scheduled_lives` hat
-- keins; geprüft, bevor diese Migration geschrieben wurde. Wer das je ändert,
-- muss diese Zeile mitändern.

BEGIN;

ALTER TABLE public.scheduled_lives
  ADD COLUMN IF NOT EXISTS cover_url text;

COMMENT ON COLUMN public.scheduled_lives.cover_url IS
  'Vorschaubild der angekündigten Show. Vom Verkäufer hochgeladen (R2, Präfix thumbnails); '
  'wird beim Anlegen aus der letzten eigenen Show übernommen, wenn keins gewählt wurde. '
  'Nur Berkat SCHREIBT und ZEIGT die Spalte — Serlo holt sie per select(*) mit und ignoriert sie.';

-- ⚠️ SERLO ZIEHT JEDE NEUE SPALTE DIESER TABELLE AUTOMATISCH MIT.
-- Alle vier Serlo-Lesepfade selektieren `*`, nicht eine Spaltenliste:
--   apps/web/lib/data/live-host.ts:307 und :328
--   lib/useScheduledLives.ts:130 und :284
-- Heute ist das folgenlos — Serlo rendert `cover_url` nirgends, und ein
-- unbekanntes Feld im Ergebnisobjekt stört keinen Client. Wer hier aber je eine
-- Spalte anlegt, die etwas Vertrauliches trägt, legt sie damit in Serlos
-- Antwort. Die Trennung der beiden Apps läuft über `app` in der WHERE-Bedingung,
-- NICHT über die Spaltenauswahl.

-- Keine Größen- oder Formatprüfung im CHECK. Das Zuschneiden passiert beim
-- Hochladen (`pickImage`), und was in R2 landet, begrenzt die signierte URL
-- ohnehin. Eine zweite Wahrheit darüber in der Datenbank liefe nur auseinander —
-- dieselbe Begründung wie bei `profiles.banner_url` (`20260816170000`).

-- BEIDE Signaturen fallen, die alte und die neue.
--
-- Die zweite Zeile ist nicht überflüssig, sondern der Unterschied zwischen
-- „wiederholbar" und „einmal". Ohne sie läuft die Datei ein zweites Mal so:
-- Der DROP der Drei-Parameter-Fassung greift ins Leere (die ist ja weg), und
-- `CREATE` stolpert über die Vier-Parameter-Fassung, die derselbe Lauf beim
-- ersten Mal angelegt hat — `42723: function … already exists with same
-- argument types`. Genau so am 16.08.2026 passiert.
--
-- Sie ist außerdem die Selbstheilung gegen den Fall, den Punkt 3 der Gegenprobe
-- sucht: Läge je eine zweite Überladung im Katalog, wäre PostgREST mehrdeutig
-- (HTTP 300). Nach diesen zwei Zeilen kann höchstens eine übrig sein.
DROP FUNCTION IF EXISTS public.schedule_berkat_show(TIMESTAMPTZ, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.schedule_berkat_show(TIMESTAMPTZ, TEXT, BOOLEAN, TEXT);

CREATE FUNCTION public.schedule_berkat_show(
  p_scheduled_at TIMESTAMPTZ,
  p_title        TEXT,
  p_women_only   BOOLEAN DEFAULT false,
  p_cover_url    TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    UUID;
  v_cover TEXT := NULLIF(btrim(COALESCE(p_cover_url, '')), '');
BEGIN
  -- `schedule_live` bleibt der Eingang und damit die einzige Stelle, an der die
  -- Regeln stehen: Anmeldung, nicht-leerer Titel, Fenster 5 Minuten bis 30 Tage.
  -- Wirft sie, ist danach nichts angelegt — der Rückfall unten läuft also nie
  -- für einen Termin, den es nicht gibt.
  v_id := public.schedule_live(
    p_scheduled_at   => p_scheduled_at,
    p_title          => p_title,
    p_description    => NULL,
    p_allow_comments => true,
    -- Geschenke laufen in Serlo über Coins, und Coins sind in Berkat
    -- ausgeschlossen (E-Geld, HANDOFF § 7). Ein TRUE wäre ein Versprechen ohne
    -- Oberfläche.
    p_allow_gifts    => false,
    p_women_only     => p_women_only
  );

  -- Rückfall: das Cover der letzten eigenen Berkat-Show. Läuft höchstens einmal
  -- je Termin (bei einer wöchentlichen Reihe also viermal) und filtert auf
  -- host_id — kein Pfad, der einen eigenen Index bräuchte.
  --
  -- Der Filter auf `app` ist nicht kosmetisch: Ohne ihn bekäme ein Verkäufer,
  -- der beide Apps benutzt, das Cover seines letzten SERLO-Streams auf einen
  -- Berkat-Auktionsabend.
  IF v_cover IS NULL THEN
    SELECT s.thumbnail_url
      INTO v_cover
      FROM public.live_sessions s
     WHERE s.host_id = auth.uid()
       AND s.app = 'berkat'
       AND s.thumbnail_url IS NOT NULL
     ORDER BY s.started_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  UPDATE public.scheduled_lives
     SET app       = 'berkat',
         cover_url = v_cover
   WHERE id = v_id;

  RETURN v_id;
END;
$$;

-- Die zwei Zeilen, um die es oben geht.
REVOKE ALL ON FUNCTION public.schedule_berkat_show(TIMESTAMPTZ, TEXT, BOOLEAN, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_berkat_show(TIMESTAMPTZ, TEXT, BOOLEAN, TEXT)
  TO authenticated;

COMMIT;

-- PostgREST muss die neue Signatur kennen, sonst antwortet der erste Aufruf mit
-- PGRST202 („function not found"), obwohl sie in der Datenbank steht.
NOTIFY pgrst, 'reload schema';

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- 1. Spalte lesbar, ohne Anmeldung, mit dem öffentlichen Client-Schlüssel:
--
--      GET /rest/v1/scheduled_lives?select=id,cover_url&limit=1   -> 200
--
--    Kommt 42501, hat `scheduled_lives` doch eine eingefrorene Spaltenliste
--    bekommen und braucht `GRANT SELECT (cover_url)`.
--
-- 2. Die Funktion bleibt für Nicht-Angemeldete zu:
--
--      POST /rest/v1/rpc/schedule_berkat_show   -> 401 bzw. 42501
--
--    Kommt dort etwas anderes als eine Abweisung, hat der DROP die Rechte auf
--    PUBLIC zurückgesetzt und der REVOKE oben ist nicht gelaufen.
--
-- 3. Es darf nur EINE Funktion dieses Namens geben — sonst ist der Katalog
--    mehrdeutig und PostgREST antwortet mit HTTP 300:
--
--      SELECT oid::regprocedure FROM pg_proc WHERE proname = 'schedule_berkat_show';
--
--    Erwartet: genau eine Zeile.
--
-- 4. Der Rückfall: Einen Termin OHNE Bild eintragen, mit einem Konto, das schon
--    eine Berkat-Show mit Cover hatte. `cover_url` muss danach gesetzt sein und
--    dem `thumbnail_url` der letzten Show entsprechen.
