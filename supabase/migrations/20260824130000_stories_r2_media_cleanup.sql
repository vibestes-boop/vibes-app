-- ═══════════════════════════════════════════════════════════════════════════
-- Story-Medien werden aufgeräumt — aber keine Story-Zeile wird gelöscht
-- 24.08.2026 · Serlo UND Berkat · Gegenstück zu `20260517123000` (posts)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Der Fund vom 24.08.2026 (Abschnitt 84): Einen `AFTER DELETE`-Trigger, der
-- gelöschte Medien zum Aufräumen einreiht, gibt es **nur auf `posts`**. Für
-- `stories` gibt es keinen. Jedes Story-Bild bleibt für immer in R2 liegen —
-- bei JEDEM Nutzer, nicht nur bei gelöschten Konten.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ NACHGESEHEN, BEVOR GEBAUT — und zwei der drei Annahmen stimmten nicht
--
-- 1. WELCHE SPALTEN `stories` HAT (die Tabelle ist von Serlo geerbt):
--      id, user_id, media_url (NOT NULL), media_type, created_at,
--      interactive, archived, thumbnail_url, app
--    ⚠️ `media_url` ist NOT NULL. Es gibt also keinen Weg, eine aufgeräumte
--    Zeile durch Leeren der Spalte zu kennzeichnen — daher unten die neue
--    Spalte `media_purged_at`.
--    ⚠️ Und `20260518203000` hat für Bild-Stories `thumbnail_url = media_url`
--    zurückgeschrieben. Beide Spalten tragen also meistens DIESELBE Adresse.
--
-- 2. OB STORIES ÜBERHAUPT PER DELETE VERSCHWINDEN — **NEIN.**
--    Durchsucht: alle Migrationen, alle `cron.schedule`-Aufträge, alle Edge
--    Functions, beide Apps und die Web-App. Es gibt:
--      · KEIN `DELETE FROM stories` in irgendeinem SQL
--      · KEINEN Cron, der Stories anfasst (die 21 Aufträge betreffen Lives,
--        Auktionen, Zahlungserinnerungen, Feed, KI-Bilder, R2-Warteschlange)
--      · nur ZWEI Löschwege, beide von Hand durch den Nutzer ausgelöst:
--          `apps/web/app/actions/stories.ts:127`
--          `apps/berkat/lib/useStories.ts:220`
--    Der Ablauf nach 24 Stunden ist ein reiner LESE-Filter: `archived = false`
--    UND `created_at >= now() - 24h`. Die Zeile bleibt unbegrenzt stehen.
--
--    ⇒ Ein DELETE-Trigger allein räumt fast nichts auf. Er kommt trotzdem —
--      als Netz für die zwei Handlöschwege und für jeden künftigen —, aber die
--      Arbeit macht der Cron weiter unten.
--
-- 3. ⚠️ DIE HIGHLIGHT-FALLE — und sie ist grösser als vermutet.
--    `highlight-copy-media` kopiert Story-Medien nach `highlights/{userId}/`,
--    damit ein Highlight den Ablauf der Story überlebt. Die Kopie ist
--    ausdrücklich BEST-EFFORT: schlägt sie fehl, behält das Highlight die
--    ORIGINAL-Adresse unter `thumbnails/` (`highlight-copy-media/index.ts`,
--    `copyToHighlights` → `catch { return url }`). Ein Aufräumer ohne Prüfung
--    löscht dann das Bild eines LEBENDEN Highlights.
--
--    Nachgesehen, wie die beiden Apps Highlights wirklich schreiben — sie tun
--    es UNTERSCHIEDLICH, und nur einer der beiden Fälle war bekannt:
--
--    a) BERKAT (`apps/berkat/lib/useHighlights.ts:250`) lässt `story_id`
--       ausdrücklich LEER. Ein Berkat-Highlight ist eine eigene Zusammen-
--       stellung, keine Verknüpfung. ⚠️ Es überlebt das Löschen der Story
--       also — und wenn die Kopie fehlschlug, zeigt es auf `thumbnails/`.
--       Das ist der Fall aus der Aufgabenstellung.
--
--    b) SERLO (`lib/useStoryHighlights.ts:272`) SETZT `story_id`. Und der
--       Lesepfad (`lib/useStoryHighlights.ts:157` und `:190`) holt das Bild
--       LIVE aus der `stories`-Zeile: `mediaMap[h.story_id]?.media_url`.
--       ⚠️ Highlights aus der Zeit vor `20260517*` haben `media_url IS NULL` —
--       die Spalte gab es damals noch gar nicht (`20260330000000` hatte nur
--       id/user_id/story_id/title/created_at). Diese Zeilen hängen zu 100 % an
--       der Story-Zeile. Ein Abgleich rein über die ADRESSE würde sie
--       übersehen: sie führen gar keine.
--
--    ⇒ Die Prüfung unten hat deshalb DREI Arme, nicht einen. Der erste
--      (`story_id`) ist der, der ohne Nachsehen gefehlt hätte.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ WARUM DER CRON DIE ZEILE STEHEN LÄSST UND NUR DIE DATEI NIMMT
--
-- Der naheliegende Cron wäre `DELETE FROM stories WHERE created_at < …`. Das
-- wäre falsch, und zwar aus drei Richtungen gleichzeitig:
--
--   · An `stories` hängen `story_comments`, `story_polls`, `story_views` und
--     `story_likes` mit ON DELETE CASCADE. Das sind Äusserungen und Stimmen
--     ANDERER Menschen. (Derselbe Grund, aus dem `20260824120000` die Stories
--     eines gelöschten Kontos ausdrücklich stehen lässt.)
--   · `story_highlights.story_id` hängt mit ON DELETE CASCADE daran. Ein
--     `DELETE` würde JEDES Serlo-Story-Highlight mitreissen — dauerhaft
--     gemeinte Profil-Inhalte, gelöscht von einem Aufräum-Auftrag.
--   · Beide Apps zeigen dem Nutzer sein eigenes Story-ARCHIV ohne Altersgrenze
--     als Vorlage für neue Highlights (`useMyStoryArchive`: Serlo 200 Zeilen,
--     Berkat 60). Die Zeile ist dort das Angebot, nicht der Müll.
--
-- Deshalb: Die Zeile bleibt, die Datei geht, und `media_purged_at` hält fest,
-- dass sie gegangen ist. Aufbewahrungsfenster **90 Tage** — bewusst weit über
-- dem 24-Stunden-Anzeigefenster, damit das Archiv für praktisch jeden Nutzer
-- vollständig bleibt (wer stellt in 90 Tagen 200 Stories ein?). Wer es enger
-- stellt, schaltet dem Highlight-Picker das Material ab; das ist eine
-- Produktentscheidung, keine Aufräumaktion.

