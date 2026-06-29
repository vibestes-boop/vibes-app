-- 20260629170000_payment_reminder.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- #4 Rückkanal — Auto-Erinnerung an Vormerker mit unbezahlter Bestellung.
--
-- Nach „Ware ist da → Zahlung anfordern" (mark_preorders_payable) bekommt der
-- Käufer EINEN Ping. Zahlt er nicht, passierte bisher nichts mehr. Diese
-- Migration schickt nach 24h EINE sanfte Erinnerung (kein Spam, keine FOMO —
-- Design-Gesetz #4: gesunde Bindung, eine freundliche Erinnerung).
--
-- Ablauf: stündlicher Cron → send_payment_reminders() findet payment_requested-
-- Orders, die >24h alt + noch nicht erinnert sind → Notification (löst via
-- trg_push_notification automatisch Push aus) + reminded_at setzen (= 1×).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Eine Erinnerung pro Order — reminded_at als Gate.
ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

-- 2) Neuen Notification-Typ erlauben (dynamisch erweitern, bestehende Typen
--    nie verlieren — Muster aus 20260627140000).
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
      'order_cancelled','order_address_updated','order_review','order_dispute',
      -- NEU
      'order_payment_reminder'
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

-- 3) Die Erinnerungs-Funktion.
CREATE OR REPLACE FUNCTION public.send_payment_reminders()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  r       record;
BEGIN
  FOR r IN
    SELECT po.id, po.buyer_id, po.seller_id, po.amount_eur, p.title
      FROM public.product_orders po
      JOIN public.products p ON p.id = po.product_id
     WHERE po.status = 'payment_requested'
       AND po.reminded_at IS NULL
       AND po.payment_requested_at < now() - interval '24 hours'
  LOOP
    -- comment_text trägt den fertigen, warmen Text (alle Surfaces nutzen ihn).
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, product_name)
    VALUES (
      r.buyer_id, r.seller_id, 'order_payment_reminder',
      'Dein Parfüm wartet noch auf dich 🌸 — kurz '
        || replace(r.amount_eur::text, '.', ',')
        || ' € bezahlen, dann geht es direkt raus.',
      r.title
    );
    UPDATE public.product_orders SET reminded_at = now() WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.send_payment_reminders() FROM PUBLIC, anon;

-- 4) Stündlicher Cron (idempotent neu planen).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'payment-reminders') THEN
    PERFORM cron.unschedule('payment-reminders');
  END IF;
  PERFORM cron.schedule('payment-reminders', '17 * * * *', $cron$SELECT public.send_payment_reminders();$cron$);
END $$;
