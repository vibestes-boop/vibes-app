-- ═══════════════════════════════════════════════════════════════════════════
-- Berkat — Bestellung als versendet markieren
--
-- Nach der Zahlung setzt Serlos Stripe-Webhook die Bestellung auf 'paid' und
-- schreibt die Versandadresse hinein. Danach fehlte der letzte Schritt: der
-- Verkäufer muss sagen können, dass die Ware raus ist — mit Sendungsnummer,
-- damit der Käufer sie verfolgen kann.
--
-- `product_orders` ist bewusst nur für service_role schreibbar (Geldpfad).
-- Deshalb eine eng geschnittene RPC statt einer Schreib-Policy: sie kann genau
-- eine Sache, und nur der Verkäufer der Bestellung darf sie.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mark_order_shipped(
  p_order_id uuid,
  p_carrier  text DEFAULT NULL,
  p_tracking text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  o     public.product_orders;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO o FROM public.product_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = '22023';
  END IF;
  IF o.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Nur bezahlte Bestellungen. Etwas als versendet zu melden, das nicht
  -- bezahlt ist, wäre der schnellste Weg zu einem Streitfall.
  IF o.status <> 'paid' THEN
    RAISE EXCEPTION 'order_not_paid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.product_orders
     SET status           = 'shipped',
         shipped_at       = now(),
         tracking_carrier = NULLIF(btrim(COALESCE(p_carrier, '')), ''),
         tracking_number  = NULLIF(btrim(COALESCE(p_tracking, '')), ''),
         updated_at       = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('order_id', p_order_id, 'status', 'shipped');
END $$;

REVOKE ALL ON FUNCTION public.mark_order_shipped(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_order_shipped(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.mark_order_shipped(uuid, text, text) IS
  'Berkat: Verkäufer meldet eine bezahlte Bestellung als versendet, mit Sendungsnummer.';
