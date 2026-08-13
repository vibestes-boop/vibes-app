-- ═══════════════════════════════════════════════════════════════════════════
-- Berkat — Kasse für den Sammelkorb
--
-- Der Sammelkorb füllt sich mit gewonnenen Artikeln, aber bezahlen konnte man
-- bisher nicht. Diese Migration hängt ihn an den Bezahlweg, den Serlo für
-- physische Ware schon hat: `product_orders` im Status 'payment_requested' →
-- Edge Function `create-checkout-session` → Stripe → `stripe-webhook`.
--
-- Bewusst KEIN zweiter Weg. Ein Sammelkorb wird zu genau EINER Bestellung —
-- das ist ja der Sinn: ein Paket, ein Versand, eine Zahlung.
--
-- Phase 1 heißt: Zaur ist Verkäufer UND Betreiber. Das Geld geht direkt auf
-- sein Stripe-Konto, ohne Connect. Sobald ein zweiter Verkäufer dazukommt,
-- greift die ganze Kette aus der Analyse — Connect, KYC, DAC7, LUCID, USt-ID.
-- Das ist bewusst noch nicht hier drin.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Bestellung kennt ihren Sammelkorb ───────────────────────────────────
ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS cart_id uuid REFERENCES public.auction_carts(id) ON DELETE SET NULL;

-- Ohne eigenen Titel steht auf der Stripe-Seite „Serlo Produkt", weil die
-- Edge Function den Namen sonst aus `products` zieht — und ein Auktionsartikel
-- hat dort keine Zeile.
ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS title text;

CREATE INDEX IF NOT EXISTS product_orders_cart
  ON public.product_orders (cart_id)
  WHERE cart_id IS NOT NULL;

-- ─── 2. Bezahlt → Sammelkorb schließen ──────────────────────────────────────
-- Der Stripe-Webhook gehört Serlo und weiß nichts von Sammelkörben. Statt ihn
-- anzufassen, hängt die Schließung an der Statusänderung der Bestellung —
-- damit gilt sie auch für Spätbestätigungen (SEPA) und manuelle Korrekturen.
CREATE OR REPLACE FUNCTION public.close_cart_on_order_paid()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid'
     AND OLD.status IS DISTINCT FROM 'paid'
     AND NEW.cart_id IS NOT NULL THEN
    UPDATE public.auction_carts
       SET status = 'checked_out'
     WHERE id = NEW.cart_id
       AND status = 'open';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_close_cart_on_order_paid ON public.product_orders;
CREATE TRIGGER trg_close_cart_on_order_paid
  AFTER UPDATE ON public.product_orders
  FOR EACH ROW EXECUTE FUNCTION public.close_cart_on_order_paid();

-- ─── 3. Sammelkorb zur Kasse tragen ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.checkout_auction_cart(p_cart_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c           public.auction_carts;
  v_uid       uuid := auth.uid();
  v_total     bigint;
  v_items     int;
  v_title     text;
  v_order_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.auction_carts WHERE id = p_cart_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cart_not_found' USING ERRCODE = '22023';
  END IF;
  IF c.buyer_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF c.status <> 'open' THEN
    RAISE EXCEPTION 'cart_closed' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(current_bid_cents), 0), COUNT(*)
    INTO v_total, v_items
    FROM public.live_auctions
   WHERE cart_id = p_cart_id AND status = 'sold';

  IF v_items = 0 OR v_total <= 0 THEN
    RAISE EXCEPTION 'cart_empty' USING ERRCODE = '22023';
  END IF;

  -- Idempotent: ein zweiter Tipp auf „Bezahlen" erzeugt keine zweite
  -- Bestellung, sondern führt zur selben. Die Edge Function nutzt die
  -- Bestell-ID auch als Idempotenz-Schlüssel bei Stripe.
  SELECT id INTO v_order_id
    FROM public.product_orders
   WHERE cart_id = p_cart_id AND status = 'payment_requested'
   LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  SELECT CASE
           WHEN v_items = 1 THEN MIN(title)
           ELSE format('%s Artikel aus der Live-Show', v_items)
         END
    INTO v_title
    FROM public.live_auctions
   WHERE cart_id = p_cart_id AND status = 'sold';

  INSERT INTO public.product_orders (
    buyer_id, seller_id, product_id, cart_id, title,
    quantity, unit_price_eur, amount_eur, currency, status, payment_requested_at
  ) VALUES (
    v_uid, c.seller_id, NULL, p_cart_id, v_title,
    1, (v_total::numeric / 100), (v_total::numeric / 100), 'eur',
    'payment_requested', now()
  )
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END $$;

REVOKE ALL ON FUNCTION public.checkout_auction_cart(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_auction_cart(uuid) TO authenticated;

COMMENT ON FUNCTION public.checkout_auction_cart(uuid) IS
  'Berkat: macht aus einem Sammelkorb genau eine Bestellung im Status payment_requested.';
