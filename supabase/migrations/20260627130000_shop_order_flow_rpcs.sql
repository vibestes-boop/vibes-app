-- 20260627130000_shop_order_flow_rpcs.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Phase-1-Flow-RPCs für echte €-Bestellungen (physische Ware / Parfüm).
-- Baut auf 20260627120000_shop_real_money_orders.sql + product_preorders.
--
-- Parfüm-Ablauf (Zaurs Entscheidung): Vormerken (0 €) → du bestellst beim
-- Lieferanten → Ware da → mark_preorders_payable() erzeugt Zahlungs-
-- aufforderungen → User zahlt (Stripe, eigener Schritt) → set_order_shipped()
-- → confirm_order_delivered().
--
-- Alle RPCs: SECURITY DEFINER (umgehen die service_role-only-RLS der
-- product_orders bewusst, mit eigener Identitäts-Prüfung). Reine DB, kein Stripe.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. „Ware ist da" → Zahlungsaufforderungen aus Vormerkungen erzeugen ───────
-- Nur Produkt-Verkäufer oder Admin. Idempotent: pro Vormerkung max. eine offene
-- Bestellung. Schreibt jedem Interessenten eine Benachrichtigung („jetzt zahlen").
CREATE OR REPLACE FUNCTION public.mark_preorders_payable(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_product  public.products%ROWTYPE;
  v_unit     numeric(10,2);
  v_created  int := 0;
  v_skipped  int := 0;
  r          record;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','product_not_found'); END IF;

  -- Gate: nur der Verkäufer des Produkts oder ein Admin
  IF v_product.seller_id <> v_caller AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  -- €-Preis muss gesetzt sein (sonst kann nicht abgerechnet werden)
  v_unit := v_product.price_eur;
  IF v_unit IS NULL OR v_unit <= 0 THEN
    RETURN jsonb_build_object('error','no_eur_price');
  END IF;

  FOR r IN
    SELECT pp.* FROM public.product_preorders pp
     WHERE pp.product_id = p_product_id
       AND pp.status IN ('interested','notified')
  LOOP
    -- Idempotenz: keine zweite offene/erledigte Order pro Vormerkung
    IF EXISTS (
      SELECT 1 FROM public.product_orders po
       WHERE po.preorder_id = r.id
         AND po.status IN ('payment_requested','paid','shipped','delivered')
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.product_orders
      (buyer_id, seller_id, product_id, preorder_id, quantity,
       unit_price_eur, amount_eur, platform_fee_eur, status, payment_requested_at)
    VALUES
      (r.user_id, v_product.seller_id, p_product_id, r.id, r.quantity,
       v_unit, v_unit * r.quantity, 0, 'payment_requested', now());

    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, product_name)
    VALUES (r.user_id, v_caller, 'gift',
            'Dein Parfüm ist da — jetzt bezahlen 🌸', v_product.title);

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'created', v_created, 'skipped', v_skipped);
END $$;

REVOKE ALL ON FUNCTION public.mark_preorders_payable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_preorders_payable(uuid) TO authenticated;

-- ── 2. Versendet (+ Tracking) ────────────────────────────────────────────────
-- Nur Verkäufer/Admin. Nur aus 'paid' → 'shipped'. Zieht Vormerkung mit + Push.
CREATE OR REPLACE FUNCTION public.set_order_shipped(
  p_order_id uuid,
  p_carrier  text DEFAULT NULL,
  p_tracking text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order  public.product_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_order.seller_id <> v_caller AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  IF v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('error','not_paid');
  END IF;

  UPDATE public.product_orders
     SET status           = 'shipped',
         shipped_at       = now(),
         tracking_carrier = COALESCE(p_carrier,  tracking_carrier),
         tracking_number  = COALESCE(p_tracking, tracking_number)
   WHERE id = p_order_id;

  IF v_order.preorder_id IS NOT NULL THEN
    UPDATE public.product_preorders SET status = 'shipped', updated_at = now()
     WHERE id = v_order.preorder_id;
  END IF;

  INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
  VALUES (v_order.buyer_id, v_caller, 'gift', 'Dein Parfüm ist unterwegs 📦');

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.set_order_shipped(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_order_shipped(uuid, text, text) TO authenticated;

-- ── 3. Empfang bestätigt (Käufer) ────────────────────────────────────────────
-- Nur der Käufer. Nur aus 'shipped' → 'delivered'. (Später optional auto nach X Tagen.)
CREATE OR REPLACE FUNCTION public.confirm_order_delivered(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order  public.product_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_order.buyer_id <> v_caller THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  IF v_order.status <> 'shipped' THEN
    RETURN jsonb_build_object('error','not_shipped');
  END IF;

  UPDATE public.product_orders SET status = 'delivered', delivered_at = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.confirm_order_delivered(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_delivered(uuid) TO authenticated;
