-- Angebotsfelder für den Marktplatz — und zwei Lücken, die dabei auffielen
--
-- WARUM
-- Ein Dauerangebot hat heute Titel, Bild, Preis, Kategorie. Für einen
-- Live-Verkauf reicht das: Der Verkäufer hält den Artikel in die Kamera und
-- erzählt dazu. Für ein Angebot, das ohne Sendung dasteht, reicht es nicht —
-- da ist der Text die einzige Beschreibung, die es je geben wird.
--
-- Drei Felder, mehr nicht: Beschreibung, Zustand, Ort. Alle FREIWILLIG.
-- Das ist eine bewusste Grenze: Berkats Verkaufsargument gegenüber einer
-- WhatsApp-Gruppe ist „schneller als eine Nachricht". Wer daraus ein
-- Kleinanzeigen-Formular macht, baut genau die Reibung wieder auf, die
-- abgeschafft werden soll.
--
-- `condition` ist dabei nicht Kosmetik, sondern der rechtliche Träger: Beim
-- Privatverkauf ist der beschriebene Zustand das, woran sich der Verkäufer
-- messen lassen muss.

BEGIN;

-- ─── Angebotsfelder ──────────────────────────────────────────────────────────
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS description text
    CHECK (description IS NULL OR char_length(description) <= 2000),
  ADD COLUMN IF NOT EXISTS condition text
    CHECK (condition IS NULL OR condition IN
      ('neu-mit-etikett', 'neu', 'sehr-gut', 'gut', 'in-ordnung', 'defekt')),
  ADD COLUMN IF NOT EXISTS postal_code text
    CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{4,5}$'),
  ADD COLUMN IF NOT EXISTS city text
    CHECK (city IS NULL OR char_length(city) <= 80);

COMMENT ON COLUMN public.live_auctions.condition IS
  'Zustand als Slug. ⚠️ Der Anzeigename gehört NICHT hierher — sobald ein Wert '
  'eine gepflegte Liste bekommt, hört er auf, sein eigener Anzeigename zu sein '
  '(Übergabe Abschnitt 18, die Kategorie-Leiste zeigte deshalb Slugs).';

COMMENT ON COLUMN public.live_auctions.postal_code IS
  'Grobe Ortsangabe des ARTIKELS, nicht des Menschen. Bewusst nur PLZ und Ort, '
  'keine Straße: Für „ist das in meiner Nähe" reicht das, und eine genaue '
  'Adresse in einem öffentlich lesbaren Angebot wäre nicht zu rechtfertigen.';

-- Vorsichtshalber, dieselbe Zeile wie bei `category` (20260816120000:88):
-- Wirkungslos, solange auf der Tabelle ein Tabellen-Recht steht — und die
-- Rettung, falls dort je ein spaltenweises REVOKE gesetzt wurde.
GRANT SELECT (description, condition, postal_code, city)
  ON public.live_auctions TO anon, authenticated;

-- Filter „was liegt in meiner Gegend": Präfix-Suche auf der PLZ. Kein PostGIS,
-- kein earthdistance — beides ist in dieser geteilten Produktivdatenbank nicht
-- installiert, und eine Extension dafür zu aktivieren wäre ein Eingriff, den
-- Serlo mitträgt. Ein Präfix-Index kann später ohne Datenwanderung durch echte
-- Koordinaten ersetzt werden.
CREATE INDEX IF NOT EXISTS idx_live_auctions_shelf_postal
  ON public.live_auctions (postal_code text_pattern_ops)
  WHERE session_id IS NULL AND status = 'listed';

-- ─── Der Anlege-Weg ──────────────────────────────────────────────────────────
-- ⚠️ ALLE bisherigen Signaturen fallen, nicht nur die letzte.
-- Ein `DROP` der aktuellen Fassung allein macht die Datei beim zweiten Lauf
-- kaputt und lässt im Katalog eine Altfassung stehen — zwei Überladungen machen
-- PostgREST mehrdeutig (HTTP 300). Am 16.08.2026 genau so passiert (42723).
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean, text);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean, text, text, text, text, text);

