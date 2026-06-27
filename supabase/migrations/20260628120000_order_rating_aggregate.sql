-- 20260628120000_order_rating_aggregate.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Aggregierte Order-Bewertung pro User (für Reputation auf Profil/Produkt).
-- order_reviews ist per RLS nur für die Order-Parteien lesbar — die Reputation
-- soll aber ÖFFENTLICH sichtbar sein. Daher SECURITY-DEFINER-RPC, die NUR
-- Durchschnitt + Anzahl liefert (keine Einzel-Bewertungen).
--
--   seller_* = Bewertungen, die der User ALS VERKÄUFER bekam (Käufer → Verkäufer)
--   buyer_*  = Bewertungen, die der User ALS KÄUFER bekam   (Verkäufer → Käufer)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_order_rating(p_user_id uuid)
RETURNS TABLE (
  seller_avg   numeric,
  seller_count bigint,
  buyer_avg    numeric,
  buyer_count  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    round(avg(rating) FILTER (WHERE reviewer_role = 'buyer'), 2),
    count(*)          FILTER (WHERE reviewer_role = 'buyer'),
    round(avg(rating) FILTER (WHERE reviewer_role = 'seller'), 2),
    count(*)          FILTER (WHERE reviewer_role = 'seller')
  FROM public.order_reviews
  WHERE reviewee_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_order_rating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_rating(uuid) TO authenticated, anon;