-- ─── 1. Die Warteschlange lernt `reason` — falls sie es noch nicht kann ─────
--
-- ⚠️ `20260824120000` fügt `prefix` UND `reason` hinzu. Die Migration liegt am
-- 24.08.2026 noch in einem eigenen Zweig. Diese Zeile hier macht diese Migration
-- unabhängig von der Reihenfolge: Läuft jene zuerst, ist das ein No-Op; läuft
-- diese zuerst, findet jene die Spalte vor (`IF NOT EXISTS`) und ergänzt nur
-- `prefix`. `prefix` wird hier NICHT angelegt — die Spalte gehört zur
-- Konto-Löschung samt ihrer beiden CHECK-Regeln und wird nicht halb übernommen.
--
-- Beide CHECK-Regeln von dort vertragen sich mit den Zeilen dieser Migration:
-- `prefix` bleibt hier immer NULL, damit greift weder `…_prefix_shape` noch
-- `…_one_kind`.

ALTER TABLE public.r2_delete_queue
  ADD COLUMN IF NOT EXISTS reason text;

-- ─── 2. Die Story merkt sich, dass ihr Bild fort ist ────────────────────────
--
-- ⚠️ NICHT `archived`. Das bedeutet „aus dem Ring gefallen" und wird vom
-- Highlight-Picker ausdrücklich ignoriert (`useMyStoryArchive` liest auch
-- archivierte Zeilen). Hier geht es um etwas anderes: die DATEI ist weg. Zwei
-- verschiedene Aussagen brauchen zwei verschiedene Spalten.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS media_purged_at timestamptz;

