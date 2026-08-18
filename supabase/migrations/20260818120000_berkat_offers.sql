-- Preisvorschlag — handeln, aber mit Zustand
--
-- WARUM DAS KEINE SKALEN-FUNKTION IST
-- Am 18.08.2026 stand in einer Shop-Analyse noch „strukturierter Preisvorschlag
-- würde ich NICHT bauen" — begründet mit der Angebotszahl (es liegen zwei
-- Artikel in der Datenbank). Das war der falsche Maßstab: Handeln ist in dieser
-- Community und auf Kleinanzeigen die Norm, nicht die Ausnahme. Ein Marktplatz
-- ohne Verhandeln ist für sie ein Katalog.
--
-- Berkat hatte den Weg ohnehin halb gebaut: Der „Nachricht"-Knopf am
-- Privatangebot IST ein Preisvorschlag, nur unstrukturiert. Was fehlte, war die
-- Zahl und ein Zustand, den BEIDE Seiten sehen.
--
-- Vorbild ist Whatnots „Accept offers": ein Schalter je Angebot, und der
-- Verkäufer kann annehmen, kontern oder ablehnen.

BEGIN;

-- ─── 1. Der Schalter am Angebot ──────────────────────────────────────────────
--
-- Vorgabe `false`, und das ist Absicht: Ein gewerblicher Verkäufer mit Festpreis
-- will keine Vorschläge, und ein Angebot, das stillschweigend verhandelbar wird,
-- ist eine Aussage, die der Verkäufer nie getroffen hat (dieselbe Lehre wie bei
-- der Anbieterkennzeichnung, Übergabe Abschnitt 3). Der Composer setzt den
-- Schalter für NEUE Angebote sichtbar auf an — dort ist er dann erklärt.
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS accepts_offers boolean NOT NULL DEFAULT false;

-- ─── 2. Die Vorschläge ───────────────────────────────────────────────────────
--
-- `seller_id` steht mit in der Zeile, obwohl es über `live_auctions` ableitbar
-- wäre: Die RLS-Policy braucht es ohne Join, und der Verkäufer fragt „was liegt
-- bei MIR" über alle seine Angebote hinweg ab.
CREATE TABLE IF NOT EXISTS public.berkat_offers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id    uuid NOT NULL REFERENCES public.live_auctions(id) ON DELETE CASCADE,
  buyer_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents  integer NOT NULL CHECK (amount_cents > 100),
  /** Gegenvorschlag des Verkäufers. Nur gesetzt, wenn `status = 'countered'`. */
  counter_cents integer CHECK (counter_cents IS NULL OR counter_cents > 100),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'countered', 'withdrawn')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  CHECK (buyer_id <> seller_id)
);

-- ⚠️ Genau EIN offener Vorschlag je Käufer und Artikel. Ohne das wird aus
-- „handeln" ein Bombardement, und der Verkäufer sieht dieselbe Person fünfmal.
-- Ein Teil-Index, weil abgelehnte und angenommene Vorschläge liegen bleiben
-- sollen — sie sind die Geschichte der Verhandlung.
CREATE UNIQUE INDEX IF NOT EXISTS idx_berkat_offers_one_open
  ON public.berkat_offers (auction_id, buyer_id)
  WHERE status IN ('pending', 'countered');

