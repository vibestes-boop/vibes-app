-- Shop-Vollausbau: Mehrbild, Bearbeiten, Merkliste
--
-- Zaur am 17.08.2026: „Dass es keine angebotenen Produkte gibt, ist kein Grund,
-- die App nicht vollständig zu bauen." Dieselbe Ansage wie am 16.08. („nichts
-- weglassen, alles bauen") — die Zurückhaltung aus HANDOFF 20/21 („keine
-- Filter, ein Bild reicht") ist damit aufgehoben.
--
-- Drei Stücke, alle am Regal:
--   1. Mehrbild     — `image_urls text[]`, das Cover bleibt `image_url`
--   2. Bearbeiten   — `update_standing_listing`, bislang hieß Preis senken
--                     „zurückziehen und neu anlegen"
--   3. Merkliste    — `berkat_saved_listings`, nur für den Besitzer lesbar

BEGIN;

-- ─── 1. Mehrbild ─────────────────────────────────────────────────────────────
--
-- VERTRAG: `image_urls` trägt ALLE Bilder in Reihenfolge, `image_url` bleibt
-- das Cover und ist immer `image_urls[1]`. Damit liest jede bestehende Fläche
-- (Karten, Live-Raum, Aktivität, Serlo-Web) unverändert weiter — nur die
-- Artikelseite blättert durch die Liste. Die RPCs unten halten beide synchron;
-- wer je einen dritten Schreibweg baut, muss das auch.
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

-- Backfill für den Bestand: ein vorhandenes Einzelbild wird zur Ein-Bild-Liste.
-- Bewusst über ALLE Zeilen (auch Show-Artikel) — der Vertrag oben gilt für die
-- Tabelle, nicht für ein Regal.
UPDATE public.live_auctions
   SET image_urls = ARRAY[image_url]
 WHERE image_url IS NOT NULL
   AND image_urls = '{}';

-- `live_auctions` hat KEINE eingefrorene Spaltenliste (das betrifft nur
-- live_sessions, user_whip_ingresses und profiles, HANDOFF 3) — die neue
-- Spalte ist ohne eigenes GRANT sichtbar.

-- ─── 2. create_standing_listing: nimmt jetzt eine Bild-LISTE ─────────────────
--
-- ⚠️ WIEDER ALLE SIGNATUREN, die es je gab — sonst ist die Datei beim zweiten
-- Lauf kaputt oder lässt eine Überladung im Katalog (PostgREST: HTTP 300).
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean, text);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text[], boolean, text, text, text, text, text);

