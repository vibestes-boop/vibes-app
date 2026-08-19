-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: Artikel für eine angekündigte Show vorbereiten
--
-- DAS PROBLEM
-- `create_live_auction` verlangt eine `live_sessions`-ID — die existiert erst,
-- wenn die Show LÄUFT. Ein Verkäufer kann seine Artikel also nicht vorbereiten:
-- Er steht vor der Kamera, vor Publikum, und tippt dort Titel, Preis und
-- Mindestschritt. Das kostet tote Sendezeit, und die „Demnächst"-Karte hat
-- nichts zu zeigen außer Titel und Bild.
--
-- ⚠️ WARUM NICHT DER GEPRÜFTE WEG
-- Der Audit vom 18.08.2026 (HANDOFF 26) untersuchte eine Vorab-Zeile in
-- `live_sessions` mit `status = 'planned'`. Der Weg funktioniert, kostet aber
-- VIER Eingriffe auf einer mit der ausgelieferten Serlo-App GETEILTEN Tabelle —
-- darunter der Go-Live-Push, der als AFTER INSERT ONLY sonst still ausfiele.
--
-- Er ist nicht nötig. Drei Tatsachen, am 19.08.2026 gegengeprüft:
--
--   1. `live_auctions.session_id` ist seit `20260815210000` NULLABLE. Ein
--      Artikel darf ohne Show existieren — das sind die Dauerangebote.
--   2. Für diesen Fall gibt es bereits `live_auctions_select_standing`, samt
--      Frauen-Only-Schranke am Artikel statt an der Session.
--   3. **Serlo benutzt `live_auctions` überhaupt nicht** (kein Treffer in
--      `apps/web/`). Die Tabelle gehört Berkat allein.
--
-- Ein vorbereiteter Show-Artikel ist damit technisch dasselbe wie ein
-- Dauerangebot: eine Zeile ohne Session. Diese Migration fasst `live_sessions`
-- NICHT an. Begründung ausführlich: HANDOFF, Abschnitt 41.
--
-- DIE UNTERSCHEIDUNG LÄUFT ÜBER `status`, NICHT ÜBER DIE NEUE SPALTE
--   session_id NULL + status 'listed'    → Dauerangebot, liegt im Regal
--   session_id NULL + status 'scheduled' → für eine Show vorbereitet
--   session_id gesetzt                   → in der Show
--
-- Das ist kein Zufall, sondern der Grund, warum nichts kollidiert: `shelfQuery`
-- in `lib/useListings.ts` filtert auf `status = 'listed'`. Ein vorbereiteter
-- Artikel taucht dort also nicht auf, ohne dass eine Zeile Code geändert wird.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Die Spalte ───────────────────────────────────────────────────────────
-- `ON DELETE SET NULL`, nicht CASCADE: Sagt jemand seinen Termin ab, sollen
-- seine vorbereiteten Artikel NICHT mitgelöscht werden. Sie fallen zurück in
-- „vorbereitet, ohne Termin" und lassen sich der nächsten Show zuordnen.
-- CASCADE hätte einen Abend Arbeit an einem Fehltipp vernichtet.
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS planned_for uuid
  REFERENCES public.scheduled_lives(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.live_auctions.planned_for IS
  'Termin, für den dieser Artikel vorbereitet wurde. Bleibt nach dem Live-Gehen '
  'stehen (Herkunft). NULL = Dauerangebot oder ohne Termin vorbereitet.';

-- Der Zugriff läuft immer über „meine vorbereiteten Artikel" oder „was liegt
-- für diesen Termin bereit". Partiell, weil die Spalte bei fast allen Zeilen
-- NULL ist (jedes Dauerangebot, jeder Show-Artikel).
CREATE INDEX IF NOT EXISTS live_auctions_planned_for
  ON public.live_auctions (planned_for)
  WHERE planned_for IS NOT NULL;

-- ⚠️ KEIN `GRANT SELECT (planned_for)` nötig — `live_auctions` hat kein
-- spaltenweises REVOKE (CLAUDE.md Regel 11 betrifft `live_sessions`,
-- `user_whip_ingresses`, `profiles`). Gegenprobe unten.

-- ─── 2. Einen Artikel vorbereiten ────────────────────────────────────────────
-- Bewusst eine eigene RPC statt eines Parameters an `create_standing_listing`:
-- Ein Dauerangebot und ein Show-Artikel sind verschiedene Dinge. Das eine hat
-- einen Festpreis und liegt rund um die Uhr, das andere hat einen Startpreis
-- und einen Mindestschritt. Sie in eine Funktion zu zwingen hieße, die Hälfte
-- der Parameter je nach Fall zu ignorieren.
CREATE OR REPLACE FUNCTION public.prepare_live_auction(
  p_planned_for    uuid,
  p_title          text,
  p_start_cents    integer,
  p_increment_cents integer DEFAULT 100,
  p_image_url      text DEFAULT NULL,
  p_buy_now_cents  integer DEFAULT NULL,
  p_category       text DEFAULT NULL,
  p_condition      text DEFAULT NULL,
  p_size           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_host  uuid;
  v_id    uuid;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Der Termin muss MIR gehören. Ohne diese Prüfung könnte jeder Artikel in
  -- die Show eines Fremden legen — sie würden beim Live-Gehen automatisch
  -- übernommen, und der Gastgeber verkauft ungewollt fremde Ware.
  SELECT host_id INTO v_host
    FROM public.scheduled_lives
   WHERE id = p_planned_for AND app = 'berkat';
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'schedule_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL OR char_length(btrim(p_title)) < 2 THEN
    RAISE EXCEPTION 'title_too_short' USING ERRCODE = '22023';
  END IF;
  IF p_start_cents IS NULL OR p_start_cents < 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.berkat_categories WHERE slug = p_category AND active
  ) THEN
    RAISE EXCEPTION 'unknown_category' USING ERRCODE = '22023';
  END IF;

  -- Deckel gegen Versehen und Missbrauch. Fünfzig Artikel sind mehr, als in
  -- einen Abend passen; wer mehr braucht, hat ein anderes Problem als ein
  -- fehlendes Limit.
  SELECT count(*) INTO v_count
    FROM public.live_auctions
   WHERE planned_for = p_planned_for AND session_id IS NULL;
  IF v_count >= 50 THEN
    RAISE EXCEPTION 'too_many_prepared' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_auctions (
    session_id, planned_for, seller_id, title, image_url,
    start_price_cents, min_increment_cents, buy_now_cents,
    status, category, condition, size, sort_index
  ) VALUES (
    NULL, p_planned_for, v_uid, btrim(p_title), NULLIF(btrim(coalesce(p_image_url, '')), ''),
    p_start_cents, greatest(coalesce(p_increment_cents, 100), 100), p_buy_now_cents,
    'scheduled', p_category,
    NULLIF(btrim(coalesce(p_condition, '')), ''),
    NULLIF(btrim(coalesce(p_size, '')), ''),
    v_count
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.prepare_live_auction(
  uuid, text, integer, integer, text, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_live_auction(
  uuid, text, integer, integer, text, integer, text, text, text) TO authenticated;

-- ─── 3. Beim Live-Gehen übernehmen ───────────────────────────────────────────
-- Der Kern des Ganzen, und bewusst ein UPDATE statt eines Kopierens: Whatnot
-- hat `Reserve for Live` im Juli 2026 genau so umgestellt — VERSCHIEBEN, nicht
-- duplizieren. Eine Kopie hätte zwei Wahrheiten über denselben Artikel und die
-- Frage, welche der Käufer gesehen hat.
CREATE OR REPLACE FUNCTION public.claim_prepared_auctions(
  p_session_id uuid,
  p_planned_for uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_host  uuid;
  v_moved integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT host_id INTO v_host FROM public.live_sessions WHERE id = p_session_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Ohne `p_planned_for` werden ALLE eigenen vorbereiteten Artikel übernommen.
  -- Das ist der Fall „ich sende spontan und will meine Vorbereitung nutzen";
  -- mit Termin-ID nur die dieses Abends.
  UPDATE public.live_auctions
     SET session_id = p_session_id,
         updated_at = now()
   WHERE seller_id = v_uid
     AND session_id IS NULL
     AND status = 'scheduled'
     AND (p_planned_for IS NULL OR planned_for = p_planned_for);

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END $$;

REVOKE ALL ON FUNCTION public.claim_prepared_auctions(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_prepared_auctions(uuid, uuid) TO authenticated;

-- ─── 4. Vorbereitetes wieder wegnehmen ───────────────────────────────────────
-- Ein eigener Weg, weil `cancel_standing_listing` auf `status = 'listed'` prüft
-- und einen vorbereiteten Artikel deshalb nicht findet.
CREATE OR REPLACE FUNCTION public.discard_prepared_auction(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a     public.live_auctions;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_id FOR UPDATE;
  -- `session_id IS NOT NULL` heißt: Der Artikel ist schon in einer Show. Dort
  -- gilt `cancel_auction`, weil dann Gebote im Spiel sein können.
  IF NOT FOUND OR a.session_id IS NOT NULL OR a.status <> 'scheduled' THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.live_auctions WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.discard_prepared_auction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discard_prepared_auction(uuid) TO authenticated;

-- ─── Gegenprobe ──────────────────────────────────────────────────────────────
-- 1. Neue Spalte ohne GRANT lesbar? (muss `true` ergeben)
--      SELECT has_column_privilege('authenticated', 'public.live_auctions', 'planned_for', 'SELECT');
--
-- 2. Fremder Termin wird abgewiesen:
--      SELECT prepare_live_auction('<Termin eines anderen>', 'Test', 500);
--      -- muss 42501 „forbidden" werfen
--
-- 3. Vorbereitetes taucht NICHT im Regal auf:
--      SELECT count(*) FROM live_auctions WHERE session_id IS NULL AND status = 'listed';
--      -- Zahl muss vor und nach `prepare_live_auction` gleich bleiben
--
-- 4. Übernahme verschiebt statt zu kopieren:
--      SELECT count(*) FROM live_auctions WHERE planned_for = '<Termin>';
--      -- vor und nach `claim_prepared_auctions` gleich; nur `session_id` ist gesetzt
