-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Mini-Shop Schema
-- Datum: 2026-04-14
-- Stufe 1: products, orders, buy_product RPC, get_shop_products RPC
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Products ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  price_coins    INTEGER NOT NULL CHECK (price_coins > 0),
  category       TEXT NOT NULL
                 CHECK (category IN ('digital', 'physical', 'service')),
  cover_url      TEXT,
  file_url       TEXT,               -- Digitale Produkte: Supabase Storage URL
  is_active      BOOLEAN NOT NULL DEFAULT true,
  stock          INTEGER NOT NULL DEFAULT -1,  -- -1 = unbegrenzt
  women_only     BOOLEAN NOT NULL DEFAULT false,
  sold_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance-Indizes
CREATE INDEX IF NOT EXISTS idx_products_seller_id   ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_active       ON public.products(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category     ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_women_only   ON public.products(women_only) WHERE women_only = true;

-- Auto-Update updated_at
CREATE OR REPLACE FUNCTION public.set_products_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_products_updated_at();

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Jeder kann aktive, nicht-WOZ Produkte sehen
CREATE POLICY "products_select_public" ON public.products
  FOR SELECT USING (
    is_active = true AND women_only = false
  );

-- WOZ-Produkte nur für verifizierte Frauen
CREATE POLICY "products_select_woz" ON public.products
  FOR SELECT USING (
    is_active = true AND women_only = true
    AND public.is_women_only_verified()
  );

-- Creator sieht ALLE eigenen Produkte (auch inaktive)
CREATE POLICY "products_select_own" ON public.products
  FOR SELECT USING (seller_id = auth.uid());

-- Creator erstellt eigene Produkte
CREATE POLICY "products_insert" ON public.products
  FOR INSERT WITH CHECK (seller_id = auth.uid());

-- Creator bearbeitet eigene Produkte
CREATE POLICY "products_update" ON public.products
  FOR UPDATE USING (seller_id = auth.uid());

-- Creator löscht eigene Produkte
CREATE POLICY "products_delete" ON public.products
  FOR DELETE USING (seller_id = auth.uid());

-- ── 2. Orders ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE SET NULL,
  quantity       INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_coins    INTEGER NOT NULL CHECK (total_coins > 0),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  delivery_notes TEXT,          -- Physische Produkte: Lieferadresse/Info
  download_url   TEXT,          -- Digitale Produkte: signed URL (wird nach Kauf gesetzt)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id    ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id   ON public.orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_product_id  ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON public.orders(status);

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_buyer"   ON public.orders FOR SELECT USING (buyer_id  = auth.uid());
CREATE POLICY "orders_select_seller"  ON public.orders FOR SELECT USING (seller_id = auth.uid());
CREATE POLICY "orders_insert"         ON public.orders FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "orders_update_seller"  ON public.orders FOR UPDATE USING (seller_id = auth.uid());

-- ── 3. RPC: buy_product (atomic) ──────────────────────────────────────────────

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
BEGIN
  -- Produkt laden + für Update sperren (verhindert Race-Condition bei begrenztem Stock)
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

  -- ── Atomare Transaktion ───────────────────────────────────────────────────

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

  -- Stock aktualisieren (bei limitiertem Stock)
  UPDATE public.products
     SET sold_count = sold_count + p_quantity,
         stock      = CASE WHEN stock >= 0 THEN stock - p_quantity ELSE stock END
   WHERE id = p_product_id;

  -- Notification an Creator: neue Bestellung
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

-- ── 4. RPC: get_shop_products (paginiert + Filter) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.get_shop_products(
  p_seller_id  UUID     DEFAULT NULL,   -- NULL = alle Seller
  p_category   TEXT     DEFAULT NULL,   -- NULL = alle Kategorien
  p_limit      INTEGER  DEFAULT 20,
  p_offset     INTEGER  DEFAULT 0
)
RETURNS TABLE (
  id           UUID,
  seller_id    UUID,
  title        TEXT,
  description  TEXT,
  price_coins  INTEGER,
  category     TEXT,
  cover_url    TEXT,
  is_active    BOOLEAN,
  stock        INTEGER,
  women_only   BOOLEAN,
  sold_count   INTEGER,
  created_at   TIMESTAMPTZ,
  seller_username  TEXT,
  seller_avatar    TEXT,
  seller_verified  BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.seller_id,
    p.title,
    p.description,
    p.price_coins,
    p.category,
    p.cover_url,
    p.is_active,
    p.stock,
    p.women_only,
    p.sold_count,
    p.created_at,
    pr.username     AS seller_username,
    pr.avatar_url   AS seller_avatar,
    pr.is_verified  AS seller_verified
  FROM public.products p
  JOIN public.profiles pr ON pr.id = p.seller_id
  WHERE
    p.is_active = true
    AND (p_seller_id IS NULL OR p.seller_id = p_seller_id)
    AND (p_category  IS NULL OR p.category  = p_category)
    AND (
      p.women_only = false
      OR public.is_women_only_verified()
    )
  ORDER BY p.sold_count DESC, p.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_products(UUID, TEXT, INTEGER, INTEGER)
  TO authenticated, anon;

-- ── 5. Supabase Realtime für orders aktivieren ─────────────────────────────────

ALTER TABLE public.orders   REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- orders zum Realtime-Publication hinzufügen
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ── 6. Fertig ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ Shop-Schema deployed: products, orders, buy_product RPC, get_shop_products RPC';
END $$;
