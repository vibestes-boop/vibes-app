-- 20260629180000_preorder_round_announce.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- #4-Erweiterung „Sammelbestellung offen" — Verkäufer/Admin kündigt eine
-- Sammelbestell-Runde an (Zaurs Samstag-Fenster). Alle, die das Produkt
-- vorgemerkt ODER gespeichert haben, bekommen EINE warme Benachrichtigung
-- (+ Push via trg_push_notification) mit Deep-Link aufs Produkt → vormerken/
-- sichern, solange das Fenster offen ist.
--
-- Bewusst manueller Auslöser (kein Cron): du öffnest die Runde, wenn du sie
-- öffnest. Reuse der bestehenden Notification-Infra; neuer Typ
-- preorder_round_open mit product_id für den Produkt-Deep-Link.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Typ erlauben (dynamisch erweitern, bestehende nie verlieren).
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
      'preorder_interest','order_payment_requested','order_payment_reminder',
      'order_paid','order_shipped','order_cancelled','order_address_updated',
      'order_review','order_dispute',
      -- NEU
      'preorder_round_open'
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

-- 2) Ankündigungs-RPC: an Vormerker (interested/notified) + Speicherer.
CREATE OR REPLACE FUNCTION public.announce_preorder_round(
  p_product_id uuid,
  p_message    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_msg     text;
  v_count   int := 0;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','product_not_found'); END IF;

  -- Nur der Verkäufer des Produkts oder ein Admin darf ankündigen.
  IF v_product.seller_id <> v_caller AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  v_msg := COALESCE(
    NULLIF(btrim(p_message), ''),
    'Sammelbestellung läuft! 🌸 „' || v_product.title
      || '" wird gerade gesammelt — jetzt sichern, solange das Fenster offen ist.'
  );

  -- Ein INSERT für die deduplizierte Zielgruppe (Vormerker ∪ Speicherer),
  -- ohne den Verkäufer selbst.
  WITH audience AS (
    SELECT user_id AS uid FROM public.product_preorders
      WHERE product_id = p_product_id AND status IN ('interested','notified')
    UNION
    SELECT user_id AS uid FROM public.saved_products
      WHERE product_id = p_product_id
  ),
  ins AS (
    INSERT INTO public.notifications
      (recipient_id, sender_id, type, comment_text, product_name, product_id)
    SELECT a.uid, v_caller, 'preorder_round_open', v_msg, v_product.title, p_product_id
      FROM audience a
     WHERE a.uid <> v_caller
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  RETURN jsonb_build_object('success', true, 'notified', v_count);
END $$;

REVOKE ALL ON FUNCTION public.announce_preorder_round(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.announce_preorder_round(uuid, text) TO authenticated;
