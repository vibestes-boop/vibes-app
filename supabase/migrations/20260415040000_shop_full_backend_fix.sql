-- ============================================================
-- 20260415_shop_full_backend_fix.sql
-- Fix: DROP bestehende Funktionen vor Neuerstellung
-- ============================================================

-- ─── 1. image_urls Spalte ─────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

-- ─── 2. get_shop_products: erst droppen, dann neu erstellen ───────────────────

DROP FUNCTION IF EXISTS public.get_shop_products(uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_shop_products(uuid, text, int, int);

CREATE OR REPLACE FUNCTION public.get_shop_products(
  p_seller_id  UUID    DEFAULT NULL,
  p_category   TEXT    DEFAULT NULL,
  p_limit      INT     DEFAULT 50,
  p_offset     INT     DEFAULT 0
)
RETURNS TABLE (
  id              UUID,
  seller_id       UUID,
  seller_username TEXT,
  seller_avatar   TEXT,
  seller_verified BOOLEAN,
  title           TEXT,
  description     TEXT,
  category        TEXT,
  price_coins     INT,
  cover_url       TEXT,
  image_urls      text[],
  file_url        TEXT,
  stock           INT,
  sold_count      INT,
  is_active       BOOLEAN,
  women_only      BOOLEAN,
  created_at      TIMESTAMPTZ
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
    p.cover_url,
    p.image_urls,
    p.file_url,
    p.stock,
    p.sold_count,
    p.is_active,
    p.women_only,
    p.created_at
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

-- ─── 3. get_saved_products: erst droppen ─────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_saved_products(integer, integer);
DROP FUNCTION IF EXISTS public.get_saved_products(int, int);

-- ─── 4. saved_products Tabelle ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saved_products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_products_user    ON public.saved_products(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_products_product ON public.saved_products(product_id);

ALTER TABLE public.saved_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_select_own" ON public.saved_products;
DROP POLICY IF EXISTS "saved_insert_own" ON public.saved_products;
DROP POLICY IF EXISTS "saved_delete_own" ON public.saved_products;

CREATE POLICY "saved_select_own" ON public.saved_products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "saved_insert_own" ON public.saved_products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_delete_own" ON public.saved_products
  FOR DELETE USING (auth.uid() = user_id);

-- ─── 5. RPCs ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_save_product(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists  BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.saved_products
    WHERE user_id = v_user_id AND product_id = p_product_id
  ) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.saved_products
    WHERE user_id = v_user_id AND product_id = p_product_id;
    RETURN jsonb_build_object('saved', false);
  ELSE
    INSERT INTO public.saved_products (user_id, product_id)
    VALUES (v_user_id, p_product_id)
    ON CONFLICT (user_id, product_id) DO NOTHING;
    RETURN jsonb_build_object('saved', true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_save_product TO authenticated;

CREATE OR REPLACE FUNCTION public.get_saved_products(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id              UUID,
  seller_id       UUID,
  seller_username TEXT,
  seller_avatar   TEXT,
  seller_verified BOOLEAN,
  title           TEXT,
  description     TEXT,
  category        TEXT,
  price_coins     INT,
  cover_url       TEXT,
  image_urls      text[],
  file_url        TEXT,
  stock           INT,
  sold_count      INT,
  is_active       BOOLEAN,
  women_only      BOOLEAN,
  created_at      TIMESTAMPTZ,
  saved_at        TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id, p.seller_id,
    pr.username AS seller_username,
    pr.avatar_url AS seller_avatar,
    pr.is_verified AS seller_verified,
    p.title, p.description, p.category, p.price_coins,
    p.cover_url, p.image_urls, p.file_url,
    p.stock, p.sold_count, p.is_active, p.women_only,
    p.created_at,
    sp.created_at AS saved_at
  FROM public.saved_products sp
  JOIN public.products  p  ON p.id  = sp.product_id
  JOIN public.profiles  pr ON pr.id = p.seller_id
  WHERE sp.user_id = auth.uid() AND p.is_active = true
  ORDER BY sp.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_saved_products TO authenticated;

CREATE OR REPLACE FUNCTION public.is_product_saved(p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.saved_products
    WHERE user_id = auth.uid() AND product_id = p_product_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_product_saved TO authenticated;

-- ─── 6. create_report (product-fähig) ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_report(
  p_target_type TEXT,
  p_target_id   UUID,
  p_reason      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF p_target_type NOT IN ('post', 'profile', 'comment', 'live', 'product') THEN
    RETURN jsonb_build_object('error', 'invalid_target_type');
  END IF;
  INSERT INTO public.content_reports (reporter_id, target_type, target_id, reason)
  VALUES (auth.uid(), p_target_type, p_target_id, p_reason)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_report TO authenticated;
