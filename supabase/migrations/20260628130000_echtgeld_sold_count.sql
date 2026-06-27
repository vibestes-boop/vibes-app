-- 20260628130000_echtgeld_sold_count.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Echtgeld-Verkäufe (product_orders) zählten NICHT in products.sold_count hoch
-- (nur der Coin-Kauf via buy_product tat das) → Parfüm-Verkäufe blieben überall
-- auf „0× verkauft" (Shop-Karten + Analytics). Fix: kleine RPC, die der Stripe-
-- Webhook beim Bezahlen aufruft.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bump_product_sold_count(p_product_id uuid, p_qty int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products
     SET sold_count = sold_count + GREATEST(COALESCE(p_qty, 1), 0)
   WHERE id = p_product_id;
$$;

-- Nur der Webhook (service_role) darf das zählen — niemand sonst.
REVOKE ALL ON FUNCTION public.bump_product_sold_count(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_product_sold_count(uuid, int) TO service_role;