CREATE FUNCTION public.create_standing_listing(
  p_title       text,
  p_price_cents integer,
  p_image_url   text DEFAULT NULL,
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

  -- Anbietertyp mitstempeln. KEIN Riegel, wenn keine Zeile da ist: Ein
  -- Rechtsfeld, das den Verkäufer beim letzten Handgriff aussperrt, holt
  -- niemanden herüber. Fehlt die Angabe, bleibt sie NULL — die Oberfläche
  -- fragt danach, die Datenbank verweigert nicht.
  SELECT kind INTO v_kind FROM public.berkat_sellers WHERE user_id = v_uid;

  INSERT INTO public.live_auctions (
    session_id, seller_id, title, image_url,
    start_price_cents, buy_now_cents, status, women_only, category,
    description, condition, postal_code, city, seller_kind
  ) VALUES (
    NULL, v_uid, btrim(p_title), NULLIF(btrim(coalesce(p_image_url, '')), ''),
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

REVOKE ALL ON FUNCTION public.create_standing_listing(text, integer, text, boolean, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_standing_listing(text, integer, text, boolean, text, text, text, text, text)
  TO authenticated;

-- ─── Zwei Lücken, die beim Entwurf auffielen ─────────────────────────────────
--
-- ⚠️ LÜCKE 1: `buy_now_live_auction` prüft `women_only` nicht.
-- Die Funktion ist SECURITY DEFINER, liest die Zeile mit `SELECT * … FOR UPDATE`
-- und umgeht damit RLS. Geprüft werden Preis, Status, Verkäufer und
-- Selbstüberbieten — die Frauen-Only-Kennzeichnung an keiner Stelle.
--
-- Heute folgenlos, weil die einzige Quelle einer Artikel-UUID der RLS-gefilterte
-- Lesepfad ist. Das ändert sich, sobald Artikel-Links in Nachrichten geteilt
-- werden — und genau das ist der nächste Schritt. Ein Frauen-Only-Artikel wäre
-- dann für jeden mit dem Link kaufbar.
--
-- ⚠️ LÜCKE 2: die ZAG-Schranke.
-- Läuft das Geld eines fremden Verkäufers über das Stripe-Konto des Betreibers,
-- ist das erlaubnispflichtig. Solange es kein Connect gibt, darf nur über die
-- Kasse verkaufen, wer ausdrücklich freigeschaltet ist.
--
-- ⚠️ ENTSCHEIDEND: „keine Zeile" heißt „wie bisher", nicht „gesperrt".
-- Ein Riegel mit Vorgabe `false` und ohne Backfill hätte ab dem Einspielen JEDES
-- Dauerangebot unkaufbar gemacht — auch die des Betreibers, also genau den
-- einen Weg, der am 16.08.2026 mit einem echten Kauf belegt wurde. Deshalb
-- greift die Schranke nur bei einer Zeile, die ausdrücklich `false` sagt.
-- ⚠️ Der Rumpf ist WÖRTLICH der aus `20260815210000` — es kommen nur die zwei
-- Wächter dazu. Beim ersten Anlauf hatte ich ihn neu geschrieben und dabei
-- `buy_now_gone`, den Eintrag in `live_bids`, `bid_count`, `ends_at` und den
-- jsonb-Rückgabewert verloren. Der geänderte Rückgabetyp allein hätte die
-- Migration scheitern lassen (Postgres lässt ihn per CREATE OR REPLACE nicht
-- ändern) — genau die Stelle, an der laut CLAUDE.md schon einmal spätere
-- Änderungen verlorengingen. Wer hier wieder etwas ändert: vorher das Original
-- danebenlegen.
CREATE OR REPLACE FUNCTION public.buy_now_live_auction(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a       public.live_auctions;
  v_uid   uuid := auth.uid();
  v_ok    boolean;
  v_cart  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  -- ── Wächter 1: Frauen-Only ──
  -- Bewusst dieselbe Meldung wie „gibt es nicht": Sonst verrät der Fehlertext
  -- die Existenz eines Frauen-Only-Artikels.
  IF a.women_only
     AND a.seller_id <> v_uid
     AND NOT public.is_women_only_verified() THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  IF a.buy_now_cents IS NULL THEN
    RAISE EXCEPTION 'no_buy_now' USING ERRCODE = '22023';
  END IF;
  IF a.status NOT IN ('scheduled', 'running', 'listed') THEN
    RAISE EXCEPTION 'auction_closed' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;
  -- Sobald jemand über dem Sofortkaufpreis bietet, ist der Sofortkauf weg.
  IF a.current_bid_cents IS NOT NULL AND a.current_bid_cents >= a.buy_now_cents THEN
    RAISE EXCEPTION 'buy_now_gone' USING ERRCODE = '22023';
  END IF;

  -- ── Wächter 2: die ZAG-Schranke ──
  -- Nur für das Regal: Ein Artikel in einer laufenden Sendung hat einen
  -- Verkäufer, der sich bewusst zum Senden entschieden hat — dieser Weg wird
  -- mit der Verkäufer-Aufnahme geregelt, nicht hier.
  IF a.session_id IS NULL THEN
    SELECT checkout_enabled INTO v_ok
      FROM public.berkat_sellers WHERE user_id = a.seller_id;
    IF v_ok IS NOT NULL AND v_ok = false THEN
      RAISE EXCEPTION 'contact_seller' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_cart := public.ensure_auction_cart(v_uid, a.seller_id);

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (a.id, v_uid, a.buy_now_cents);

  UPDATE public.live_auctions
     SET status            = 'sold',
         current_bid_cents = a.buy_now_cents,
         current_bidder_id = v_uid,
         winner_id         = v_uid,
         bid_count         = a.bid_count + 1,
         settled_at        = now(),
         ends_at           = now(),
         cart_id           = v_cart
   WHERE id = a.id;

  RETURN jsonb_build_object(
    'auction_id', a.id,
    'status',     'sold',
    'winner_id',  v_uid,
    'cart_id',    v_cart,
    'paid_cents', a.buy_now_cents
  );
END $$;

REVOKE ALL ON FUNCTION public.buy_now_live_auction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_now_live_auction(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- 1. Es gibt GENAU EINE Fassung von create_standing_listing:
--      SELECT oid::regprocedure FROM pg_proc WHERE proname = 'create_standing_listing';
--    Zwei Zeilen heißen HTTP 300 beim nächsten Aufruf.
--
-- 2. Der bestehende Kaufweg lebt weiter. Es gibt heute genau zwei Dauerangebote
--    und für keinen Verkäufer eine Zeile in `berkat_sellers` — beide müssen
--    also weiter kaufbar sein. Prüfen, indem man eines aus der App kauft.
--
-- 3. Die neuen Spalten sind ohne Anmeldung lesbar:
--      GET /rest/v1/live_auctions?select=id,description,condition,postal_code,city&limit=1  -> 200
--
-- 4. Die Frauen-Only-Schranke: Ein nicht geprüftes Konto ruft
--    `buy_now_live_auction` mit der UUID eines Frauen-Only-Dauerangebots.
--    Erwartet: `auction_not_found` — NICHT „permission denied", sonst verrät
--    die Meldung die Existenz.
--
-- ⚠️ WAS DIESE MIGRATION BEWUSST NICHT TUT
-- Sie fasst `settle_live_auction`, den Sofortkauf in der Show und
-- `create_berkat_tip` nicht an. Alle drei führen ebenfalls Geld zum Verkäufer.
-- Solange es keinen fremden Verkäufer gibt, ist dort nichts zu schranken — und
-- ein Riegel in `settle_live_auction` würde einen laufenden Zuschlag mitten in
-- der Sendung zum Scheitern bringen. Der richtige Ort dafür ist die Aufnahme
-- eines Verkäufers, zusammen mit Stripe Connect.