CREATE FUNCTION public.create_standing_listing(
  p_title       text,
  p_price_cents integer,
  p_image_urls  text[] DEFAULT NULL,
  p_women_only  boolean DEFAULT false,
  p_category    text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_condition   text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_city        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_kind text;
  v_urls text[];
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_price_cents IS NULL OR p_price_cents <= 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;
  IF p_women_only AND NOT public.is_women_only_verified() THEN
    RAISE EXCEPTION 'not_women_only_verified' USING ERRCODE = '42501';
  END IF;
  IF p_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.berkat_categories WHERE slug = p_category AND active
  ) THEN
    RAISE EXCEPTION 'unknown_category' USING ERRCODE = '22023';
  END IF;

  -- Leere Einträge fallen raus, die Reihenfolge bleibt. Acht ist die Grenze —
  -- genug für Zustand von allen Seiten, zu wenig für einen Katalog-Abwurf.
  v_urls := ARRAY(
    SELECT btrim(u)
      FROM unnest(coalesce(p_image_urls, '{}'::text[])) WITH ORDINALITY AS t(u, ord)
     WHERE NULLIF(btrim(u), '') IS NOT NULL
     ORDER BY ord
  );
  IF coalesce(array_length(v_urls, 1), 0) > 8 THEN
    RAISE EXCEPTION 'too_many_images' USING ERRCODE = '22023';
  END IF;

  -- Die Vorgabe „privat" wird festgehalten, weil sie im Composer sichtbar über
  -- dem Knopf steht (20260816220000). `checkout_enabled` bleibt bei seiner
  -- Vorgabe false — die Kassen-Freigabe erteilt der Betreiber, nicht dieser Weg.
  INSERT INTO public.berkat_sellers (user_id, kind)
  VALUES (v_uid, 'private')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT kind INTO v_kind FROM public.berkat_sellers WHERE user_id = v_uid;

  INSERT INTO public.live_auctions (
    session_id, seller_id, title, image_url, image_urls,
    start_price_cents, buy_now_cents, status, women_only, category,
    description, condition, postal_code, city, seller_kind
  ) VALUES (
    NULL, v_uid, btrim(p_title), v_urls[1], v_urls,
    100, p_price_cents, 'listed', coalesce(p_women_only, false), p_category,
    NULLIF(btrim(coalesce(p_description, '')), ''),
    NULLIF(btrim(coalesce(p_condition, '')), ''),
    NULLIF(btrim(coalesce(p_postal_code, '')), ''),
    NULLIF(btrim(coalesce(p_city, '')), ''),
    v_kind
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_standing_listing(text, integer, text[], boolean, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_standing_listing(text, integer, text[], boolean, text, text, text, text, text)
  TO authenticated;

-- ─── 3. update_standing_listing: Bearbeiten statt Löschen-und-neu ────────────
--
-- Vollersatz-Semantik, kein „NULL heißt behalten": Das Formular ist vorbefüllt
-- und schickt immer alle Felder — was ankommt, gilt. Sonst könnte niemand je
-- eine Beschreibung LEEREN. (Der Gegenentwurf mit COALESCE lebt in
-- `set_berkat_seller_kind`, wo der Aufrufer eben NICHT alle Felder schickt.)
--
-- `seller_kind` wird bewusst NICHT angefasst: Den pflegt ausschließlich
-- `set_berkat_seller_kind`, damit es genau eine Wahrheit über den Anbietertyp
-- gibt.
DROP FUNCTION IF EXISTS public.update_standing_listing(uuid, text, integer, text[], boolean, text, text, text, text, text);

CREATE FUNCTION public.update_standing_listing(
  p_id          uuid,
  p_title       text,
  p_price_cents integer,
  p_image_urls  text[] DEFAULT NULL,
  p_women_only  boolean DEFAULT false,
  p_category    text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_condition   text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_city        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a      public.live_auctions;
  v_uid  uuid := auth.uid();
  v_urls text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE: gegen den Wettlauf mit `buy_now_live_auction` — wer gerade
  -- kauft, hält die Zeile, und der Verkäufer ändert danach ins Leere
  -- (`listing_not_found`, weil der Status dann nicht mehr `listed` ist).
  SELECT * INTO a FROM public.live_auctions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR a.session_id IS NOT NULL THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF a.status <> 'listed' THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;

  IF p_title IS NULL OR char_length(btrim(p_title)) < 2 THEN
    RAISE EXCEPTION 'title_too_short' USING ERRCODE = '22023';
  END IF;
  IF p_price_cents IS NULL OR p_price_cents <= 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;
  IF p_women_only AND NOT public.is_women_only_verified() THEN
    RAISE EXCEPTION 'not_women_only_verified' USING ERRCODE = '42501';
  END IF;
  IF p_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.berkat_categories WHERE slug = p_category AND active
  ) THEN
    RAISE EXCEPTION 'unknown_category' USING ERRCODE = '22023';
  END IF;

  v_urls := ARRAY(
    SELECT btrim(u)
      FROM unnest(coalesce(p_image_urls, '{}'::text[])) WITH ORDINALITY AS t(u, ord)
     WHERE NULLIF(btrim(u), '') IS NOT NULL
     ORDER BY ord
  );
  IF coalesce(array_length(v_urls, 1), 0) > 8 THEN
    RAISE EXCEPTION 'too_many_images' USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_auctions
     SET title        = btrim(p_title),
         buy_now_cents = p_price_cents,
         image_url    = v_urls[1],
         image_urls   = v_urls,
         women_only   = coalesce(p_women_only, false),
         category     = p_category,
         description  = NULLIF(btrim(coalesce(p_description, '')), ''),
         condition    = NULLIF(btrim(coalesce(p_condition, '')), ''),
         postal_code  = NULLIF(btrim(coalesce(p_postal_code, '')), ''),
         city         = NULLIF(btrim(coalesce(p_city, '')), '')
   WHERE id = a.id;
END $$;

REVOKE ALL ON FUNCTION public.update_standing_listing(uuid, text, integer, text[], boolean, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_standing_listing(uuid, text, integer, text[], boolean, text, text, text, text, text)
  TO authenticated;

-- ─── 4. Merkliste ────────────────────────────────────────────────────────────
--
-- Nur der Besitzer sieht seine Zeilen — wer was gemerkt hat, ist eine private
-- Auskunft. Ein Frauen-Only-Artikel bleibt doppelt geschützt: Die Merkliste
-- gibt nur IDs her, und die Anzeige holt die Artikel über `live_auctions`,
-- deren RLS die Grenze ohnehin zieht.
CREATE TABLE IF NOT EXISTS public.berkat_saved_listings (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  auction_id uuid NOT NULL REFERENCES public.live_auctions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, auction_id)
);

-- Für die CASCADE-Löschung, wenn je ein Angebot hart gelöscht wird.
CREATE INDEX IF NOT EXISTS idx_berkat_saved_auction
  ON public.berkat_saved_listings (auction_id);

ALTER TABLE public.berkat_saved_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS berkat_saved_select_own ON public.berkat_saved_listings;
CREATE POLICY berkat_saved_select_own ON public.berkat_saved_listings
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS berkat_saved_insert_own ON public.berkat_saved_listings;
CREATE POLICY berkat_saved_insert_own ON public.berkat_saved_listings
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS berkat_saved_delete_own ON public.berkat_saved_listings;
CREATE POLICY berkat_saved_delete_own ON public.berkat_saved_listings
  FOR DELETE USING (user_id = auth.uid());

-- Kein UPDATE-Grant: Es gibt nichts zu ändern — merken oder nicht.
REVOKE ALL ON public.berkat_saved_listings FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.berkat_saved_listings TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- 1. Je genau EINE Fassung im Katalog:
--      SELECT oid::regprocedure FROM pg_proc
--       WHERE proname IN ('create_standing_listing', 'update_standing_listing');
--
-- 2. Bestand ist migriert: kein Angebot mit Bild aber leerer Liste —
--      SELECT count(*) FROM live_auctions
--       WHERE image_url IS NOT NULL AND image_urls = '{}';   -- muss 0 sein
--
-- 3. Merkliste ist dicht: SELECT ohne Anmeldung → leere Menge; INSERT mit
--    fremder user_id → RLS-Fehler.
--
-- 4. Bearbeiten fremder Angebote: `update_standing_listing` mit fremder ID
--    → `forbidden`.
