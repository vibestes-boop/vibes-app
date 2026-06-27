-- 20260627170000_order_notification_types.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Bestell-Benachrichtigungen auf eigene Typen umstellen (statt generisch 'gift').
-- Die Typen order_payment_requested / order_paid / order_shipped sind seit
-- Migration 20260627140000 im notifications_type_check erlaubt — hier werden sie
-- jetzt tatsächlich emittiert. Renderer (App + Web) kennen sie (eigenes Icon +
-- Deep-Link zur Bestellung) ab demselben Release.
--
--   order_payment_requested → Käufer „jetzt bezahlen"  (mark_preorders_payable)
--   order_shipped           → Käufer „unterwegs"        (set_order_shipped)
--   order_paid              → Verkäufer „bitte versenden" (stripe-webhook, Edge)
--
-- mark_preorders_payable trägt den Repeat-Kauf-Fix aus 20260627160000 mit
-- (Skip nur bei laufender Bestellung: payment_requested/paid/shipped).
-- ═══════════════════════════════════════════════════════════════════════════

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

  IF v_product.seller_id <> v_caller AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  v_unit := v_product.price_eur;
  IF v_unit IS NULL OR v_unit <= 0 THEN
    RETURN jsonb_build_object('error','no_eur_price');
  END IF;

  FOR r IN
    SELECT pp.* FROM public.product_preorders pp
     WHERE pp.product_id = p_product_id
       AND pp.status IN ('interested','notified')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.product_orders po
       WHERE po.preorder_id = r.id
         AND po.status IN ('payment_requested','paid','shipped')
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
    VALUES (r.user_id, v_caller, 'order_payment_requested',
            'Dein Parfüm ist da — jetzt bezahlen 🌸', v_product.title);

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'created', v_created, 'skipped', v_skipped);
END $$;

REVOKE ALL ON FUNCTION public.mark_preorders_payable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_preorders_payable(uuid) TO authenticated;

-- ── set_order_shipped → Käufer-Push als order_shipped ─────────────────────────
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
  VALUES (v_order.buyer_id, v_caller, 'order_shipped', 'Dein Parfüm ist unterwegs 📦');

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.set_order_shipped(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_order_shipped(uuid, text, text) TO authenticated;