CREATE INDEX IF NOT EXISTS idx_berkat_offers_seller
  ON public.berkat_offers (seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_berkat_offers_buyer
  ON public.berkat_offers (buyer_id, created_at DESC);

ALTER TABLE public.berkat_offers ENABLE ROW LEVEL SECURITY;

-- Nur die zwei Beteiligten. Ein Vorschlag ist eine Verhandlung, keine
-- öffentliche Auskunft — was jemand zu zahlen bereit war, geht Dritte nichts an.
-- ⚠️ Ausdrücklich KEIN `USING(true)`: Postgres verknüpft permissive Policies mit
-- ODER, und eine schrankenlose hebelt jede andere aus (Übergabe Abschnitt 5).
DROP POLICY IF EXISTS berkat_offers_select_party ON public.berkat_offers;
CREATE POLICY berkat_offers_select_party ON public.berkat_offers
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Geschrieben wird ausschließlich über die RPCs — sonst könnte ein Käufer
-- seinen eigenen Vorschlag auf „angenommen" setzen.
REVOKE ALL ON public.berkat_offers FROM PUBLIC, anon;
GRANT SELECT ON public.berkat_offers TO authenticated;

-- ─── 3. Vorschlag machen ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.make_berkat_offer(
  p_auction_id   uuid,
  p_amount_cents integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a     public.live_auctions;
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id;
  IF NOT FOUND OR a.session_id IS NOT NULL THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;

  -- Frauen-Only: dieselbe Meldung wie „gibt es nicht", damit die Existenz eines
  -- geschützten Artikels nicht über die Fehlermeldung durchsickert.
  IF a.women_only AND a.seller_id <> v_uid AND NOT public.is_women_only_verified() THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;

  IF a.status <> 'listed' THEN
    RAISE EXCEPTION 'auction_closed' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;
  IF NOT a.accepts_offers THEN
    RAISE EXCEPTION 'offers_not_accepted' USING ERRCODE = '22023';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;
  -- Ein Vorschlag ÜBER dem Preis ist kein Vorschlag, sondern ein Kauf. Ihn
  -- anzunehmen wäre für den Käufer schlechter als der Kaufknopf daneben.
  IF p_amount_cents >= a.buy_now_cents THEN
    RAISE EXCEPTION 'offer_above_price' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.berkat_offers (auction_id, buyer_id, seller_id, amount_cents)
  VALUES (a.id, v_uid, a.seller_id, p_amount_cents)
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  -- Der Teil-Index oben. Als freundlicher Fehler statt als Constraint-Text.
  WHEN unique_violation THEN
    RAISE EXCEPTION 'offer_already_open' USING ERRCODE = '22023';
END $$;

REVOKE ALL ON FUNCTION public.make_berkat_offer(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.make_berkat_offer(uuid, integer) TO authenticated;

-- ─── 4. Antworten ────────────────────────────────────────────────────────────
--
-- Ein Weg für alle drei Antworten, weil sie dieselben Prüfungen brauchen und
-- sich gegenseitig ausschließen. `accept` ändert dabei NICHTS am Angebot — der
-- Preis am Artikel bleibt, was er ist. Der angenommene Vorschlag ist eine
-- Zusage AN DIESEN EINEN KÄUFER, und nur `buy_now_live_auction` löst sie ein.
CREATE OR REPLACE FUNCTION public.respond_berkat_offer(
  p_offer_id      uuid,
  p_action        text,
  p_counter_cents integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o     public.berkat_offers;
  a     public.live_auctions;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('accept', 'decline', 'counter') THEN
    RAISE EXCEPTION 'unknown_action' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO o FROM public.berkat_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer_not_found' USING ERRCODE = '22023';
  END IF;
  IF o.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF o.status <> 'pending' THEN
    RAISE EXCEPTION 'offer_closed' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = o.auction_id;
  IF a.status <> 'listed' THEN
    RAISE EXCEPTION 'auction_closed' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'counter' THEN
    IF p_counter_cents IS NULL OR p_counter_cents <= o.amount_cents THEN
      -- Ein Gegenvorschlag UNTER dem Vorschlag wäre ein Geschenk, kein Handeln.
      RAISE EXCEPTION 'counter_too_low' USING ERRCODE = '22023';
    END IF;
    IF p_counter_cents >= a.buy_now_cents THEN
      -- Auf den vollen Preis zu kontern heißt „nein" — dann soll es auch „nein"
      -- heißen, sonst wartet der Käufer auf eine Verhandlung, die keine ist.
      RAISE EXCEPTION 'counter_above_price' USING ERRCODE = '22023';
    END IF;
    UPDATE public.berkat_offers
       SET status = 'countered', counter_cents = p_counter_cents, responded_at = now()
     WHERE id = o.id;
  ELSE
    UPDATE public.berkat_offers
       SET status = CASE WHEN p_action = 'accept' THEN 'accepted' ELSE 'declined' END,
           responded_at = now()
     WHERE id = o.id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.respond_berkat_offer(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_berkat_offer(uuid, text, integer) TO authenticated;

-- ─── 5. Zurückziehen (Käufer) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdraw_berkat_offer(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o     public.berkat_offers;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO o FROM public.berkat_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR o.buyer_id <> v_uid THEN
    RAISE EXCEPTION 'offer_not_found' USING ERRCODE = '22023';
  END IF;
  -- Auch einen ANGENOMMENEN darf der Käufer zurückziehen: Die Zusage ist eine
  -- Einladung zum Kauf, kein geschlossener Vertrag — der entsteht erst beim
  -- Kaufknopf. Wer nicht mehr will, soll nicht in einer offenen Zusage hängen.
  IF o.status NOT IN ('pending', 'countered', 'accepted') THEN
    RAISE EXCEPTION 'offer_closed' USING ERRCODE = '22023';
  END IF;

  UPDATE public.berkat_offers
     SET status = 'withdrawn', responded_at = now()
   WHERE id = o.id;
END $$;

REVOKE ALL ON FUNCTION public.withdraw_berkat_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_berkat_offer(uuid) TO authenticated;

-- ─── 6. Einlösen: der Kaufweg lernt den vereinbarten Preis ───────────────────
--
-- ⚠️ ZWEITE ÄNDERUNG AN DIESER FUNKTION AN ZWEI TAGEN. Der Rumpf ist wörtlich
-- der aus `20260817120000`; NEU sind der Parameter `p_offer_id`, die Variablen
-- `o`/`v_price` und der Block „Wächter 3". Das Original lag beim Schreiben
-- daneben — genau die Vorsicht, die die Übergabe für diese Funktion verlangt,
-- weil hier schon einmal `buy_now_gone`, der Eintrag in `live_bids`,
-- `bid_count`, `ends_at` und der jsonb-Rückgabewert verlorengingen.
--
-- DROP + CREATE statt eines defaultierten Parameters an der alten Signatur:
-- Ein Default erzeugt in Postgres eine ÜBERLADUNG, keine geänderte Funktion,
-- und zwei Überladungen machen PostgREST mehrdeutig (HTTP 300). Berkat liegt in
-- keinem Store, ausgelieferte Clients gibt es also nicht.
--
-- WARUM DER PREIS AM ANGEBOT UNANGETASTET BLEIBT: Ein angenommener Vorschlag
-- ist eine Zusage an EINEN Käufer. Würde `accept` den `buy_now_cents` senken,
-- bekäme ihn jeder — und der Verkäufer hätte einen Rabatt verschenkt, den er
-- einer Person zugesagt hat.
DROP FUNCTION IF EXISTS public.buy_now_live_auction(uuid);
DROP FUNCTION IF EXISTS public.buy_now_live_auction(uuid, uuid);

CREATE FUNCTION public.buy_now_live_auction(
  p_auction_id uuid,
  p_offer_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a       public.live_auctions;
  o       public.berkat_offers;
  v_uid   uuid := auth.uid();
  v_ok    boolean;
  v_cart  uuid;
  v_price integer;
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
  --
  -- Nur für das Regal: Ein Artikel in einer laufenden Sendung hat einen
  -- Verkäufer, der sich bewusst zum Senden entschieden hat — dieser Weg wird
  -- mit der Verkäufer-Aufnahme geregelt, nicht hier.
  --
  -- `IS DISTINCT FROM true` statt `IS NOT NULL AND = false`: Damit fällt auch
  -- „keine Zeile" auf gesperrt. Wer hier wieder ein `IS NOT NULL` einbaut, macht
  -- aus einer erlaubnisrechtlichen Schranke eine Vermutung.
  IF a.session_id IS NULL THEN
    SELECT checkout_enabled INTO v_ok
      FROM public.berkat_sellers WHERE user_id = a.seller_id;
    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'contact_seller' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ── Wächter 3: der vereinbarte Preis ── (NEU am 18.08.2026)
  --
  -- Ohne `p_offer_id` gilt der Listenpreis — der alte Weg, unverändert.
  v_price := a.buy_now_cents;

  IF p_offer_id IS NOT NULL THEN
    SELECT * INTO o FROM public.berkat_offers WHERE id = p_offer_id FOR UPDATE;
    IF NOT FOUND
       OR o.auction_id <> a.id            -- Zusage für einen ANDEREN Artikel
       OR o.buyer_id  <> v_uid            -- fremde Zusage einlösen
       OR o.status    <> 'accepted' THEN  -- abgelehnt, offen oder schon benutzt
      RAISE EXCEPTION 'offer_not_valid' USING ERRCODE = '42501';
    END IF;
    -- Der Käufer zahlt nie mehr als den Listenpreis, auch wenn die Zeile je
    -- anders aussähe. Ein Gürtel zum Hosenträger — die RPC ist der einzige Weg
    -- zu diesem Feld, aber sie ist auch der einzige Weg zum Geld.
    v_price := LEAST(o.amount_cents, a.buy_now_cents);
  END IF;

  v_cart := public.ensure_auction_cart(v_uid, a.seller_id);

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (a.id, v_uid, v_price);

  UPDATE public.live_auctions
     SET status            = 'sold',
         current_bid_cents = v_price,
         current_bidder_id = v_uid,
         winner_id         = v_uid,
         bid_count         = a.bid_count + 1,
         settled_at        = now(),
         ends_at           = now(),
         cart_id           = v_cart
   WHERE id = a.id;

  -- Alle noch offenen Vorschläge auf diesen Artikel sind gegenstandslos —
  -- er ist weg. Ohne das warteten andere Käufer auf eine Antwort, die nie
  -- kommt, und der Verkäufer sähe eine Liste toter Verhandlungen.
  UPDATE public.berkat_offers
     SET status = 'declined', responded_at = now()
   WHERE auction_id = a.id
     AND status IN ('pending', 'countered', 'accepted');

  RETURN jsonb_build_object(
    'auction_id', a.id,
    'status',     'sold',
    'winner_id',  v_uid,
    'cart_id',    v_cart,
    'paid_cents', v_price
  );
END $$;

REVOKE ALL ON FUNCTION public.buy_now_live_auction(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_now_live_auction(uuid, uuid) TO authenticated;

-- ─── 7. Der Schalter gehört ins Formular, nicht in einen zweiten Ruf ─────────
--
-- `create_standing_listing` und `update_standing_listing` bekommen
-- `p_accepts_offers`. Der Composer schickt ihn mit dem Rest — ein zweiter Ruf
-- nach dem Anlegen wäre ein Wettlauf und genau die Lösung, die am 17.08. schon
-- einmal verworfen wurde („sonst zwei Rufe und ein Wettlauf").
--
-- ⚠️ Beide Rümpfe sind wörtlich die aus `20260817140000`; NEU ist je der
-- Parameter und die eine Spalte. Das Original lag beim Schreiben daneben.
-- Wieder ALLE Signaturen droppen, sonst bleibt eine Überladung im Katalog
-- (PostgREST: HTTP 300).

DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean, text);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text[], boolean, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text[], boolean, boolean, text, text, text, text, text);

CREATE FUNCTION public.create_standing_listing(
  p_title          text,
  p_price_cents    integer,
  p_image_urls     text[] DEFAULT NULL,
  p_women_only     boolean DEFAULT false,
  p_accepts_offers boolean DEFAULT false,
  p_category       text DEFAULT NULL,
  p_description    text DEFAULT NULL,
  p_condition      text DEFAULT NULL,
  p_postal_code    text DEFAULT NULL,
  p_city           text DEFAULT NULL
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

  v_urls := ARRAY(
    SELECT btrim(u)
      FROM unnest(coalesce(p_image_urls, '{}'::text[])) WITH ORDINALITY AS t(u, ord)
     WHERE NULLIF(btrim(u), '') IS NOT NULL
     ORDER BY ord
  );
  IF coalesce(array_length(v_urls, 1), 0) > 8 THEN
    RAISE EXCEPTION 'too_many_images' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.berkat_sellers (user_id, kind)
  VALUES (v_uid, 'private')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT kind INTO v_kind FROM public.berkat_sellers WHERE user_id = v_uid;

  INSERT INTO public.live_auctions (
    session_id, seller_id, title, image_url, image_urls,
    start_price_cents, buy_now_cents, status, women_only, accepts_offers, category,
    description, condition, postal_code, city, seller_kind
  ) VALUES (
    NULL, v_uid, btrim(p_title), v_urls[1], v_urls,
    100, p_price_cents, 'listed', coalesce(p_women_only, false),
    coalesce(p_accepts_offers, false), p_category,
    NULLIF(btrim(coalesce(p_description, '')), ''),
    NULLIF(btrim(coalesce(p_condition, '')), ''),
    NULLIF(btrim(coalesce(p_postal_code, '')), ''),
    NULLIF(btrim(coalesce(p_city, '')), ''),
    v_kind
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_standing_listing(text, integer, text[], boolean, boolean, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_standing_listing(text, integer, text[], boolean, boolean, text, text, text, text, text)
  TO authenticated;

DROP FUNCTION IF EXISTS public.update_standing_listing(uuid, text, integer, text[], boolean, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_standing_listing(uuid, text, integer, text[], boolean, boolean, text, text, text, text, text);

CREATE FUNCTION public.update_standing_listing(
  p_id             uuid,
  p_title          text,
  p_price_cents    integer,
  p_image_urls     text[] DEFAULT NULL,
  p_women_only     boolean DEFAULT false,
  p_accepts_offers boolean DEFAULT false,
  p_category       text DEFAULT NULL,
  p_description    text DEFAULT NULL,
  p_condition      text DEFAULT NULL,
  p_postal_code    text DEFAULT NULL,
  p_city           text DEFAULT NULL
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
     SET title          = btrim(p_title),
         buy_now_cents  = p_price_cents,
         image_url      = v_urls[1],
         image_urls     = v_urls,
         women_only     = coalesce(p_women_only, false),
         accepts_offers = coalesce(p_accepts_offers, false),
         category       = p_category,
         description    = NULLIF(btrim(coalesce(p_description, '')), ''),
         condition      = NULLIF(btrim(coalesce(p_condition, '')), ''),
         postal_code    = NULLIF(btrim(coalesce(p_postal_code, '')), ''),
         city           = NULLIF(btrim(coalesce(p_city, '')), '')
   WHERE id = a.id;

  -- Wer das Handeln abschaltet, beendet die laufenden Verhandlungen — sonst
  -- wartet jemand auf eine Antwort, die es nicht mehr geben kann.
  IF NOT coalesce(p_accepts_offers, false) THEN
    UPDATE public.berkat_offers
       SET status = 'declined', responded_at = now()
     WHERE auction_id = a.id AND status IN ('pending', 'countered');
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.update_standing_listing(uuid, text, integer, text[], boolean, boolean, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_standing_listing(uuid, text, integer, text[], boolean, boolean, text, text, text, text, text)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- 1. Genau EINE Fassung von `buy_now_live_auction` (sonst HTTP 300):
--      SELECT oid::regprocedure FROM pg_proc WHERE proname = 'buy_now_live_auction';
--
-- 2. `berkat_offers` ist für `anon` dicht: SELECT ohne Anmeldung → 42501.
--
-- 3. Zwei offene Vorschläge desselben Käufers auf denselben Artikel →
--    `offer_already_open`.
--
-- 4. Fremde Zusage einlösen: `buy_now_live_auction(<artikel>, <fremde offer>)`
--    → `offer_not_valid`.
--
-- 5. Ein Kauf ohne `p_offer_id` zahlt weiterhin den Listenpreis.
