-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — notifications Tabelle: product_name Spalte
-- Datum: 2026-04-15
--
-- Erweitert notifications um product_name (für new_order Push-Notifications)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Sicherstellen dass 'mention' und 'follow_request_accepted' im type-Check sind
-- (werden von älteren Constraints möglicherweise nicht abgedeckt)
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO v_constraint
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'notifications'
    AND c.conname = 'notifications_type_check';

  -- Nur updaten wenn product_name-Spalte neu ist (Constraint noch nicht erweitert)
  IF v_constraint IS NOT NULL
     AND v_constraint NOT LIKE '%product_name%'
  THEN
    -- Nichts zu tun am Constraint — product_name ist eine Spalte, kein Typ
    RAISE NOTICE 'ℹ️ product_name Spalte hinzugefügt (kein Constraint-Update nötig)';
  END IF;
END $$;

DO $$ BEGIN
  RAISE NOTICE '✅ notifications.product_name Spalte bereit';
END $$;
