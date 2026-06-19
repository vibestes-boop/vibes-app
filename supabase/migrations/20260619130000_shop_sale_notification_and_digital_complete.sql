-- ════════════════════════════════════════════════════════════════════════════
-- Shop-Fixes: (3) digitale Orders sofort 'completed' + (4) Verkaufs-Notification
--
-- Befund:
--   • buy_product setzte Orders IMMER auf 'pending' → bei digitalen Produkten
--     erschien NIE der Download-Button (der `canDownload` braucht 'completed').
--   • buy_product schickte die Verkäufer-Notification mit type='gift' → die UI
--     rendert "hat dir ein Geschenk geschickt". Der korrekte Typ 'new_order'
--     (beide Renderer kennen ihn bereits: "hat bestellt: …" 🛍) war aber durch
--     die CHECK-Constraint NICHT erlaubt → Fallback auf 'gift'.
--
-- Fix: Constraint um 'new_order' erweitern, buy_product auf digital→'completed'
-- + Notification-Type 'new_order' umstellen, bestehende digitale Pending-Orders
-- nachträglich auf 'completed' setzen.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Notification-Typ 'new_order' erlauben ────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'like','comment','follow','dm','live','live_invite','gift',
    'scheduled_live_reminder','new_order'
  ]));

-- ── 2. buy_product: Status nach Kategorie + korrekte Verkaufs-Notification ───
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

  v_diamond_credit := GREATEST(1, ROUND(v_cost * 0.70));
  INSERT INTO public.coins_wallets (user_id, coins, diamonds)
       VALUES (v_product.seller_id, 0, v_diamond_credit)
  ON CONFLICT (user_id)
  DO UPDATE SET diamonds = coins_wallets.diamonds + v_diamond_credit;

  -- FIX (3): Digitale Produkte werden sofort geliefert → Order direkt
  -- 'completed' (Download-Button erscheint). Physisch/Service bleiben 'pending'
  -- bis der Verkäufer erfüllt.
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

  -- FIX (4): korrekter Verkaufs-Typ 'new_order' (Renderer: "hat bestellt: …" 🛍)
  -- statt 'gift' ("hat dir ein Geschenk geschickt").
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

-- ── 3. Bestehende digitale Pending-Orders nachziehen ────────────────────────
UPDATE public.orders o
   SET status = 'completed'
  FROM public.products p
 WHERE o.product_id = p.id
   AND p.category   = 'digital'
   AND o.status     = 'pending';

DO $$
BEGIN
  RAISE NOTICE '✅ Shop: digital orders auto-complete + new_order notification deployed';
END $$;
