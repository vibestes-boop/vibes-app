-- 20260628150000_coin_economy_recalibration.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ NICHT AUSFÜHREN, bis die Coin-Ökonomie scharf geschaltet werden soll
--    (d.h. erst wenn echte User Gifts senden + auszahlen). Vorbereitet, dormant.
--    Aktuell 0 User → harmlos, aber bewusst gegated: Zaur führt sie aus, wenn so weit.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PROBLEM (dokumentiert): Ein gekaufter Coin kostet den User ~0,005–0,008 €,
-- wurde aber als ~0,85 Diamant gutgeschrieben (Gift) bzw. 0,70 (Shop) → bei
-- 0,02 €/Diamant zahlt die Plattform mehr aus, als sie eingenommen hat (Minus).
--
-- FIX (rein DB, KEIN Frontend/Web/OTA nötig): Diamant-Verdienen auf 12,5% senken.
--   Auszahlkurs bleibt unverändert bei 0,02 €/Diamant (50 Diamanten = 1 €,
--   Min-Auszahlung 2500 = 50 €) — d.h. Frontend (lib/payout.ts, Web-Payout) bleibt
--   wie es ist. Nur das EARNING ändert sich.
--
-- RECHNUNG: Auszahl-Wert je Coin = 0,125 (Diamant/Coin) × 0,02 € = 0,0025 €.
--   Coin-Kaufpreis 0,005 € (Bulk) … 0,00825 € (Entry) → Creator-Anteil 30–50%,
--   Plattform behält 50–70%. (Brutto, vor Apple/Stripe-Gebühren — netto enger.)
--
-- Betrifft:
--   1) gift_catalog.diamond_value  → 12,5% des coin_cost (Source-of-Truth für
--      send_gift-Gutschrift UND GiftPicker-Anzeige via useGiftCatalog).
--   2) buy_product()-RPC           → Verkäufer-Diamant-Credit 0.70 → 0.125.
--
-- BEIM AKTIVIEREN auch anpassen (rein kosmetisch, daher hier NICHT vorab live):
--   • app/shop/my-shop.tsx Verkäufer-Vorschau „≈ X € für dich":
--       ALT:  ((form.price_coins / 100) * 0.70).toFixed(2)
--       NEU:  (form.price_coins * 0.0025).toFixed(2)   // = 0.125 Diam × 0,02 €
--     → dann zusammen mit dieser Migration per OTA ausspielen, damit Anzeige
--       und tatsächliche Gutschrift übereinstimmen.
--   • Auszahlkurs (lib/payout.ts DIAMOND_RATE_EUR, Web-Payout RATE) + Min-
--     Auszahlung BLEIBEN bei 0,02 € / 2500 (=50 €). Bewusst NICHT ändern.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Gift-Diamantwert: 85% → 12,5% des Coin-Preises ────────────────────────
UPDATE public.gift_catalog
   SET diamond_value = GREATEST(1, ROUND(coin_cost * 0.125)::integer);

-- ── 2) buy_product: Verkäufer-Diamant-Credit 70% → 12,5% ─────────────────────
-- Verbatim-Kopie der aktuellen Funktion (20260619130000), nur die eine Credit-
-- Zeile geändert. Rest unverändert (Wallet-Lock, Stock, Order, Notif).
CREATE OR REPLACE FUNCTION public.buy_product(p_product_id uuid, p_quantity integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_buyer_id       UUID := auth.uid();
  v_product        public.products%ROWTYPE;
  v_unit_price     INTEGER;
  v_cost           INTEGER;
  v_buyer_coins    INTEGER;
  v_diamond_credit INTEGER;
  v_order_id       UUID;
  v_order_status   TEXT;
BEGIN
  SELECT * INTO v_product FROM public.products
  WHERE id = p_product_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'product_not_found');
  END IF;

  IF v_product.seller_id = v_buyer_id THEN
    RETURN jsonb_build_object('error', 'cannot_buy_own');
  END IF;

  IF v_product.stock >= 0 AND v_product.stock < p_quantity THEN
    RETURN jsonb_build_object('error', 'out_of_stock');
  END IF;

  v_unit_price := COALESCE(v_product.sale_price_coins, v_product.price_coins);
  v_cost       := v_unit_price * p_quantity;

  SELECT coins INTO v_buyer_coins
    FROM public.coins_wallets
   WHERE user_id = v_buyer_id
   FOR UPDATE;

  IF v_buyer_coins IS NULL THEN
    RETURN jsonb_build_object('error', 'no_wallet');
  END IF;

  IF v_buyer_coins < v_cost THEN
    RETURN jsonb_build_object('error', 'insufficient_coins');
  END IF;

  UPDATE public.coins_wallets
     SET coins = coins - v_cost
   WHERE user_id = v_buyer_id;

  -- Kalibriert: Verkäufer bekommt 12,5% des Coin-Preises als Diamanten (war 0.70).
  v_diamond_credit := GREATEST(1, ROUND(v_cost * 0.125));
  INSERT INTO public.coins_wallets (user_id, coins, diamonds)
       VALUES (v_product.seller_id, 0, v_diamond_credit)
  ON CONFLICT (user_id)
  DO UPDATE SET diamonds = coins_wallets.diamonds + v_diamond_credit;

  -- Digitale Produkte sofort 'completed' (Download), sonst 'pending'.
  v_order_status := CASE WHEN v_product.category = 'digital' THEN 'completed' ELSE 'pending' END;

  INSERT INTO public.orders
    (buyer_id, seller_id, product_id, quantity, total_coins, status)
  VALUES
    (v_buyer_id, v_product.seller_id, p_product_id, p_quantity, v_cost, v_order_status)
  RETURNING id INTO v_order_id;

  UPDATE public.products
     SET sold_count = sold_count + p_quantity,
         stock      = CASE WHEN stock >= 0 THEN stock - p_quantity ELSE stock END
   WHERE id = p_product_id;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, comment_text)
  VALUES
    (v_product.seller_id, v_buyer_id, 'new_order',
     format('%s× %s · %s Coins', p_quantity, v_product.title, v_cost));

  RETURN jsonb_build_object(
    'success',     true,
    'order_id',    v_order_id,
    'new_balance', v_buyer_coins - v_cost
  );
END;
$$;
