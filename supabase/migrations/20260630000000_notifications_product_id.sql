-- 20260630000000_notifications_product_id.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 HOTFIX: notifications hatte KEINE product_id-Spalte.
--
-- In Session 6 (Shoppable Posts / „Sammelbestellung offen") wurde product_id
-- überall referenziert (announce_preorder_round INSERT, App- + Web-Notif-Query
-- im SELECT, Push-Payload) — die Spalte existierte aber nie. Folgen:
--   • announce_preorder_round („Ankündigen") schlug fehl (INSERT auf fehlende Spalte)
--   • getNotifications (App + Web) selektierte product_id → Query-Fehler → LEERE
--     Liste, während der Unread-Count (eigene Query ohne product_id) weiter zählte
--     → Badge „1", Drawer „keine Benachrichtigungen".
--
-- Fix: Spalte ergänzen (nullable, FK → products, ON DELETE SET NULL: Produkt
-- gelöscht → product_id wird NULL, Notification bleibt, Deep-Link fällt zurück).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS product_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_product_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;