COMMENT ON COLUMN public.stories.media_purged_at IS
  'Wann die Medien dieser Story aus R2 entfernt wurden. Gesetzt ausschliesslich '
  'von purge_expired_story_media(). Ist die Spalte gesetzt, zeigen media_url '
  'und thumbnail_url auf eine Adresse, die es nicht mehr gibt — Lesepfade, die '
  'dem Nutzer eigene Stories anbieten, MÜSSEN darauf filtern.';

-- Der Cron läuft „älteste zuerst". Der Teil-Index schrumpft mit jedem Lauf,
-- weil aufgeräumte Zeilen aus dem Prädikat fallen.
CREATE INDEX IF NOT EXISTS idx_stories_media_purge_candidates
  ON public.stories(created_at)
  WHERE media_purged_at IS NULL;

-- ─── 3. Indizes für die Highlight-Prüfung ──────────────────────────────────
--
-- ⚠️ Ohne diese drei wird die Prüfung zu drei Seq-Scans PRO STORY. Der
-- vorhandene UNIQUE (user_id, story_id) hilft NICHT: `story_id` steht dort an
-- zweiter Stelle und ist damit für eine Suche allein nach `story_id` unbrauchbar.

CREATE INDEX IF NOT EXISTS idx_story_highlights_story_id
  ON public.story_highlights(story_id)
  WHERE story_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_story_highlights_media_url
  ON public.story_highlights(media_url)
  WHERE media_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_story_highlights_thumbnail_url
  ON public.story_highlights(thumbnail_url)
  WHERE thumbnail_url IS NOT NULL;

-- Für den `@>`-Abgleich in der `items`-Liste.
CREATE INDEX IF NOT EXISTS idx_story_highlights_items_gin
  ON public.story_highlights USING GIN (items);

