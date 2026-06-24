-- 20260624140000_perfume_preorder_phase0.sql
-- Phase 0 — Sammelbestellung / Vorbestellung (kein Geld), zunächst nur für Zaurs
-- Parfüms. Käufer drücken "Vormerken" (Interesse + Menge), KEINE Zahlung. Der
-- Verkäufer sammelt das Interesse, macht die Sammelbestellung, kassiert erst bei
-- Lieferung (manuell / später Phase-1-Stripe).
--
-- Zukunftssicher gebaut:
--   • products.sale_mode (Enum: coins|preorder|cash) trägt alle Phasen.
--     - coins   = bestehender Coin-Kauf (Default, alle bestehenden Produkte)
--     - preorder = diese Phase 0 (kein Geld, Interesse sammeln)
--     - cash     = Phase 1 (echtes Geld / Stripe) — Spalte schon da, Logik folgt
--   • Admin-Gate per Trigger → nur Admin (Zaur) darf sale_mode <> 'coins' setzen
--     ("nur meine Parfüms" ist DB-erzwungen, nicht nur UI).
--   • product_preorders mit Lifecycle-Status → Phase 1 schaltet paid/shipped
--     scharf, ohne Schema-Umbau.
--
-- Der normale Coin-Shop für alle anderen User bleibt unangetastet (Default coins).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) products.sale_mode
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_mode text NOT NULL DEFAULT 'coins';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_sale_mode_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sale_mode_check
      CHECK (sale_mode IN ('coins', 'preorder', 'cash'));
  END IF;
END $$;

COMMENT ON COLUMN public.products.sale_mode IS
  'Verkaufsart: coins (Standard, Coin-Kauf) | preorder (Sammelbestellung ohne Geld, Phase 0) | cash (echtes Geld/Stripe, Phase 1). Nur Admin darf <> coins setzen (Trigger).';

-- Index nur für die seltenen Nicht-Coin-Produkte (Vorbestell-/Cash-Listen).
CREATE INDEX IF NOT EXISTS idx_products_sale_mode
  ON public.products (sale_mode) WHERE sale_mode <> 'coins';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Admin-Gate: nur Admin (oder service_role) darf sale_mode <> 'coins' setzen.
--    Nicht-Admins werden still auf 'coins' herabgestuft (kein Fehler, keine UX-
--    Bruchkante — der Admin-Toggle erscheint im UI ohnehin nur für Admins).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_sale_mode_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sale_mode IS DISTINCT FROM 'coins' THEN
    IF NOT (COALESCE(public.is_admin(), false) OR auth.role() = 'service_role') THEN
      NEW.sale_mode := 'coins';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sale_mode_admin ON public.products;
CREATE TRIGGER trg_products_sale_mode_admin
  BEFORE INSERT OR UPDATE OF sale_mode ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_mode_admin();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) product_preorders — gesammeltes Interesse (kein Geld).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_preorders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity    int  NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999),
  note        text,
  -- Lifecycle: Phase 0 nutzt interested/notified/cancelled; paid/shipped folgen in Phase 1.
  status      text NOT NULL DEFAULT 'interested'
              CHECK (status IN ('interested', 'notified', 'paid', 'shipped', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_preorders_unique UNIQUE (product_id, user_id)  -- 1 Eintrag/User/Produkt (upsert)
);

CREATE INDEX IF NOT EXISTS idx_preorders_product ON public.product_preorders (product_id);
CREATE INDEX IF NOT EXISTS idx_preorders_user    ON public.product_preorders (user_id);

ALTER TABLE public.product_preorders ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_preorders TO authenticated;

-- Käufer: eigene Interessen voll verwalten.
DROP POLICY IF EXISTS preorders_owner_all ON public.product_preorders;
CREATE POLICY preorders_owner_all ON public.product_preorders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Verkäufer (Produkt-Owner) + Admin: Interessen an EIGENEN Produkten lesen.
DROP POLICY IF EXISTS preorders_seller_read ON public.product_preorders;
CREATE POLICY preorders_seller_read ON public.product_preorders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_preorders.product_id AND p.seller_id = auth.uid()
    )
    OR COALESCE(public.is_admin(), false)
  );

-- updated_at automatisch pflegen.
CREATE OR REPLACE FUNCTION public.set_product_preorders_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_preorders_updated_at ON public.product_preorders;
CREATE TRIGGER trg_preorders_updated_at
  BEFORE UPDATE ON public.product_preorders
  FOR EACH ROW EXECUTE FUNCTION public.set_product_preorders_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) RPC: Interesse äußern (Käufer). Validiert sale_mode='preorder', upsertet,
--    benachrichtigt den Verkäufer. Kein Geld, kein Stock-Abzug.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.express_product_interest(
  p_product_id uuid,
  p_quantity   int DEFAULT 1,
  p_note       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_seller uuid;
  v_title  text;
  v_active boolean;
  v_mode   text;
  v_qty    int := GREATEST(1, LEAST(COALESCE(p_quantity, 1), 999));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT seller_id, title, is_active, sale_mode
    INTO v_seller, v_title, v_active, v_mode
  FROM public.products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;
  IF NOT v_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_inactive');
  END IF;
  IF v_mode <> 'preorder' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_preorder');
  END IF;
  IF v_seller = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_preorder_own');
  END IF;

  INSERT INTO public.product_preorders (product_id, user_id, quantity, note, status)
  VALUES (p_product_id, v_uid, v_qty, NULLIF(p_note, ''), 'interested')
  ON CONFLICT (product_id, user_id) DO UPDATE
    SET quantity   = EXCLUDED.quantity,
        note       = EXCLUDED.note,
        status     = 'interested',
        updated_at = now();

  -- Verkäufer benachrichtigen (best-effort — Notification darf den Insert nie kippen).
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, product_name)
    VALUES (v_seller, v_uid, 'preorder_interest', v_title);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.express_product_interest(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.express_product_interest(uuid, int, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) RPC: Verkäufer-Dashboard — Übersicht aggregiert (Duft → wie viele Leute / Flaschen).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_preorder_summary()
RETURNS TABLE (
  product_id       uuid,
  title            text,
  cover_url        text,
  interested_count bigint,
  total_quantity   bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.title, p.cover_url,
         count(pp.id)                       AS interested_count,
         COALESCE(sum(pp.quantity), 0)::bigint AS total_quantity
  FROM public.products p
  LEFT JOIN public.product_preorders pp
    ON pp.product_id = p.id AND pp.status IN ('interested', 'notified')
  WHERE p.seller_id = auth.uid() AND p.sale_mode = 'preorder'
  GROUP BY p.id, p.title, p.cover_url
  ORDER BY interested_count DESC, p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_preorder_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_preorder_summary() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) RPC: Namensliste pro Produkt (zum Anschreiben) — nur Owner/Admin.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_product_preorders(p_product_id uuid)
RETURNS TABLE (
  user_id    uuid,
  username   text,
  avatar_url text,
  quantity   int,
  note       text,
  status     text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT pp.user_id, pr.username, pr.avatar_url, pp.quantity, pp.note, pp.status, pp.created_at
  FROM public.product_preorders pp
  JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE pp.product_id = p_product_id
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = p_product_id
        AND (p.seller_id = auth.uid() OR COALESCE(public.is_admin(), false))
    )
  ORDER BY pp.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_product_preorders(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_preorders(uuid) TO authenticated;
