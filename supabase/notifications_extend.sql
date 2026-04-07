-- ================================================================
-- NOTIFICATIONS ERWEITERN: Fehlende Typen + DM-Trigger
-- Ausführen im Supabase SQL Editor
-- ================================================================

-- 1. Notifications-Tabelle: CHECK-Constraint erweitern für alle Typen
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like',
    'comment',
    'follow',
    'follow_request',
    'follow_request_accepted',
    'mention',
    'dm',
    'live',
    'live_invite'
  ));

-- 2. session_id Spalte für Live-Notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS session_id UUID;

-- 3. Conversation-ID für DM-Notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- ================================================================
-- TRIGGER: Neue Nachricht → Push-Notification an Empfänger
-- ================================================================

CREATE OR REPLACE FUNCTION notify_on_dm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender_id       UUID;
  v_recipient_id    UUID;
  v_sender_name     TEXT;
  v_recipient_token TEXT;
BEGIN
  -- Sender ist der Autor der Nachricht
  v_sender_id := NEW.sender_id;

  -- Empfänger: der andere Teilnehmer in der Conversation
  SELECT
    CASE
      WHEN p1_id = v_sender_id THEN p2_id
      ELSE p1_id
    END INTO v_recipient_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF v_recipient_id IS NULL THEN RETURN NEW; END IF;
  -- Keine Selbst-Notification
  IF v_recipient_id = v_sender_id THEN RETURN NEW; END IF;

  -- Sender-Username
  SELECT COALESCE(username, 'Jemand')
    INTO v_sender_name
    FROM public.profiles
   WHERE id = v_sender_id;

  -- Empfänger-Token
  SELECT push_token
    INTO v_recipient_token
    FROM public.profiles
   WHERE id = v_recipient_id;

  -- In-App Notification eintragen (für Notification-Tab)
  INSERT INTO public.notifications (
    recipient_id, sender_id, type,
    comment_text, conversation_id
  ) VALUES (
    v_recipient_id, v_sender_id, 'dm',
    LEFT(NEW.content, 80), NEW.conversation_id
  );

  -- Push Notification via Expo API (benötigt pg_net Extension)
  IF v_recipient_token IS NOT NULL AND v_recipient_token != '' THEN
    PERFORM net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send'::text,
      body    := jsonb_build_object(
        'to',    v_recipient_token,
        'title', '@' || v_sender_name,
        'body',  COALESCE(LEFT(NEW.content, 100), '✉️ Neue Nachricht'),
        'sound', 'default',
        'data',  jsonb_build_object(
          'type',            'dm',
          'conversationId',  NEW.conversation_id::text,
          'senderId',        v_sender_id::text,
          'senderUsername',  v_sender_name
        )
      ),
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger auf messages-Tabelle registrieren
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='messages') THEN
    DROP TRIGGER IF EXISTS on_message_insert ON public.messages;
    CREATE TRIGGER on_message_insert
      AFTER INSERT ON public.messages
      FOR EACH ROW EXECUTE FUNCTION notify_on_dm();
  END IF;
END $$;

-- ================================================================
-- FOLLOW REQUEST: In-App Notification Trigger
-- ================================================================

CREATE OR REPLACE FUNCTION notify_on_follow_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender_name  TEXT;
  v_target_token TEXT;
BEGIN
  -- Nur wenn is_pending = true (Follow-Request an privates Profil)
  IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand')
    INTO v_sender_name
    FROM public.profiles
   WHERE id = NEW.follower_id;

  -- In-App Notification
  INSERT INTO public.notifications (recipient_id, sender_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow_request')
  ON CONFLICT DO NOTHING;

  -- Push
  SELECT push_token INTO v_target_token
    FROM public.profiles WHERE id = NEW.following_id;

  IF v_target_token IS NOT NULL AND v_target_token != '' THEN
    PERFORM net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send'::text,
      body    := jsonb_build_object(
        'to',    v_target_token,
        'title', '👤 Follow-Anfrage',
        'body',  '@' || v_sender_name || ' möchte dir folgen',
        'sound', 'default',
        'data',  jsonb_build_object(
          'type',     'follow_request',
          'senderId', NEW.follower_id::text
        )
      ),
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ================================================================
-- push_token Spalte sicherstellen (falls push_notifications.sql
-- noch nicht mit dem richtigen Spaltennamen ausgeführt wurde)
-- ================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;
