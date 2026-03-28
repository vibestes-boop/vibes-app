-- ================================================
-- FIX: Kommentare + Push Notifications
-- Einmal im Supabase SQL Editor ausführen
-- ================================================

-- 1. notify_on_comment_to_table (notifications.sql) — NEW.text statt NEW.content
CREATE OR REPLACE FUNCTION notify_on_comment_to_table()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, post_id, comment_text)
    VALUES (post_author, NEW.user_id, 'comment', NEW.post_id, LEFT(NEW.text, 80));
  END IF;
  RETURN NEW;
END;
$$;

-- 2. send_expo_push — explizite Typen für pg_net (url::text, body als jsonb)
CREATE OR REPLACE FUNCTION send_expo_push(
  token    TEXT,
  title    TEXT,
  body     TEXT,
  data     JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF token IS NULL OR token = '' THEN RETURN; END IF;
  IF token NOT LIKE 'ExponentPushToken[%]' AND token NOT LIKE 'ExpoPushToken[%]' THEN RETURN; END IF;

  PERFORM net.http_post(
    url     := ('https://exp.host/--/api/v2/push/send')::text,
    body    := jsonb_build_object('to', token, 'title', title, 'body', body, 'sound', 'default', 'data', data),
    headers := ('{"Content-Type": "application/json", "Accept": "application/json"}')::jsonb
  );
END;
$$;
