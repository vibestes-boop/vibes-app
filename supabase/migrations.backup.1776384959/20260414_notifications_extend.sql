-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — notifications Tabelle erweitern
-- Datum: 2026-04-14
--
-- 1. type CHECK erweitern: gift, dm, live, live_invite hinzufügen
-- 2. session_id Spalte hinzufügen (für Live-Notifications)
-- (gift_name + gift_emoji wurden bereits in 20260414_gift_notification_trigger.sql hinzugefügt)
-- ══════════════════════════════════════════════════════════════════════════════

-- CHECK Constraint auf type erweitern
-- Postgres: Constraint droppen + neu anlegen
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'follow', 'dm', 'live', 'live_invite', 'gift'));

-- session_id Spalte für Live-Notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.live_sessions(id) ON DELETE SET NULL;

-- Alten INSERT-Policy sicherstellen (Service Role darf auch schreiben)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notif_service_insert'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "notif_service_insert" ON public.notifications
        FOR INSERT
        WITH CHECK (true);
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ notifications Tabelle erweitert (gift, dm, live, session_id)';
END $$;
