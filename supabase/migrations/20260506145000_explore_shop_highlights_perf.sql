-- Explore shop strip + profile highlights performance helpers.

CREATE INDEX IF NOT EXISTS idx_story_highlights_user_created_id
  ON public.story_highlights (user_id, created_at ASC, id ASC);

CREATE OR REPLACE FUNCTION public.get_public_shop_preview_products(
  result_limit integer DEFAULT 6
)
RETURNS TABLE (
  id uuid,
  title text,
  price_coins integer,
  sale_price_coins integer,
  cover_url text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.title,
    p.price_coins,
    p.sale_price_coins,
    p.cover_url
  FROM public.products p
  WHERE p.is_active = true
    AND p.women_only = false
  ORDER BY COALESCE(p.sold_count, 0) DESC, p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 6), 24));
$$;

GRANT EXECUTE ON FUNCTION public.get_public_shop_preview_products(integer) TO anon, authenticated;
