-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Shop Richer Cards (v1.26.3)
-- Datum: 2026-04-19
--
-- Neue Produkt-Felder für bessere Shop-Card-UX:
--   • sale_price_coins  → Angebotspreis (aktueller Preis wenn gesetzt;
--                         price_coins bleibt "Originalpreis" für durchgestrichene
--                         Anzeige). CHECK: muss < price_coins sein.
--   • free_shipping     → „Gratis Versand"-Label für physische Produkte.
--   • location          → Produkt-Standort als Freitext (z.B. „Berlin, DE").
--
-- get_shop_products + get_saved_products RPCs werden erweitert, damit die neuen
-- Felder im Hook ankommen. Bestehende Calls bleiben kompatibel (alle Felder
-- nullable / default-belegt).
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Neue Spalten ──────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_price_coins INTEGER NULL,
  ADD COLUMN IF NOT EXISTS free_shipping    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location         TEXT NULL;

-- CHECK: Angebotspreis darf nicht ≥ regulärer Preis sein.
-- Separat als benannter Constraint damit idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_sale_lower_than_price'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sale_lower_than_price
      CHECK (sale_price_coins IS NULL
             OR (sale_price_coins > 0 AND sale_price_coins < price_coins));
  END IF;
END $$;

-- Partial-Index: Scans für „nur Angebote"-Filter (künftig) werden günstig.
CREATE INDEX IF NOT EXISTS idx_products_sale_price
  ON public.products(sale_price_coins)
  WHERE sale_price_coins IS NOT NULL;

-- ─── 2. get_shop_products RPC erweitern ───────────────────────────────────────
-- Return-Type Änderung erfordert DROP + CREATE (Postgres 42P13).

DROP FUNCTION IF EXISTS public.get_shop_products(UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_shop_products(
  p_seller_id UUID    DEFAULT NULL,
  p_category  TEXT    DEFAULT NULL,
  p_limit     INTEGER DEFAULT 40,
  p_offset    INTEGER DEFAULT 0
) RETURNS TABLE (
  id                UUID,
  seller_id         UUID,
  seller_username   TEXT,
  seller_avatar     TEXT,
  seller_verified   BOOLEAN,
  title             TEXT,
  description       TEXT,
  category          TEXT,
  price_coins       INTEGER,
  sale_price_coins  INTEGER,
  cover_url         TEXT,
  image_urls        TEXT[],
  file_url          TEXT,
  stock             INTEGER,
  sold_count        INTEGER,
  is_active         BOOLEAN,
  women_only        BOOLEAN,
  free_shipping     BOOLEAN,
  location          TEXT,
  created_at        TIMESTAMPTZ,
  avg_rating        NUMERIC,
  review_count      INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.seller_id,
    pr.username            AS seller_username,
    pr.avatar_url          AS seller_avatar,
    pr.is_verified         AS seller_verified,
    p.title,
    p.description,
    p.category,
    p.price_coins,
    p.sale_price_coins,
    p.cover_url,
    p.image_urls,
    p.file_url,
    p.stock,
    p.sold_count,
    p.is_active,
    p.women_only,
    p.free_shipping,
    p.location,
    p.created_at,
    p.avg_rating,
    COALESCE(p.review_count, 0) AS review_count
  FROM public.products p
  JOIN public.profiles pr ON pr.id = p.seller_id
  WHERE p.is_active = true
    AND (p_seller_id IS NULL OR p.seller_id = p_seller_id)
    AND (p_category  IS NULL OR p.category  = p_category)
    AND (
      p.women_only = false
      OR (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND gender = 'female'
      ))
    )
  ORDER BY p.sold_count DESC, p.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_products TO authenticated, anon;

-- ─── 3. get_saved_products RPC erweitern ──────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_saved_products(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_saved_products(
  p_limit  INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id                UUID,
  seller_id         UUID,
  seller_username   TEXT,
  seller_avatar     TEXT,
  seller_verified   BOOLEAN,
  title             TEXT,
  description       TEXT,
  category          TEXT,
  price_coins       INTEGER,
  sale_price_coins  INTEGER,
  cover_url         TEXT,
  image_urls        TEXT[],
  file_url          TEXT,
  stock             INTEGER,
  sold_count        INTEGER,
  is_active         BOOLEAN,
  women_only        BOOLEAN,
  free_shipping     BOOLEAN,
  location          TEXT,
  created_at        TIMESTAMPTZ,
  avg_rating        NUMERIC,
  review_count      INTEGER,
  saved_at          TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.seller_id,
    pr.username            AS seller_username,
    pr.avatar_url          AS seller_avatar,
    pr.is_verified         AS seller_verified,
    p.title,
    p.description,
    p.category,
    p.price_coins,
    p.sale_price_coins,
    p.cover_url,
    p.image_urls,
    p.file_url,
    p.stock,
    p.sold_count,
    p.is_active,
    p.women_only,
    p.free_shipping,
    p.location,
    p.created_at,
    p.avg_rating,
    COALESCE(p.review_count, 0) AS review_count,
    sp.created_at          AS saved_at
  FROM public.saved_products sp
  JOIN public.products  p  ON p.id  = sp.product_id
  JOIN public.profiles  pr ON pr.id = p.seller_id
  WHERE sp.user_id = auth.uid()
    AND p.is_active = true
  ORDER BY sp.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_saved_products TO authenticated;

-- ─── 4. buy_product: Angebotspreis respektieren ───────────────────────────────
-- Wenn sale_price_coins gesetzt ist, wird dieser für die Coin-Abbuchung
-- verwendet (statt price_coins). Das ist der aktuell gültige Verkaufspreis.

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

  SELECT coins INTO v_buyer_coins
    FROM public.coins_wallets
   WHERE user_id = v_buyer_id;

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

GRANT EXECUTE ON FUNCTION public.buy_product(UUID, INTEGER) TO authenticated;

-- ─── 5. Fertig ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ v1.26.3 Shop Richer Cards deployed: sale_price_coins, free_shipping, location';
END $$;
