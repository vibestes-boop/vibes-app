-- Berkat: Dauerangebote — kaufbar auch ohne laufende Show
--
-- WARUM
-- Bei Berkat hängt bisher ALLES an einer Live-Sendung. Fünf Verkäufer mit je
-- zwei Stunden pro Woche senden zusammen 10 von 168 Stunden — die App ist
-- rund 94 % der Zeit ein leerer Raum. Der Sendeplan beantwortet „wann passiert
-- wieder was"; er beantwortet nicht „was kann ich JETZT tun".
--
-- Whatnot löst das mit zwei Regalen (nachgesehen am 15.08.2026):
--   • **Profile Shop** — Buy-It-Now-Artikel, jederzeit kaufbar
--   • **Live Shop** — Artikel, die für eine Show reserviert sind
-- Der Schalter heißt dort „Reserve for Live"; ohne ihn liegt ein Artikel im
-- Profil-Laden.
--
-- DER ENTWURF: EIN LISTING-TYP, ZWEI REGALE
-- Genau Hebel 4 der Ausgangsanalyse: „Whatnots `transactionType` an EINEM
-- Objekt ist der Grund, warum sie Formate in Tagen ausrollen."
--
-- Ein Dauerangebot ist deshalb **keine neue Tabelle**, sondern eine Zeile in
-- `live_auctions` **ohne Session** mit Status `listed`. Damit erbt es ohne eine
-- Zeile Zusatzarbeit: den Sammelkorb, die Versandpauschale, die Stripe-Kasse,
-- den Webhook, die Zuschlag-Benachrichtigung und die Verkäufer-Bestellliste.
--
-- ⚠️ DIE FALLE, DIE DEN ENTWURF BESTIMMT HAT
-- `live_auctions_select` prüft `EXISTS (SELECT 1 FROM live_sessions WHERE
-- s.id = live_auctions.session_id …)`. Bei `session_id IS NULL` ist das FALSE —
-- ein Dauerangebot wäre **für niemanden sichtbar**, ohne Fehlermeldung.
--
-- Es braucht also eine zweite Lese-Policy. Der Kommentar an der ersten warnt
-- ausdrücklich: **keine `USING(true)`** — Postgres verknüpft permissive Policies
-- mit ODER, und eine einzige schrankenlose hebelt die Frauen-Only-Grenze aus
-- (der Fehler vom 16.07.2026 auf `live_sessions`). Die neue Policy ist deshalb
-- ebenso streng wie die alte. Weil ein Dauerangebot keine Session hat, aus der
-- es `women_only` erben könnte, bekommt es die Kennzeichnung selbst.

BEGIN;

-- ─── 1. Ein Artikel darf ohne Show existieren ────────────────────────────────
ALTER TABLE public.live_auctions ALTER COLUMN session_id DROP NOT NULL;

-- ─── 2. Frauen-Only am Artikel, weil es keine Session zum Erben gibt ─────────
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS women_only boolean NOT NULL DEFAULT false;

-- Falle vom 14.08.2026 (spaltenweises REVOKE macht neue Spalten unsichtbar):
-- für `live_auctions` ist keines bekannt, die Zeile heilt es vorsorglich.
GRANT SELECT (women_only) ON public.live_auctions TO anon, authenticated;

-- ─── 3. Neuer Status ────────────────────────────────────────────────────────
ALTER TABLE public.live_auctions DROP CONSTRAINT IF EXISTS live_auctions_status_check;
ALTER TABLE public.live_auctions ADD CONSTRAINT live_auctions_status_check
  CHECK (status IN ('scheduled', 'running', 'sold', 'unsold', 'cancelled', 'listed'));

