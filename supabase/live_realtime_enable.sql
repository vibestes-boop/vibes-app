-- ============================================================
-- live_realtime_enable.sql
-- Aktiviert Supabase Realtime für live_sessions Tabelle
-- + fügt dm-Typ zur notifications CHECK-Constraint hinzu
-- Im Supabase SQL-Editor ausführen
-- ============================================================

-- 1. live_sessions zu Realtime-Publication hinzufügen (nur wenn noch nicht drin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
  END IF;
END $$;

-- live_comments (falls noch nicht drin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_comments;
  END IF;
END $$;

-- live_reactions (falls noch nicht drin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;
  END IF;
END $$;

-- 2. session_id Spalte zur notifications Tabelle (falls noch nicht vorhanden)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS session_id UUID
    REFERENCES public.live_sessions(id) ON DELETE SET NULL;

-- 3. notifications type CHECK-Constraint erweitern
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('like', 'comment', 'follow', 'live', 'live_invite', 'dm'));

-- 4. Index für schnelle Live-Notification-Abfragen
CREATE INDEX IF NOT EXISTS notifications_session_idx
  ON public.notifications (session_id)
  WHERE session_id IS NOT NULL;
