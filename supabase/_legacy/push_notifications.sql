-- ================================================
-- VIBES APP – Push Notifications Setup
-- Ausführen im Supabase SQL Editor
-- ================================================

-- 1. pg_net Extension aktivieren
-- WICHTIG: Zuerst im Supabase Dashboard aktivieren: Database → Extensions → "pg_net" suchen → Enable
-- Dann dieses Skript ausführen.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Expo Push Token Spalte zu profiles hinzufügen
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- ================================================
-- HILFSFUNKTION: Notification senden
-- ================================================
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
  -- Nur gültige Expo-Tokens verarbeiten
  IF token NOT LIKE 'ExponentPushToken[%]' AND token NOT LIKE 'ExpoPushToken[%]' THEN RETURN; END IF;

  PERFORM net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send'::text,
    body    := jsonb_build_object(
      'to',    token,
      'title', title,
      'body',  body,
      'sound', 'default',
      'data',  data
    ),
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
END;
$$;

-- ================================================
-- TRIGGER 1: Like → Notification an Post-Autor
-- ================================================
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_author_id   UUID;
  v_liker_username   TEXT;
  v_author_token     TEXT;
  v_post_caption     TEXT;
BEGIN
  -- Post-Autor und Caption ermitteln
  SELECT author_id, COALESCE(SUBSTRING(caption, 1, 40), 'Dein Post')
    INTO v_post_author_id, v_post_caption
    FROM public.posts
   WHERE id = NEW.post_id;

  -- Sich selbst nicht benachrichtigen
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Liker-Username
  SELECT COALESCE(username, 'Jemand')
    INTO v_liker_username
    FROM public.profiles
   WHERE id = NEW.user_id;

  -- Autor-Token
  SELECT expo_push_token
    INTO v_author_token
    FROM public.profiles
   WHERE id = v_post_author_id;

  PERFORM send_expo_push(
    token := v_author_token,
    title := '❤️ Neues Like',
    body  := '@' || v_liker_username || ' hat „' || v_post_caption || '" geliked',
    data  := json_build_object('type', 'like', 'postId', NEW.post_id)::jsonb
  );

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='likes') THEN
    DROP TRIGGER IF EXISTS on_like_insert ON public.likes;
    CREATE TRIGGER on_like_insert
      AFTER INSERT ON public.likes
      FOR EACH ROW EXECUTE FUNCTION notify_on_like();
  END IF;
END $$;

-- ================================================
-- TRIGGER 2: Kommentar → Notification an Post-Autor
-- ================================================
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_author_id   UUID;
  v_commenter_name   TEXT;
  v_author_token     TEXT;
  v_comment_preview  TEXT;
BEGIN
  SELECT author_id
    INTO v_post_author_id
    FROM public.posts
   WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(username, 'Jemand')
    INTO v_commenter_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  SELECT expo_push_token
    INTO v_author_token
    FROM public.profiles
   WHERE id = v_post_author_id;

  v_comment_preview := COALESCE(SUBSTRING(NEW.text, 1, 50), '...');

  PERFORM send_expo_push(
    token := v_author_token,
    title := '💬 Neuer Kommentar',
    body  := '@' || v_commenter_name || ': ' || v_comment_preview,
    data  := json_build_object('type', 'comment', 'postId', NEW.post_id)::jsonb
  );

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='comments') THEN
    DROP TRIGGER IF EXISTS on_comment_insert ON public.comments;
    CREATE TRIGGER on_comment_insert
      AFTER INSERT ON public.comments
      FOR EACH ROW EXECUTE FUNCTION notify_on_comment();
  END IF;
END $$;

-- ================================================
-- TRIGGER 3: Follow → Notification an den Gefolgten
-- ================================================
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_follower_name    TEXT;
  v_target_token     TEXT;
BEGIN
  SELECT COALESCE(username, 'Jemand')
    INTO v_follower_name
    FROM public.profiles
   WHERE id = NEW.follower_id;

  SELECT expo_push_token
    INTO v_target_token
    FROM public.profiles
   WHERE id = NEW.following_id;

  PERFORM send_expo_push(
    token := v_target_token,
    title := '👤 Neuer Follower',
    body  := '@' || v_follower_name || ' folgt dir jetzt',
    data  := json_build_object('type', 'follow', 'userId', NEW.follower_id)::jsonb
  );

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='follows') THEN
    DROP TRIGGER IF EXISTS on_follow_insert ON public.follows;
    CREATE TRIGGER on_follow_insert
      AFTER INSERT ON public.follows
      FOR EACH ROW EXECUTE FUNCTION notify_on_follow();
  END IF;
END $$;
