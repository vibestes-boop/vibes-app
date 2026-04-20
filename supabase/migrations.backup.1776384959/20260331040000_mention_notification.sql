-- ────────────────────────────────────────────────────────────────────────────
-- Migration: mention_notification_type
-- Erweitert die notifications-Tabelle um 'mention' Typ und comment_id Spalte
-- Führe aus in: Supabase Dashboard → SQL Editor
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Constraint erweitern
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('like', 'comment', 'follow', 'live', 'live_invite', 'dm', 'mention'));

-- 2. comment_id Spalte hinzufügen (für Mention-Deep-Link zum Kommentar)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES public.comments(id) ON DELETE SET NULL;
