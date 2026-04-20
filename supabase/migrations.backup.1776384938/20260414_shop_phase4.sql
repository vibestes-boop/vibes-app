-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Shop Phase 4
-- Datum: 2026-04-14
-- 1. Notification-Typ 'new_order' für Seller
-- 2. generate_download_url RPC — Signed URL für digitale Produkte
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Notification-Typ validieren ────────────────────────────────────
-- Die notifications.type-Check-Constraint muss 'new_order' erlauben
-- Wir prüfen erst ob der Typ schon erlaubt ist

-- ── 1. notifications.type — new_order sicher hinzufügen ──────────────
-- Wir prüfen ob 'new_order' bereits erlaubt ist.
-- Falls nicht: Constraint droppen und mit ALLEN existierenden Typen neu anlegen.

DO $$
DECLARE
  v_has_new_order BOOLEAN;
BEGIN
  -- Prüfen ob new_order bereits in der Constraint ist
  SELECT pg_get_constraintdef(c.oid) LIKE '%new_order%'
    INTO v_has_new_order
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'notifications'
    AND c.contype = 'c'
    AND c.conname = 'notifications_type_check'
  LIMIT 1;

  IF v_has_new_order IS NULL OR NOT v_has_new_order THEN
    -- Alte Constraint entfernen
    ALTER TABLE public.notifications
      DROP CONSTRAINT IF EXISTS notifications_type_check;

    -- Neue Constraint mit ALLEN Typen (inkl. new_order)
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'like',
        'comment',
        'follow',
        'follow_request',
        'follow_request_accepted',
        'mention',
        'dm',
        'live',
        'live_invite',
        'gift',
        'new_order',
        'story_reaction',
        'comment_like',
        'repost',
        'guild'
      ));
    RAISE NOTICE '✅ notifications_type_check aktualisiert: new_order hinzugefügt';
  ELSE
    RAISE NOTICE 'ℹ️ new_order war bereits erlaubt — keine Änderung';
  END IF;
END $$;


-- ── 2. buy_product: Notification-Typ auf 'new_order' umstellen ────────
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
  v_cost           INTEGER;
  v_buyer_coins    INTEGER;
  v_diamond_credit INTEGER;
  v_order_id       UUID;
  v_buyer_username TEXT;
