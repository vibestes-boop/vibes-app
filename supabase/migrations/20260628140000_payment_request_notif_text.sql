-- 20260628140000_payment_request_notif_text.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- „Zahlung anfordern"-Benachrichtigung wärmer + konkreter.
--
-- Vorher: 'Dein Parfüm ist da — jetzt bezahlen 🌸' (kein Preis, kein Ablauf).
-- Nachher: nennt den Gesamtbetrag (pro Person/Menge korrekt aus der Order) und
--          den Ablauf (erst zahlen, dann Versand) — passt zum Sammelbestell-Modell.
--
-- Der Text landet in notifications.comment_text und wird von ALLEN Flächen
-- genutzt: App-Liste (app/(tabs)/notifications.tsx), App-Push
-- (send-push-notification body), Web-Liste (notification-list.tsx). Nur diese
-- eine Stelle ändern reicht. Betrag deutsch formatiert (Komma statt Punkt).
--
-- CREATE OR REPLACE, gleiche Signatur — nur der comment_text-String ändert sich.
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
            'Deine Vorbestellung ist da! 🌸 Jetzt '
              || replace((v_unit * r.quantity)::text, '.', ',')
              || ' € zahlen — danach geht sie direkt an dich raus.',
            v_product.title);

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'created', v_created, 'skipped', v_skipped);
END $$;

REVOKE ALL ON FUNCTION public.mark_preorders_payable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_preorders_payable(uuid) TO authenticated;
