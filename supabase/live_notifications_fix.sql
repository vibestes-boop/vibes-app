-- ── Live-Notifications Fix ────────────────────────────────────────────────────
-- Führe dieses Skript im Supabase SQL-Editor aus.

-- 1. session_id Spalte hinzufügen (falls noch nicht vorhanden)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.live_sessions(id) ON DELETE SET NULL;

-- 2. type-Constraint erweitern: 'live' und 'live_invite' erlauben
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'follow', 'live', 'live_invite'));

-- 3. Index für Live-Notifications (optional, verbessert Performance)
CREATE INDEX IF NOT EXISTS notifications_session_idx
  ON public.notifications (session_id)
  WHERE session_id IS NOT NULL;