BEGIN
  -- Produkt laden + für Update sperren
  SELECT * INTO v_product FROM public.products
  WHERE id = p_product_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'product_not_found');
  END IF;

  IF v_product.seller_id = v_buyer_id THEN
    RETURN jsonb_build_object('error', 'cannot_buy_own');
  END IF;

  -- Stock-Prüfung
  IF v_product.stock >= 0 AND v_product.stock < p_quantity THEN
    RETURN jsonb_build_object('error', 'out_of_stock');
  END IF;

  -- Coin-Balance prüfen
  v_cost := v_product.price_coins * p_quantity;

  SELECT coins INTO v_buyer_coins
    FROM public.coins_wallets
   WHERE user_id = v_buyer_id;

  IF v_buyer_coins IS NULL THEN
    RETURN jsonb_build_object('error', 'no_wallet');
  END IF;

  IF v_buyer_coins < v_cost THEN
    RETURN jsonb_build_object('error', 'insufficient_coins');
  END IF;

  -- Buyer-Username für Notification
  SELECT username INTO v_buyer_username
    FROM public.profiles WHERE id = v_buyer_id;

  -- ── Atomare Transaktion ───────────────────────────────────────────────

  -- Coins des Käufers abziehen
  UPDATE public.coins_wallets
     SET coins = coins - v_cost
   WHERE user_id = v_buyer_id;

  -- Creator: 70% als Diamonds gutschreiben
  v_diamond_credit := GREATEST(1, ROUND(v_cost * 0.70));
  INSERT INTO public.coins_wallets (user_id, coins, diamonds)
       VALUES (v_product.seller_id, 0, v_diamond_credit)
  ON CONFLICT (user_id)
  DO UPDATE SET diamonds = coins_wallets.diamonds + v_diamond_credit;

  -- Bestellung anlegen
  INSERT INTO public.orders
    (buyer_id, seller_id, product_id, quantity, total_coins, status)
  VALUES
    (v_buyer_id, v_product.seller_id, p_product_id, p_quantity, v_cost, 'pending')
  RETURNING id INTO v_order_id;

  -- Stock aktualisieren
  UPDATE public.products
     SET sold_count = sold_count + p_quantity,
         stock      = CASE WHEN stock >= 0 THEN stock - p_quantity ELSE stock END
   WHERE id = p_product_id;

  -- ── Notification an Seller: 'new_order' (löst Push-Trigger aus) ──────
  BEGIN
    INSERT INTO public.notifications
      (recipient_id, sender_id, type, post_id, comment_text)
    VALUES
      (v_product.seller_id, v_buyer_id, 'new_order', NULL,
       format('%s × „%s" — %s Coins', p_quantity, v_product.title, v_cost));
  EXCEPTION WHEN check_violation THEN
    -- Fallback falls Constraint 'new_order' noch nicht kennt
    INSERT INTO public.notifications
      (recipient_id, sender_id, type, comment_text)
    VALUES
      (v_product.seller_id, v_buyer_id, 'gift',
       format('Neue Bestellung: %s × %s (%s Coins)', p_quantity, v_product.title, v_cost));
  END;

  RETURN jsonb_build_object(
    'success',     true,
    'order_id',    v_order_id,
    'new_balance', v_buyer_coins - v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_product(UUID, INTEGER) TO authenticated;

-- ── 3. generate_download_url — Signed URL für digitale Produkte ───────
-- Gibt eine zeitlich begrenzte Download-URL zurück (nach verifiziertem Kauf).
-- URL ist 1 Stunde gültig. Setzt voraus: Supabase Storage Bucket 'digital-products'

CREATE OR REPLACE FUNCTION public.generate_download_url(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_order      public.orders%ROWTYPE;
  v_product    public.products%ROWTYPE;
  v_file_path  TEXT;
BEGIN
  -- Bestellung laden + Zugriffsprüfung (nur Käufer oder Seller)
  SELECT * INTO v_order
    FROM public.orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'order_not_found');
  END IF;

  IF v_order.buyer_id != v_caller_id AND v_order.seller_id != v_caller_id THEN
    RETURN jsonb_build_object('error', 'access_denied');
  END IF;

  IF v_order.status = 'cancelled' OR v_order.status = 'refunded' THEN
    RETURN jsonb_build_object('error', 'order_cancelled');
  END IF;

  -- Produkt laden
  SELECT * INTO v_product FROM public.products WHERE id = v_order.product_id;

  IF v_product.category != 'digital' THEN
    RETURN jsonb_build_object('error', 'not_digital_product');
  END IF;

  IF v_product.file_url IS NULL THEN
    RETURN jsonb_build_object('error', 'no_file_attached');
  END IF;

  -- file_url auf Supabase Storage Pfad parsen
  -- Erwartet Format: https://<project>.supabase.co/storage/v1/object/public/digital-products/<path>
  v_file_path := regexp_replace(
    v_product.file_url,
    '^.*/digital-products/',
    ''
  );

  -- Download-URL in orders.download_url speichern (optional, für Audit)
  -- Die eigentliche Signed URL wird vom Client via supabase.storage.createSignedUrl erzeugt
  -- Diese RPC gibt den storage path zurück → Client erzeugt signed URL
  RETURN jsonb_build_object(
    'success',    true,
    'order_id',   p_order_id,
    'file_path',  v_file_path,
    'bucket',     'digital-products',
    'expires_in', 3600  -- 1 Stunde
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_download_url(UUID) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Shop Phase 4: new_order Notification + generate_download_url RPC deployed';
END $$;