-- ─── 4. Die Prüfung: Hängt an dieser Adresse noch ein lebendes Highlight? ───
--
-- Drei Arme, jeder deckt einen Fall ab, den die anderen beiden nicht sehen:
--
--   (a) `story_id`  — eine Highlight-Zeile hängt DIREKT an dieser Story. Deckt
--                     die alten Serlo-Highlights ab, die gar keine eigene
--                     Adresse führen (`media_url IS NULL`) und ihr Bild live
--                     aus `stories` holen. Ein Adress-Abgleich fände sie nie.
--   (b) Spalten     — `media_url` / `thumbnail_url` der Highlight-Zeile tragen
--                     genau diese Adresse: die Kopie ist fehlgeschlagen.
--   (c) `items`     — dieselbe Adresse in der JSONB-Liste. Beide Apps schreiben
--                     die vollständige Bilderreihe dorthin; die beiden Spalten
--                     oben tragen nur das TITELBILD (erstes Element). Ein
--                     Highlight aus fünf Bildern wäre über (b) nur zu einem
--                     Fünftel geschützt.
--
-- ⚠️ SECURITY INVOKER, nicht DEFINER. Die Funktion wird ausschliesslich aus den
-- beiden Definer-Zusammenhängen unten aufgerufen und läuft dort ohnehin mit
-- deren Rechten. Als DEFINER wäre sie ein zusätzlicher, unnötig privilegierter
-- Einstieg.
CREATE OR REPLACE FUNCTION public.story_media_claimed_by_highlight(
  p_story_id uuid,
  p_url      text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    -- (a)
    EXISTS (
      SELECT 1 FROM public.story_highlights h
       WHERE h.story_id = p_story_id
    )
    OR (
      p_url IS NOT NULL AND btrim(p_url) <> '' AND (
        -- (b)
        EXISTS (
          SELECT 1 FROM public.story_highlights h
           WHERE h.media_url = p_url OR h.thumbnail_url = p_url
        )
        -- (c)
        OR EXISTS (
          SELECT 1 FROM public.story_highlights h
           WHERE h.items @> jsonb_build_array(jsonb_build_object('media_url', p_url))
              OR h.items @> jsonb_build_array(jsonb_build_object('thumbnail_url', p_url))
        )
      )
    );
$$;

COMMENT ON FUNCTION public.story_media_claimed_by_highlight(uuid, text) IS
  'TRUE, wenn ein Highlight diese Story-Zeile oder diese Adresse noch braucht. '
  'Wer sie auf FALSE zwingt, löscht das Bild eines lebenden Highlights.';

-- ─── 5. Das Einreihen — eine Stelle, zwei Aufrufer ─────────────────────────
--
-- Gibt zurück, wie viele Adressen tatsächlich eingereiht wurden (0, 1 oder 2).
--
-- ⚠️ SECURITY INVOKER — und das ist hier eine SICHERHEITSENTSCHEIDUNG, keine
-- Stilfrage. `r2-delete` prüft beim Abarbeiten der Warteschlange nur noch den
-- PFAD (`assertAllowedRoot`, `functions/r2-delete/index.ts:436`), NICHT mehr den
-- Eigentümer — der Eigentümer-Abgleich (`assertAllowedKey`) läuft nur auf dem
-- direkten Aufruf-Weg. Wer also eine Zeile in die Warteschlange bekommt,
-- bekommt die Datei gelöscht, egal wem sie gehört. Als SECURITY DEFINER und mit
-- dem Standard-Recht für PUBLIC wäre diese Funktion damit ein Knopf, mit dem
-- jeder angemeldete Nutzer fremde Avatare und Chat-Fotos löschen könnte.
-- So nicht: Als INVOKER greift beim Direktaufruf die RLS auf `r2_delete_queue`
-- (eingeschaltet, KEINE Policy) und der INSERT scheitert. Das REVOKE unten ist
-- das zweite Schloss an derselben Tür — es ist Absicht, dass beide da sind.
CREATE OR REPLACE FUNCTION public.enqueue_story_media_delete(
  p_story_id uuid,
  p_user_id  uuid,
  p_media    text,
  p_thumb    text,
  p_reason   text
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_media text := nullif(btrim(coalesce(p_media, '')), '');
  v_thumb text := nullif(btrim(coalesce(p_thumb, '')), '');
BEGIN
  -- `20260518203000` hat für Bild-Stories `thumbnail_url = media_url` gesetzt.
  -- Zweimal dieselbe Adresse in einer Zeile wäre kein Schaden (der Abarbeiter
  -- entdoppelt selbst, `functions/r2-delete/index.ts:297`), aber beim späteren
  -- Nachsehen liest sich eine Zeile mit zwei gleichen Adressen wie ein Fehler.
  IF v_thumb IS NOT NULL AND v_thumb = v_media THEN
    v_thumb := NULL;
  END IF;

  -- ⚠️ JEDE Adresse einzeln prüfen. Es kommt vor, dass ein Highlight nur das
  -- Vorschaubild übernommen hat und nicht das Video dahinter.
  IF v_media IS NOT NULL
     AND public.story_media_claimed_by_highlight(p_story_id, v_media) THEN
    v_media := NULL;
  END IF;

  IF v_thumb IS NOT NULL
     AND public.story_media_claimed_by_highlight(p_story_id, v_thumb) THEN
    v_thumb := NULL;
  END IF;

  IF v_media IS NULL AND v_thumb IS NULL THEN
    RETURN 0;
  END IF;

  -- ⚠️ `post_id` bleibt leer und wird NICHT zweckentfremdet. Die Spalte hält
  -- eine `posts`-Kennung; eine Story-Kennung dort hineinzuschreiben, hiesse,
  -- jede spätere Auswertung in die Irre zu führen. Die Herkunft steht in
  -- `reason`, der Mensch dahinter in `author_id`.
  INSERT INTO public.r2_delete_queue (author_id, media_url, thumbnail_url, reason)
  VALUES (p_user_id, v_media, v_thumb, p_reason);

  RETURN (CASE WHEN v_media IS NULL THEN 0 ELSE 1 END)
       + (CASE WHEN v_thumb IS NULL THEN 0 ELSE 1 END);
END;
$$;

-- ─── 6. Der Trigger — das Gegenstück zu `posts` ────────────────────────────
--
-- ⚠️ ZUR REIHENFOLGE GEGENÜBER DEM CASCADE: `story_highlights.story_id` hängt
-- mit ON DELETE CASCADE an `stories`. Ob dieser Trigger vor oder nach dem
-- Aufräumen des Fremdschlüssels läuft, ist nicht zugesichert — und muss es auch
-- nicht sein, denn BEIDE Ausgänge sind unschädlich:
--
--   · Läuft der CASCADE zuerst, sieht die Prüfung die Highlight-Zeile nicht
--     mehr und reiht ein. Die Zeile ist dann aber ebenfalls fort — es geht kein
--     sichtbares Bild verloren. (Eine geglückte Kopie unter `highlights/` ist
--     davon ohnehin nicht betroffen; eingereiht wird nur die Original-Adresse.)
--   · Läuft der Trigger zuerst, sieht die Prüfung die Zeile und reiht NICHT
--     ein. Dann bleibt eine Datei liegen — der Zustand von gestern, kein Verlust.
--
-- Der schlimmste Ausgang ist also eine übrig gebliebene Datei, nie ein
-- gelöschtes lebendes Bild. Diese Richtung ist Absicht.
--
-- Nachgemessen (PostgreSQL 18.4, Nachbau der drei Tabellen): Der CASCADE läuft
-- ZUERST — beim Auslösen des Triggers ist die Highlight-Zeile bereits fort und
-- die Adresse wird eingereiht. Das ist der erste der beiden Ausgänge und
-- unschädlich. ⚠️ Verlassen sollte man sich darauf trotzdem nicht: die
-- Reihenfolge von AFTER-Triggern gegenüber den internen Fremdschlüssel-Triggern
-- ist nirgends zugesichert. Wer hier etwas umbaut, muss beide Ausgänge weiter
-- vertragen, statt den gemessenen vorauszusetzen.
--
-- Für den Cron unten stellt sich die Frage gar nicht: dort wird nichts
-- gelöscht, also cascadet auch nichts, und die Prüfung ist verlässlich.
CREATE OR REPLACE FUNCTION public.enqueue_r2_story_media_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.enqueue_story_media_delete(
    OLD.id, OLD.user_id, OLD.media_url, OLD.thumbnail_url, 'story_deleted'
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_r2_media_delete_on_story_delete ON public.stories;
CREATE TRIGGER enqueue_r2_media_delete_on_story_delete
  AFTER DELETE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_r2_story_media_delete();

-- ─── 7. Der Cron — der Teil, der die Arbeit wirklich macht ─────────────────
--
-- ⚠️ Die Prüfung steht ZWEIMAL: einmal als Bedingung bei der Auswahl, einmal
-- im Einreihen. Das ist kein Versehen. Die Bedingung bei der Auswahl sorgt
-- dafür, dass eine dauerhaft beanspruchte Story gar nicht erst einen der
-- begrenzten Plätze eines Durchgangs belegt — sonst stünden nach Jahren die
-- immer gleichen Highlight-Stories vorn und verhungerten alles dahinter. Die
-- Prüfung im Einreihen ist die, auf die es ankommt.
--
-- ⚠️ `media_purged_at` wird NUR gesetzt, wenn wirklich etwas eingereiht wurde.
-- Eine Story, deren Bild ein Highlight noch braucht, bleibt unmarkiert und wird
-- beim nächsten Lauf erneut angesehen — verschwindet das Highlight später,
-- wird sie doch noch abgeholt. Andersherum stünde eine Story als „aufgeräumt"
-- da, deren Bild noch liegt: für den Nutzer unsichtbar, für R2 für immer.
CREATE OR REPLACE FUNCTION public.purge_expired_story_media(
  p_older_than interval DEFAULT interval '90 days',
  p_limit      integer  DEFAULT 500
)
RETURNS TABLE (scanned integer, enqueued integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r         record;
  v_scanned integer := 0;
  v_enq     integer := 0;
  v_urls    integer;
BEGIN
  FOR r IN
    SELECT s.id, s.user_id, s.media_url, s.thumbnail_url
      FROM public.stories s
     WHERE s.media_purged_at IS NULL
       AND s.created_at < now() - p_older_than
       AND NOT public.story_media_claimed_by_highlight(s.id, s.media_url)
       AND NOT public.story_media_claimed_by_highlight(s.id, s.thumbnail_url)
     ORDER BY s.created_at
     LIMIT greatest(1, least(coalesce(p_limit, 500), 5000))
     FOR UPDATE SKIP LOCKED
  LOOP
    v_scanned := v_scanned + 1;

    v_urls := public.enqueue_story_media_delete(
      r.id, r.user_id, r.media_url, r.thumbnail_url, 'story_expired'
    );

    IF v_urls > 0 THEN
      v_enq := v_enq + 1;
      UPDATE public.stories SET media_purged_at = now() WHERE id = r.id;
    END IF;
  END LOOP;

  scanned  := v_scanned;
  enqueued := v_enq;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_story_media(interval, integer) IS
  'Reiht die Medien abgelaufener Stories zum Löschen ein und LÄSST DIE ZEILE '
  'STEHEN. Ein DELETE wäre hier falsch: daran hängen story_comments, '
  'story_polls, story_views, story_likes und story_highlights mit CASCADE.';

-- ─── 8. Die Rechte — ausdrücklich, weil sie sonst driften ──────────────────
--
-- ⚠️ `CREATE OR REPLACE` behält Rechte nicht über alle Postgres-Fassungen, und
-- eine neue Funktion ist standardmässig für PUBLIC ausführbar — also auch für
-- `anon`. Genau so wurde `credit_coins` einmal ohne Anmeldung aufrufbar
-- (Abschnitt 7). Hier wöge es schwerer als dort: `enqueue_story_media_delete`
-- nimmt eine beliebige Adresse entgegen, und der Abarbeiter fragt nicht nach
-- dem Eigentümer.
--
-- Alle vier bleiben ohne Freigabe. Der Cron läuft als Eigentümer und braucht
-- keine; die Trigger-Funktion ruft niemand von Hand.

REVOKE ALL ON FUNCTION public.story_media_claimed_by_highlight(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_story_media_delete(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_r2_story_media_delete()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_story_media(interval, integer)
  FROM PUBLIC, anon, authenticated;

-- ─── 9. Der Auftrag ────────────────────────────────────────────────────────
--
-- Stündlich, 500 Zeilen je Lauf. Das Fenster steht ausdrücklich im Befehl und
-- nicht nur im Vorgabewert — wer in `cron.job` nachsieht, soll die 90 Tage dort
-- lesen können, ohne die Funktion aufzuschlagen.
--
-- ⚠️ Das ist bewusst langsam. Wenn beim ersten Mal ein grosser Rückstand
-- dasteht, wird er über Tage abgetragen statt in einem Schlag — die
-- Warteschlange wird nur alle 5 Minuten abgearbeitet (`20260517153000`), und
-- eine Flut dort würde den Aufräumer der Posts mit verdrängen.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-expired-story-media';
    PERFORM cron.schedule(
      'purge-expired-story-media',
      '23 * * * *',
      $cron$SELECT public.purge_expired_story_media(interval '90 days', 500);$cron$
    );
    RAISE NOTICE 'purge-expired-story-media läuft stündlich (90 Tage, 500 je Lauf)';
  ELSE
    RAISE NOTICE 'pg_cron fehlt — Story-Medien werden nur beim Löschen von Hand aufgeräumt';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- GEGENPROBEN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Der Trigger greift überhaupt. Eine Test-Story von Hand löschen:
--      DELETE FROM stories WHERE id = '<test>';
--      SELECT reason, media_url, thumbnail_url, status
--        FROM r2_delete_queue WHERE reason = 'story_deleted';
--
-- 2. ⚠️ DIE EIGENTLICHE PROBE — dass ein lebendes Highlight NICHT angefasst
--    wird. Ein Berkat-Highlight anlegen, bei dem die Kopie fehlschlug (also
--    `items` trägt noch eine `thumbnails/`-Adresse), dann die Quell-Story
--    löschen. Es darf KEINE Zeile entstehen, die diese Adresse führt:
--      SELECT h.id, h.items
--        FROM story_highlights h
--       WHERE h.items::text LIKE '%thumbnails/%';
--      -- eine dieser Adressen nehmen und prüfen:
--      SELECT * FROM r2_delete_queue WHERE media_url = '<adresse>';
--      -- MUSS leer bleiben
--    Und danach: die Adresse selbst MUSS weiterhin HTTP 200 liefern.
--
-- 3. Der Arm, der ohne Nachsehen gefehlt hätte — ein altes Serlo-Highlight
--    OHNE eigene Adresse. Es hängt nur über `story_id`:
--      SELECT id, story_id FROM story_highlights
--       WHERE media_url IS NULL AND story_id IS NOT NULL LIMIT 5;
--    Für eine dieser Stories muss die Prüfung TRUE sagen:
--      SELECT public.story_media_claimed_by_highlight('<story_id>', NULL);
--      -- MUSS true sein, obwohl gar keine Adresse übergeben wurde
--
-- 4. Der Cron im Trockenlauf, ohne etwas zu verändern (Transaktion verwerfen):
--      BEGIN;
--      SELECT * FROM public.purge_expired_story_media(interval '90 days', 50);
--      SELECT reason, count(*) FROM r2_delete_queue GROUP BY reason;
--      ROLLBACK;
--
-- 5. Nach dem nächsten Lauf des Warteschlangen-Crons (höchstens 5 Minuten)
--    stehen die Zeilen auf `deleted`:
--      SELECT status, count(*) FROM r2_delete_queue
--       WHERE reason IN ('story_expired', 'story_deleted') GROUP BY status;
--    ⚠️ Bleibt eine auf `error`, wird sie NIE wiederholt — der Abarbeiter holt
--    nur `pending` (Verhalten von 2026-05-17, gilt für Posts genauso).
--    `last_error` sagt, warum. Story-Medien liegen unter `thumbnails/` und sind
--    damit von `ALLOWED_ROOTS` gedeckt; ein `Object path is not allowed` hiesse,
--    dass irgendwo ein anderer Speicherort eingeführt wurde.
--
-- 6. Dass keine Zeile verloren geht — die Anzahl der Stories bleibt gleich:
--      SELECT count(*) FROM stories;          -- vor und nach dem Lauf identisch
--      SELECT count(*) FROM story_comments;   -- ebenso
--      SELECT count(*) FROM story_highlights; -- ebenso
--
-- 7. Dass eine beanspruchte Story nicht fälschlich als aufgeräumt gilt:
--      SELECT s.id FROM stories s
--       WHERE s.media_purged_at IS NOT NULL
--         AND public.story_media_claimed_by_highlight(s.id, s.media_url);
--      -- MUSS leer sein
--
-- 8. Dass niemand von aussen einreihen kann:
--      SET ROLE authenticated;
--      SELECT public.enqueue_story_media_delete(
--        gen_random_uuid(), gen_random_uuid(), 'https://…/avatars/fremd.jpg', NULL, 'x');
--      -- MUSS an fehlendem Ausführungsrecht scheitern
--      RESET ROLE;
