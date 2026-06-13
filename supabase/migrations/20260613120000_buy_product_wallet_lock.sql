-- ─────────────────────────────────────────────────────────────────────────────
-- buy_product: Row-Lock auf der Käufer-Wallet (FOR UPDATE)
--
-- Problem: buy_product sperrte bisher nur die Produkt-Zeile (FOR UPDATE), las
-- aber die Käufer-Wallet OHNE Lock. Unter Postgres' READ-COMMITTED-Default ist
-- damit ein TOCTOU-Race möglich, wenn ein Käufer zwei Käufe parallel auslöst
-- (Doppelklick / zwei Tabs / zwei Produkte gleichzeitig):
--
--   Beide lesen coins=100 → beide prüfen 100 < cost(80) = false → beide
--   UPDATE coins = coins - 80 → Endstand -60.
--
-- Geld ging zwar nie verloren (coins_wallets.coins hat CHECK (coins >= 0), die
-- zweite Transaktion wäre an der Constraint gescheitert), aber der Käufer bekam
-- dann einen rohen Postgres-Constraint-Fehler (23514) statt eines sauberen
-- 'insufficient_coins'. Dieser Fix sperrt die Wallet-Zeile beim Balance-Read —
-- exakt wie send_gift (20260413000000) und send_creator_tip (20260422000000)
-- es bereits korrekt machen.
--
-- Reine Funktions-Neudefinition via CREATE OR REPLACE; kompletter Body aus
-- 20260419200000_shop_richer_cards.sql übernommen, nur die eine FOR-UPDATE-
-- Zeile am Wallet-SELECT ergänzt. Keine Schema-Änderung.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.buy_product(
  p_product_id UUID,
  p_quantity   INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id       UUID := auth.uid();
  v_product        public.products%ROWTYPE;
  v_unit_price     INTEGER;
  v_cost           INTEGER;
  v_buyer_coins    INTEGER;
  v_diamond_credit INTEGER;
  v_order_id       UUID;
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

  -- v1.26.3: Angebotspreis hat Vorrang wenn gesetzt.
  v_unit_price := COALESCE(v_product.sale_price_coins, v_product.price_coins);
  v_cost       := v_unit_price * p_quantity;

  -- FOR UPDATE: sperrt die Käufer-Wallet bis zum Transaktions-Ende, damit
  -- parallele Käufe serialisiert werden (kein TOCTOU-Race, kein negativer
  -- Saldo via CHECK-Constraint-Fehler). Parität mit send_gift/send_creator_tip.
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

  v_diamond_credit := GREATEST(1, ROUND(v_cost * 0.70));
  INSERT INTO public.coins_wallets (user_id, coins, diamonds)
       VALUES (v_product.seller_id, 0, v_diamond_credit)
  ON CONFLICT (user_id)
  DO UPDATE SET diamonds = coins_wallets.diamonds + v_diamond_credit;

  INSERT INTO public.orders
    (buyer_id, seller_id, product_id, quantity, total_coins, status)
  VALUES
    (v_buyer_id, v_product.seller_id, p_product_id, p_quantity, v_cost, 'pending')
  RETURNING id INTO v_order_id;

  UPDATE public.products
     SET sold_count = sold_count + p_quantity,
         stock      = CASE WHEN stock >= 0 THEN stock - p_quantity ELSE stock END
   WHERE id = p_product_id;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, comment_text)
  VALUES
    (v_product.seller_id, v_buyer_id, 'gift',
     format('%s × %s gekauft (%s Coins)', p_quantity, v_product.title, v_cost));

  RETURN jsonb_build_object(
    'success',     true,
    'order_id',    v_order_id,
    'new_balance', v_buyer_coins - v_cost
  );
END;
$$;

-- Grants nach CREATE OR REPLACE neu setzen — Postgres behält sie nicht über
-- alle Versionen garantiert.
REVOKE ALL ON FUNCTION public.buy_product(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_product(UUID, INTEGER) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ buy_product: FOR UPDATE auf Käufer-Wallet ergänzt (Race-Fix)';
END $$;
