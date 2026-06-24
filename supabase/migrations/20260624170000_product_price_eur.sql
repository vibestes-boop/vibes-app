-- 20260624170000_product_price_eur.sql
-- Echtes EUR-Preisfeld für Produkte (products.price_eur).
--
-- Hintergrund: Vorbestell-/Cash-Produkte (sale_mode <> 'coins') haben keinen
-- sinnvollen Coin-Preis — bisher stand der Euro-Betrag nur im Beschreibungstext
-- und die Karte zeigte „Preis siehe Beschreibung". Mit dieser Spalte trägt der
-- Verkäufer den Preis strukturiert ein → Karte/Detail zeigen sauber „12 €".
--
-- Zukunftssicher: dasselbe Feld trägt Phase 1 (Stripe / sale_mode='cash') ohne
-- Schema-Umbau. Nullable — der normale Coin-Shop (sale_mode='coins') ignoriert
-- es komplett (UI rendert price_eur nur für preorder/cash).
--
-- numeric(10,2): legibel im SQL-Editor (12.00 / 7.90), kommt via PostgREST/RPC
-- als JS-number zurück (konsistent mit der bestehenden avg_rating-Spalte).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Spalte + CHECK (Preis > 0, wenn gesetzt)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_eur numeric(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_price_eur_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_price_eur_check
      CHECK (price_eur IS NULL OR price_eur > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.products.price_eur IS
  'Echter Euro-Preis (numeric, optional). Relevant für sale_mode <> coins (preorder/cash). Coin-Produkte ignorieren es. UI zeigt es statt "Preis siehe Beschreibung".';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) get_shop_products + get_saved_products um price_eur erweitern.
--    Return-Type ändert sich → DROP + CREATE (wie 20260624160000).
--    Die Mobile-App liest Liste UND Detail über get_shop_products, braucht das
--    Feld also im Rückgabe-Set (Web nutzt direkte Selects → bekommt es über die
--    Spaltenliste).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_shop_products(UUID, TEXT, INTEGER, INTEGER);
CREATE FUNCTION public.get_shop_products(
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
  price_eur         NUMERIC,
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
  sale_mode         TEXT
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
    p.price_eur,
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
    COALESCE(p.review_count, 0)  AS review_count,
    COALESCE(p.sale_mode, 'coins') AS sale_mode
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

DROP FUNCTION IF EXISTS public.get_saved_products(INTEGER, INTEGER);
CREATE FUNCTION public.get_saved_products(
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
  price_eur         NUMERIC,
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
  saved_at          TIMESTAMPTZ,
  sale_mode         TEXT
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
    p.price_eur,
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
    COALESCE(p.review_count, 0)  AS review_count,
    sp.created_at          AS saved_at,
    COALESCE(p.sale_mode, 'coins') AS sale_mode
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
