-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — get_shop_products RPC: avg_rating + review_count hinzufügen
-- Datum: 2026-04-15
--
-- Erweitert die RPC-Funktion um Bewertungsfelder aus product_reviews.
-- Nutzt die bereits denormalisierten avg_rating + review_count Spalten
-- (werden vom Trigger in 20260415_product_reviews.sql automatisch aktualisiert).
-- ══════════════════════════════════════════════════════════════════════════════
-- Return-Type Änderung erfordert DROP + CREATE (Postgres Error 42P13)
DROP FUNCTION IF EXISTS public.get_shop_products(UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_shop_products(
  p_seller_id UUID    DEFAULT NULL,
  p_category  TEXT    DEFAULT NULL,
  p_limit     INTEGER DEFAULT 40,
  p_offset    INTEGER DEFAULT 0
) RETURNS TABLE (
  id              UUID,
  seller_id       UUID,
  seller_username TEXT,
  seller_avatar   TEXT,
  seller_verified BOOLEAN,
  title           TEXT,
  description     TEXT,
  category        TEXT,
  price_coins     INTEGER,
  cover_url       TEXT,
  image_urls      TEXT[],
  file_url        TEXT,
  stock           INTEGER,
  sold_count      INTEGER,
  is_active       BOOLEAN,
  women_only      BOOLEAN,
  created_at      TIMESTAMPTZ,
  avg_rating      NUMERIC,
  review_count    INTEGER
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

DO $$ BEGIN
  RAISE NOTICE '✅ get_shop_products RPC: avg_rating + review_count hinzugefügt';
END $$;
