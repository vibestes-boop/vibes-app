-- 20260630010000_notify_on_save.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- „Merken" benachrichtigt jetzt den Verkäufer (weiches Interesse-Signal fürs
-- Lead-Gen — Speicherer sind ja auch schon die Zielgruppe von „Ankündigen").
--
-- TRIGGER auf saved_products statt beide Save-Pfade anzufassen: App nutzt die
-- RPC toggle_save_product, Web schreibt direkt per upsert in saved_products.
-- Ein AFTER-INSERT-Trigger deckt BEIDE ab. Push feuert automatisch via dem
-- bestehenden trg_push_notification (AFTER INSERT auf notifications).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Typ erlauben (dynamisch, bestehende nie verlieren).
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
      'preorder_interest','preorder_round_open',
      'order_payment_requested','order_payment_reminder','order_paid',
      'order_shipped','order_cancelled','order_address_updated',
      'order_review','order_dispute',
      -- NEU
      'product_saved'
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

-- 2) Trigger-Funktion: bei neuem Merken den Verkäufer benachrichtigen.
CREATE OR REPLACE FUNCTION public.fn_notify_seller_on_save()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
  v_title  text;
BEGIN
  SELECT seller_id, title INTO v_seller, v_title
    FROM public.products WHERE id = NEW.product_id;

  -- Kein Seller (gelöscht) oder eigenes Produkt → kein Ping.
  IF v_seller IS NULL OR v_seller = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, product_name, product_id)
  VALUES
    (v_seller, NEW.user_id, 'product_saved', v_title, NEW.product_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ein Merken darf NIE an der Benachrichtigung scheitern.
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_seller_on_save ON public.saved_products;
CREATE TRIGGER trg_notify_seller_on_save
  AFTER INSERT ON public.saved_products
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_seller_on_save();
