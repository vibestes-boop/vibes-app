-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Gift Push-Notification Trigger
-- Datum: 2026-04-14
--
-- Trigger: feuert nach INSERT auf gift_transactions
-- → Legt einen Eintrag in notifications-Tabelle an
-- → supabase webhook → send-push-notification Edge Function
-- ══════════════════════════════════════════════════════════════════════════════

-- Sicherstellen dass notifications-Tabelle gift-Felder hat
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS gift_name  TEXT,
  ADD COLUMN IF NOT EXISTS gift_emoji TEXT;

-- Gift-Notification Trigger Function
CREATE OR REPLACE FUNCTION public.notify_on_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gift_name  TEXT;
  v_gift_emoji TEXT;
BEGIN
  -- Gift-Infos aus Katalog holen
  SELECT name, emoji
    INTO v_gift_name, v_gift_emoji
    FROM public.gift_catalog
   WHERE id = NEW.gift_id;

  -- Nur benachrichtigen wenn Sender ≠ Empfänger
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  -- Notification-Eintrag anlegen (löst Webhook aus → Edge Function)
  INSERT INTO public.notifications (
    recipient_id,
    sender_id,
    type,
    gift_name,
    gift_emoji,
    session_id,
    created_at
  ) VALUES (
    NEW.recipient_id,
    NEW.sender_id,
    'gift',
    v_gift_name,
    v_gift_emoji,
    NEW.live_session_id,
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Trigger auf gift_transactions
DROP TRIGGER IF EXISTS trg_notify_on_gift ON public.gift_transactions;
CREATE TRIGGER trg_notify_on_gift
  AFTER INSERT ON public.gift_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_gift();

DO $$
BEGIN
  RAISE NOTICE '✅ Gift-Push-Notification Trigger deployed';
END $$;
