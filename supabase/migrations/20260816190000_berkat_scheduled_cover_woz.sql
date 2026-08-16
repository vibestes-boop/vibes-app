-- Der Bild-Rückfall darf keine Frauen-Only-Show anfassen
--
-- WAS SCHIEFLIEF
-- `20260816180000` hat den Rückfall eingeführt: Wer einen Termin ohne Bild
-- einträgt, bekommt das `thumbnail_url` seiner letzten eigenen Berkat-Show. Die
-- Abfrage filterte auf `host_id` und `app` — aber NICHT auf `women_only`.
--
-- Das hebt ein geschütztes Bild über die Schranke. Die Lese-Policy auf
-- `live_sessions` lautet:
--
--   CREATE POLICY "live_sessions_select_with_women_only" … FOR SELECT
--     USING (women_only = false OR host_id = auth.uid()
--            OR public.is_women_only_verified());
--
-- Eine Frauen-Only-Show ist damit für die Öffentlichkeit unsichtbar, ihr Cover
-- eingeschlossen. `scheduled_lives` dagegen ist öffentlich lesbar — der
-- „Demnächst"-Streifen holt die Termine ohne Anmeldung. Der Rückfall lief also
-- als SECURITY DEFINER an der Policy vorbei (dort gilt sie nicht, die Funktion
-- läuft als Eigentümer) und schrieb die geschützte URL in eine offene Zeile.
--
-- Ablauf, der gereicht hätte: Eine geprüfte Verkäuferin sendet eine
-- Frauen-Only-Show mit Cover. Danach kündigt sie einen NORMALEN Abend an und
-- wählt kein Bild. Ab da steht das Cover ihrer Frauen-Only-Sendung auf der
-- öffentlichen Startseite — sichtbar für jeden, auch ohne Konto.
--
-- Sie hat dem nie zugestimmt. Sie hat nur „kein Bild" gewählt.
--
-- WARUM DAS HIER SCHWERER WIEGT ALS ANDERSWO
-- Frauen-Only ist laut Ausgangsanalyse der kulturelle Kernvorteil, den Whatnot
-- strukturell nicht hat — geprüfte Räume, in denen Verkäuferinnen ohne fremdes
-- Publikum senden. Dieselbe Fehlerklasse hat schon zweimal zugeschlagen:
-- `live_reactions_select` stand auf `USING(true)` und gab die Teilnehmerliste
-- jedes Frauen-Only-Raums frei (`20260814120000`), und am 16.07.2026 hebelte
-- eine permissive Alt-Policy auf `live_sessions` die Grenze per ODER aus.
--
-- Die Grenze verläuft dort, wo die Analyse sie zieht: DASS jemand Frauen-Only
-- sendet, darf öffentlich sein — WAS in diesem Raum zu sehen ist, nicht.
--
-- DIE ÄNDERUNG
-- Eine Zeile in der Rückfall-Abfrage: `AND s.women_only = false`. Findet sich
-- keine öffentliche Show, bleibt `cover_url` schlicht NULL und die Karte zeigt
-- die ruhige Fläche mit der Ähre — genau der Fall, für den sie gebaut ist.
--
-- Ausdrücklich NICHT eingeschränkt wird das selbst gewählte Bild: Wer sein
-- Frauen-Only-Cover bewusst auf einen öffentlichen Termin legen will, darf das.
-- Der Unterschied ist die Absicht — der Rückfall trifft eine Entscheidung, die
-- niemand getroffen hat.
--
-- WARUM EINE NEUE DATEI STATT EINER KORREKTUR IN 20260816180000
-- Die läuft bereits und ist verzeichnet. Eine eingespielte Migration
-- nachträglich in ihrer WIRKUNG zu ändern, macht den Repo-Stand zu einer
-- anderen Wahrheit als die Datenbank — und niemand sieht es, weil das Tracking
-- nur die Version kennt, nicht den Inhalt.

BEGIN;

-- Beide Signaturen, damit die Datei wiederholbar bleibt und höchstens eine
-- Fassung im Katalog stehen kann (zwei wären für PostgREST mehrdeutig, HTTP 300).
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
  v_id := public.schedule_live(
    p_scheduled_at   => p_scheduled_at,
    p_title          => p_title,
    p_description    => NULL,
    p_allow_comments => true,
    -- Geschenke laufen in Serlo über Coins, und Coins sind in Berkat
    -- ausgeschlossen (E-Geld, HANDOFF § 7).
    p_allow_gifts    => false,
    p_women_only     => p_women_only
  );

  IF v_cover IS NULL THEN
    SELECT s.thumbnail_url
      INTO v_cover
      FROM public.live_sessions s
     WHERE s.host_id = auth.uid()
       AND s.app = 'berkat'
       AND s.thumbnail_url IS NOT NULL
       -- ⚠️ DIE ZEILE, UM DIE ES IN DIESER MIGRATION GEHT.
       -- Ohne sie wandert das Cover einer Frauen-Only-Show in eine öffentlich
       -- lesbare Zeile. Die Policy auf `live_sessions` greift hier nicht — eine
       -- SECURITY-DEFINER-Funktion läuft als Eigentümer und sieht alles.
       AND s.women_only = false
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

-- Ein DROP+CREATE fällt auf den Postgres-Standard zurück: EXECUTE für PUBLIC,
-- und PUBLIC schließt `anon` ein. Genau so wurde `credit_coins` am 14.08.2026
-- ohne Anmeldung aufrufbar.
REVOKE ALL ON FUNCTION public.schedule_berkat_show(TIMESTAMPTZ, TEXT, BOOLEAN, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_berkat_show(TIMESTAMPTZ, TEXT, BOOLEAN, TEXT)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- 1. Es gibt weiterhin genau EINE Funktion dieses Namens:
--
--      SELECT oid::regprocedure FROM pg_proc WHERE proname = 'schedule_berkat_show';
--
-- 2. Ohne Anmeldung weiterhin zu (der REVOKE hat den DROP überlebt):
--
--      POST /rest/v1/rpc/schedule_berkat_show   -> 401 / 42501
--
-- 3. Der eigentliche Punkt — nur mit einem Konto durchspielbar, das eine
--    Frauen-Only-Show MIT Cover und keine öffentliche Show mit Cover hat:
--    Termin ohne Bild eintragen. `cover_url` MUSS danach NULL sein.
--    Steht dort eine URL, ist die Zeile oben nicht gelaufen.
--
-- 4. Die bereits angelegten Termine sind nicht rückwirkend betroffen: Zum
--    Zeitpunkt dieser Migration existiert genau eine Berkat-Zeile in
--    `scheduled_lives`, und ihr `cover_url` ist NULL (gemessen am 16.08.2026).
--    Ein Backfill ist deshalb nicht nötig. Wer das später prüfen will:
--
--      SELECT sl.id FROM scheduled_lives sl
--        JOIN live_sessions s ON s.thumbnail_url = sl.cover_url
--       WHERE sl.app = 'berkat' AND s.women_only AND NOT sl.women_only;
--
--    Erwartet: null Zeilen.