-- ─── 4. Die Invariante: Regal und Zustand dürfen nicht auseinanderlaufen ─────
-- Ein Artikel MIT Session ist nie `listed`. Ein Artikel OHNE Session ist
-- `listed` — oder verkauft/zurückgezogen, denn beides überlebt den Kauf.
ALTER TABLE public.live_auctions DROP CONSTRAINT IF EXISTS live_auctions_shelf_check;
ALTER TABLE public.live_auctions ADD CONSTRAINT live_auctions_shelf_check CHECK (
  (session_id IS NOT NULL AND status <> 'listed')
  OR
  (session_id IS NULL AND status IN ('listed', 'sold', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS live_auctions_standing
  ON public.live_auctions (seller_id, created_at DESC)
  WHERE session_id IS NULL AND status = 'listed';

-- ─── 5. Sichtbarkeit — die zweite Policy, ausdrücklich NICHT schrankenlos ────
DROP POLICY IF EXISTS live_auctions_select_standing ON public.live_auctions;
CREATE POLICY live_auctions_select_standing ON public.live_auctions
  FOR SELECT USING (
    session_id IS NULL
    AND (
      women_only = false
      OR seller_id = auth.uid()
      OR public.is_women_only_verified()
    )
  );

-- ─── 6. Anlegen ─────────────────────────────────────────────────────────────
-- INSERT ist vom Client aus gesperrt (siehe 20260813150000), also über eine RPC.
--
-- `start_price_cents` bleibt bei 100. Das ist kein Kunstgriff: Wandert der
-- Artikel später doch in eine Show, startet er bei 1 € — genau das Ritual, das
-- die Analyse als „die zentrale Erfindung" bezeichnet. Deshalb muss der
-- Festpreis darüber liegen, was die bestehende Spalten-Prüfung ohnehin verlangt.
CREATE OR REPLACE FUNCTION public.create_standing_listing(
  p_title       text,
  p_price_cents integer,
  p_image_url   text DEFAULT NULL,
  p_women_only  boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_price_cents IS NULL OR p_price_cents <= 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;
  -- Nur geprüfte Frauen dürfen ein Angebot als Frauen-Only kennzeichnen —
  -- sonst wäre die Grenze über ein Häkchen im Client umgehbar.
  IF p_women_only AND NOT public.is_women_only_verified() THEN
    RAISE EXCEPTION 'not_women_only_verified' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.live_auctions (
    session_id, seller_id, title, image_url,
    start_price_cents, buy_now_cents, status, women_only
  ) VALUES (
    NULL, v_uid, btrim(p_title), NULLIF(btrim(coalesce(p_image_url, '')), ''),
    100, p_price_cents, 'listed', coalesce(p_women_only, false)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_standing_listing(text, integer, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_standing_listing(text, integer, text, boolean)
  TO authenticated;

-- ─── 7. Zurückziehen ────────────────────────────────────────────────────────
-- Kein DELETE: Ein verkaufter Artikel muss als Beleg stehen bleiben, und
-- `cancelled` ist ohnehin der Zustand, den die Regal-Prüfung erlaubt.
CREATE OR REPLACE FUNCTION public.cancel_standing_listing(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_auctions
     SET status = 'cancelled'
   WHERE id = p_id
     AND seller_id = v_uid
     AND session_id IS NULL
     AND status = 'listed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.cancel_standing_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_standing_listing(uuid) TO authenticated;

-- ─── 8. Kaufen — derselbe Weg wie der Sofortkauf in der Show ─────────────────
-- Wortgleich zu `20260813150000` bis auf EINE Zeile: `listed` ist jetzt ein
-- gültiger Ausgangszustand. Der ganze Rumpf steht hier, weil CREATE OR REPLACE
-- ihn ersetzt — wer nur den Kopf schreibt, verliert den Rest. Vorher geprüft,
-- dass es keine neuere Fassung gibt als die vom 13.08.
CREATE OR REPLACE FUNCTION public.buy_now_live_auction(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a       public.live_auctions;
  v_uid   uuid := auth.uid();
  v_cart  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.buy_now_cents IS NULL THEN
    RAISE EXCEPTION 'no_buy_now' USING ERRCODE = '22023';
  END IF;
  -- ↓ die einzige inhaltliche Änderung: Dauerangebote sind kaufbar
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

-- ─── Was diese Migration bewusst NICHT tut ───────────────────────────────────
-- • **Kein Verschieben zwischen den Regalen.** Whatnots „Reserve for Live"
--   verschiebt einen Artikel in eine Show. Das wäre ein UPDATE auf `session_id`
--   und braucht eigene Prüfungen (läuft die Show? gehört sie mir?). Später.
-- • **Keine Änderung an der Zuschlag-Benachrichtigung.** Wer ein Dauerangebot
--   kauft, bekommt „🎉 Zuschlag — du hast gewonnen!". Für einen Festpreis-Kauf
--   ist das schief, gilt aber schon heute für den Sofortkauf in der Show. Ein
--   eigener Text gehört in dieselbe Änderung wie der Sofortkauf-Text, nicht
--   hierher.
