-- 20260627180000_order_notif_types_2.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Zwei weitere Bestell-Benachrichtigungstypen, damit „alles genau beschrieben"
-- ist (statt generisch 'gift' → Push/Text zeigte „Geschenk geschickt"):
--   order_cancelled        → Verkäufer: „Eine Bestellung wurde storniert"
--   order_address_updated  → Verkäufer: „Lieferadresse wurde aktualisiert"
--
-- 1) CHECK dynamisch erweitern (bestehende + bekannte + neue, nie verlieren).
-- 2) cancel_product_order + update_order_shipping_address emittieren die neuen
--    Typen (vorher 'gift').
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_types text;
BEGIN
  SELECT string_agg(quote_literal(t), ', ')
    INTO v_types
  FROM (
    SELECT t FROM unnest(ARRAY[
      'like','comment','follow','dm','live','live_invite','gift',
      'scheduled_live_reminder','new_order','mention','follow_request',
      'follow_request_accepted','comment_like','repost','story_reaction','guild',
      'preorder_interest','order_payment_requested','order_paid','order_shipped',
      -- NEU:
      'order_cancelled','order_address_updated'
    ]) AS t
    UNION
    SELECT DISTINCT type FROM public.notifications WHERE type IS NOT NULL
  ) s;

  EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check';
  EXECUTE format(
    'ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (%s))',
    v_types
  );
END $$;

-- ── cancel_product_order → order_cancelled ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_product_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order  public.product_orders%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_order.buyer_id <> v_caller THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('error','already_paid');
  END IF;
  IF v_order.status <> 'payment_requested' THEN
    RETURN jsonb_build_object('error','not_cancellable');
  END IF;

  UPDATE public.product_orders
     SET status = 'cancelled', updated_at = now()
   WHERE id = p_order_id;

  IF v_order.preorder_id IS NOT NULL THEN
    DELETE FROM public.product_preorders WHERE id = v_order.preorder_id;
  END IF;

  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    VALUES (v_order.seller_id, v_caller, 'order_cancelled', 'Eine Bestellung wurde storniert.');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.cancel_product_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_product_order(uuid) TO authenticated;

-- ── update_order_shipping_address → order_address_updated ─────────────────────
CREATE OR REPLACE FUNCTION public.update_order_shipping_address(
  p_order_id uuid,
  p_name     text,
  p_street   text,
  p_zip      text,
  p_city     text,
  p_country  text DEFAULT 'DE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_order   public.product_orders%ROWTYPE;
  v_name    text := nullif(btrim(p_name), '');
  v_street  text := nullif(btrim(p_street), '');
  v_zip     text := nullif(btrim(p_zip), '');
  v_city    text := nullif(btrim(p_city), '');
  v_country text := upper(coalesce(nullif(btrim(p_country), ''), 'DE'));
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_order.buyer_id <> v_caller THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  IF v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('error','not_editable');
  END IF;

  IF v_name IS NULL OR v_street IS NULL OR v_zip IS NULL OR v_city IS NULL THEN
    RETURN jsonb_build_object('error','incomplete_address');
  END IF;
  IF v_country NOT IN ('DE','AT','CH') THEN
    RETURN jsonb_build_object('error','country_not_supported');
  END IF;

  UPDATE public.product_orders
     SET ship_name    = v_name,
         ship_street  = v_street,
         ship_zip     = v_zip,
         ship_city    = v_city,
         ship_country = v_country,
         updated_at   = now()
   WHERE id = p_order_id;

  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    VALUES (v_order.seller_id, v_caller, 'order_address_updated', 'Eine Lieferadresse wurde aktualisiert.');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.update_order_shipping_address(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_shipping_address(uuid, text, text, text, text, text) TO authenticated;
