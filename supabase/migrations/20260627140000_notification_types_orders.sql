-- 20260627140000_notification_types_orders.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: Vormerk-Benachrichtigung kam nie an.
--
-- express_product_interest fügt eine Notification mit type='preorder_interest'
-- ein — der war aber NICHT in der notifications_type_check-Constraint. Der Insert
-- scheiterte still (EXCEPTION WHEN OTHERS THEN NULL) → Verkäufer wurde nie
-- benachrichtigt, wenn jemand vormerkt.
--
-- Lösung: CHECK dynamisch erweitern um die Bestell-/Vormerk-Typen, OHNE eine
-- bestehende, real genutzte Typ-Zeile zu verlieren (merge aus bekannter Liste +
-- neuen Typen + tatsächlich vorhandenen DISTINCT-Typen der Tabelle).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_types text;
BEGIN
  SELECT string_agg(quote_literal(t), ', ')
    INTO v_types
  FROM (
    SELECT t FROM unnest(ARRAY[
      -- bekannte Bestands-Typen (Renderer kennen diese)
      'like','comment','follow','dm','live','live_invite','gift',
      'scheduled_live_reminder','new_order','mention','follow_request',
      'follow_request_accepted','comment_like','repost','story_reaction','guild',
      -- NEU: Vormerkung + Echtgeld-Bestell-Lebenszyklus
      'preorder_interest','order_payment_requested','order_paid','order_shipped'
    ]) AS t
    UNION
    -- alles, was real schon in der Tabelle steht (nie verlieren)
    SELECT DISTINCT type FROM public.notifications WHERE type IS NOT NULL
  ) s;

  EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check';
  EXECUTE format(
    'ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (%s))',
    v_types
  );

  RAISE NOTICE '✅ notifications_type_check erweitert: preorder_interest + order_* erlaubt';
END $$;
