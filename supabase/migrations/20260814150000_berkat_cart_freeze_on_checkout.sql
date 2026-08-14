-- ═══════════════════════════════════════════════════════════════════════════
-- Berkat: der Sammelkorb friert ein, sobald er zur Kasse getragen wird
--
-- Gefunden bei der Sicherheitsdurchsicht am 14.08.2026.
--
-- `checkout_auction_cart` errechnete den Betrag aus den Zuschlägen im Korb und
-- schrieb ihn fest in die Bestellung — ließ den Korb danach aber auf `open`
-- stehen. `ensure_auction_cart` sucht genau nach `open` und hängte jeden
-- weiteren Zuschlag in denselben Korb. Die Idempotenz-Abfrage gab die alte
-- Bestellung zurück, ohne den Betrag neu zu rechnen.
--
-- Damit ließ sich Folgendes tun:
--   1. billigen Artikel für 1 € gewinnen
--   2. „Bezahlen" antippen — Bestellung über 1 €, Korb bleibt offen
--   3. NICHT zahlen, weiterbieten, Artikel für 500 € gewinnen (selber Korb)
--   4. die 1 € bei Stripe zahlen
--   5. Trigger schließt den Korb, alles gilt als bezahlt
-- Der Verkäufer bekommt 1 € und liefert 501 €. Und ohne jede Absicht passiert
-- dasselbe: antippen, abgelenkt werden, weiterbieten, dann zahlen.
--
-- Die Lösung ist ein eigener Zustand statt einer Neuberechnung. Neu zu rechnen
-- würde das Fenster nur verkleinern — zwischen dem Erzeugen der Stripe-Sitzung
-- und der Zahlung kämen weiterhin Artikel hinzu.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.auction_carts DROP CONSTRAINT IF EXISTS auction_carts_status_check;
ALTER TABLE public.auction_carts
  ADD CONSTRAINT auction_carts_status_check
  CHECK (status IN ('open', 'checkout_pending', 'checked_out', 'expired', 'cancelled'));

-- Der Teil-Index `auction_carts_one_open` greift weiterhin nur auf `open`.
-- Genau richtig: Ein Korb in der Kasse blockiert keinen neuen, sonst könnte
-- man nach dem Antippen von „Bezahlen" nichts mehr ersteigern.

-- ─── Kasse ──────────────────────────────────────────────────────────────────
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

  -- Idempotenz VOR der Zustandsprüfung. Ein Korb in der Kasse ist nicht mehr
  -- `open`; wer eine abgebrochene Zahlung nachholt, muss trotzdem wieder zu
  -- seiner Bestellung finden.
  SELECT id INTO v_order_id
    FROM public.product_orders
   WHERE cart_id = p_cart_id AND status = 'payment_requested'
   LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
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

  -- Ab hier nimmt dieser Korb nichts mehr auf. Was danach gewonnen wird,
  -- landet in einem frischen Korb und wird eine eigene Bestellung.
  UPDATE public.auction_carts
     SET status = 'checkout_pending'
   WHERE id = p_cart_id;

  RETURN v_order_id;
END $$;

REVOKE ALL ON FUNCTION public.checkout_auction_cart(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_auction_cart(uuid) TO authenticated;

COMMENT ON FUNCTION public.checkout_auction_cart(uuid) IS
  'Berkat: macht aus einem Sammelkorb genau eine Bestellung und friert ihn dabei ein. Idempotent.';

-- ─── Bezahlt → Korb endgültig zu ────────────────────────────────────────────
-- Muss jetzt auch `checkout_pending` schließen, sonst bliebe ein bezahlter
-- Korb in der Kasse hängen.
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
       AND status IN ('open', 'checkout_pending');
  END IF;
  RETURN NEW;
END $$;

-- ─── Bestand aufräumen ──────────────────────────────────────────────────────
-- Körbe, die schon eine offene Bestellung haben, aber noch auf `open` stehen:
-- genau der verwundbare Zustand. Bestehende Zuschläge bleiben unberührt, der
-- Korb nimmt ab jetzt nur nichts Neues mehr auf.
UPDATE public.auction_carts c
   SET status = 'checkout_pending'
 WHERE c.status = 'open'
   AND EXISTS (
     SELECT 1 FROM public.product_orders o
      WHERE o.cart_id = c.id AND o.status = 'payment_requested'
   );
