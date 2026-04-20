-- ─────────────────────────────────────────────────────────────────────────────
-- 20260414_admin_extras.sql — Fehlende Admin-RPCs (Patch)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. is_admin() ZUERST anlegen (wird von admin_get_seller_balances gebraucht)

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ── 2. admin_get_seller_balances ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_get_seller_balances()
RETURNS TABLE (
  seller_id       UUID,
  username        TEXT,
  diamond_balance BIGINT,
  total_earned    BIGINT,
  pending_orders  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                                                                      AS seller_id,
    p.username,
    COALESCE(w.diamonds, 0)                                                   AS diamond_balance,
    COALESCE(SUM(o.total_coins) FILTER (WHERE o.status = 'completed'), 0)    AS total_earned,
    COUNT(o.id)              FILTER (WHERE o.status = 'pending')              AS pending_orders
  FROM public.profiles p
  JOIN public.orders   o  ON o.seller_id = p.id
  LEFT JOIN public.coins_wallets w ON w.user_id = p.id
  WHERE public.is_admin()
  GROUP BY p.id, p.username, w.diamonds
  ORDER BY diamond_balance DESC;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_seller_balances()  TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Admin-Extras deployed: is_admin, admin_get_seller_balances';
END $$;
