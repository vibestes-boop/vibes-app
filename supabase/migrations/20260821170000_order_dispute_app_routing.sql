-- ─────────────────────────────────────────────────────────────────────────────
-- `report_order_dispute` schickt seine Meldung in die FALSCHE APP
--
-- ⚠️ GEFUNDEN, BEVOR ES BENUTZT WURDE — aber der Weg ist seit dem 28.06.2026
-- live und betrifft Serlo genauso.
--
-- DAS PROBLEM
-- `report_order_dispute` (Migration `20260628110000`) schreibt zwei
-- Benachrichtigungen: eine an die Gegenseite, eine an jeden Admin. Beide so:
--
--   INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
--
-- Die Spalte `app` fehlt. Sie kam erst am 14.08.2026 dazu
-- (`20260814280000`) und trägt `DEFAULT 'serlo'`. Jede Streit-Meldung landet
-- damit in **Serlos** Posteingang.
--
-- Berkats Liste liest ausschließlich `app = 'berkat'` (`lib/useNotifications.ts`,
-- der Filter ist dort ausdrücklich begründet). Ein Verkäufer, dem ein Käufer ein
-- Problem meldet, sähe die Meldung in Berkat also **nie** — und in Serlo, wo sie
-- landet, ergibt sie keinen Sinn.
--
-- Das ist genau die Falle aus der Übergabe: **Jede geteilte Tabelle braucht die
-- App-Spalte an ALLEN Schreibwegen, nicht nur an den neuen.** `20260814280000`
-- hat die Lesepfade und die damals bekannten Schreibpfade umgestellt; diese RPC
-- war zwei Monate älter und stand nicht auf der Liste.
--
-- WORAN MAN DIE APP ERKENNT
-- `product_orders` hat keine `app`-Spalte. Der verlässliche Hinweis ist
-- `cart_id`: Er zeigt auf `auction_carts`, eine Tabelle, die es nur in Berkat
-- gibt. Beide Berkat-Geldwege setzen ihn —
--
--   settle_live_auction        (Zuschlag)      → ensure_auction_cart
--   buy_now_live_auction       (Sofortkauf)    → ensure_auction_cart
--
-- — und Serlos Shop-Bestellungen haben ihn nie. `cart_id IS NOT NULL` ist damit
-- die exakte Grenze, nicht eine Näherung.
--
-- WAS SICH SONST NICHT ÄNDERT
-- Signatur, Rechte, Gründe, Zustände, die Doppelmeldungs-Regel und die
-- Admin-Schleife bleiben Zeile für Zeile wie sie waren. `CREATE OR REPLACE`
-- genügt, kein DROP — die Signatur ist identisch, es gibt also keine
-- Überladung und kein HTTP 300 (Übergabe, Abschnitt 13).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.report_order_dispute(
  p_order_id uuid, p_reason text, p_detail text default null
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_order   public.product_orders%ROWTYPE;
  v_role    text;
  v_against uuid;
  v_detail  text := nullif(btrim(p_detail), '');
  v_app     text;
  r_admin   record;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF p_reason NOT IN ('not_received','damaged','not_as_described','not_paid','fraud','other') THEN
    RETURN jsonb_build_object('error','bad_reason');
  END IF;
  IF v_detail IS NOT NULL AND length(v_detail) > 2000 THEN v_detail := left(v_detail, 2000); END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_caller = v_order.buyer_id THEN v_role := 'buyer'; v_against := v_order.seller_id;
  ELSIF v_caller = v_order.seller_id THEN v_role := 'seller'; v_against := v_order.buyer_id;
  ELSE RETURN jsonb_build_object('error','not_participant');
  END IF;

  IF v_order.status NOT IN ('paid','shipped','delivered') THEN
    RETURN jsonb_build_object('error','bad_status');
  END IF;

  -- ⚠️ Der Kern dieser Migration. Siehe Kopf.
  v_app := CASE WHEN v_order.cart_id IS NOT NULL THEN 'berkat' ELSE 'serlo' END;

  INSERT INTO public.order_disputes (order_id, reporter_id, against_id, reporter_role, reason, detail)
  VALUES (p_order_id, v_caller, v_against, v_role, p_reason, v_detail)
  ON CONFLICT (order_id, reporter_id) DO UPDATE
    SET reason = excluded.reason, detail = excluded.detail, status = 'open', resolved_at = NULL;

  -- Gegenseite informieren.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, app)
    VALUES (v_against, v_caller, 'order_dispute',
            'Ein Problem mit einer Bestellung wurde gemeldet ⚠️', v_app);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Admins informieren (außer wenn schon als Gegenseite/Melder benachrichtigt).
  FOR r_admin IN SELECT id FROM public.profiles WHERE is_admin = true LOOP
    IF r_admin.id <> v_caller AND r_admin.id <> v_against THEN
      BEGIN
        INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, app)
        VALUES (r_admin.id, v_caller, 'order_dispute',
                'Neue Streit-Meldung zu einer Bestellung ⚠️', v_app);
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.report_order_dispute(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_order_dispute(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.report_order_dispute(uuid, text, text) IS
  'Meldet ein Problem zu einer Bestellung. Leitet die App aus product_orders.cart_id ab '
  '(nicht NULL = Berkat) und stempelt notifications.app entsprechend — ohne das landet '
  'jede Berkat-Meldung per DEFAULT in Serlos Posteingang.';

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. Genau eine Signatur, kein `anon`:
--      SELECT p.proname, pg_get_function_identity_arguments(p.oid),
--             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_darf
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname='public' AND p.proname='report_order_dispute';
--      -- erwartet: eine Zeile, anon_darf = false
--
-- 2. ⚠️ Die eigentliche Probe, und sie braucht eine echte Berkat-Bestellung:
--      SELECT app, type FROM notifications
--       WHERE type='order_dispute' ORDER BY created_at DESC LIMIT 2;
--      -- erwartet: 'berkat' — steht dort 'serlo', ist der Fix nicht drin
--      -- oder die Bestellung hat keinen cart_id.
--
-- 3. Die Grenze selbst nachsehen, falls je Zweifel besteht:
--      SELECT count(*) FILTER (WHERE cart_id IS NOT NULL) AS berkat,
--             count(*) FILTER (WHERE cart_id IS NULL)     AS serlo
--        FROM product_orders;
-- ─────────────────────────────────────────────────────────────────────────────
