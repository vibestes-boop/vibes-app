-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: private_profiles + follow_requests
-- Führe aus in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. profiles: is_private Spalte
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 2. follow_requests Tabelle
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   uuid NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(sender_id, receiver_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS follow_requests_receiver_idx ON public.follow_requests(receiver_id);
CREATE INDEX IF NOT EXISTS follow_requests_sender_idx   ON public.follow_requests(sender_id);

-- RLS
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

-- Jeder kann eigene gesendete und empfangene Requests sehen
CREATE POLICY "follow_requests_select"
  ON public.follow_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Nur eigene Requests senden (nicht doppelt – unique constraint greift)
CREATE POLICY "follow_requests_insert"
  ON public.follow_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND sender_id != receiver_id);

-- Empfänger oder Absender können Request löschen (ablehnen / zurückziehen)
CREATE POLICY "follow_requests_delete"
  ON public.follow_requests FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 3. notifications: follow_request Typen erlauben
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'like', 'comment', 'follow', 'live', 'live_invite',
      'dm', 'mention', 'follow_request', 'follow_request_accepted'
    ));
