-- ================================================
-- VIBES APP – Multi-Device Push Tokens
-- Ausführen im Supabase SQL Editor NACH push_notifications.sql
-- Erlaubt mehrere Geräte pro User (statt ein Token in profiles)
-- ================================================

-- Tabelle: ein Eintrag pro User+Gerät
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token        TEXT NOT NULL,
  platform     TEXT CHECK (platform IN ('ios', 'android', 'other')) DEFAULT 'other',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_tokens_user_token_unique UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- RLS: User sieht + verwaltet nur eigene Tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User manages own tokens" ON public.push_tokens;
CREATE POLICY "User manages own tokens"
  ON public.push_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================
-- HILFSFUNKTION: An ALLE Geräte eines Users senden
-- Ersetzt das direkte send_expo_push(token, ...) in den Triggern.
-- Tokens älter als 90 Tage werden automatisch gelöscht.
-- ================================================
CREATE OR REPLACE FUNCTION send_push_to_user(
  p_user_id UUID,
  p_title   TEXT,
  p_body    TEXT,
  p_data    JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Stale Tokens (> 90 Tage nicht gesehen) aufräumen
  DELETE FROM public.push_tokens
   WHERE user_id = p_user_id
     AND last_seen_at < NOW() - INTERVAL '90 days';

  -- An jedes aktive Gerät senden
  FOR v_token IN
    SELECT token FROM public.push_tokens WHERE user_id = p_user_id
  LOOP
    PERFORM send_expo_push(
      token := v_token,
      title := p_title,
      body  := p_body,
      data  := p_data
    );
  END LOOP;
END;
$$;

-- ================================================
-- Trigger-Funktionen auf send_push_to_user umstellen
-- ================================================
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_author_id UUID;
  v_liker_username TEXT;
  v_post_caption   TEXT;
BEGIN
  SELECT author_id, COALESCE(SUBSTRING(caption, 1, 40), 'Dein Post')
    INTO v_post_author_id, v_post_caption
    FROM public.posts WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand') INTO v_liker_username
    FROM public.profiles WHERE id = NEW.user_id;

  PERFORM send_push_to_user(
    p_user_id := v_post_author_id,
    p_title   := '❤️ Neues Like',
    p_body    := '@' || v_liker_username || ' hat „' || v_post_caption || '" geliked',
    p_data    := json_build_object('type', 'like', 'postId', NEW.post_id)::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_author_id UUID;
  v_commenter_name TEXT;
  v_comment_preview TEXT;
BEGIN
  SELECT author_id INTO v_post_author_id
    FROM public.posts WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand') INTO v_commenter_name
    FROM public.profiles WHERE id = NEW.user_id;

  v_comment_preview := COALESCE(SUBSTRING(NEW.text, 1, 50), '...');

  PERFORM send_push_to_user(
    p_user_id := v_post_author_id,
    p_title   := '💬 Neuer Kommentar',
    p_body    := '@' || v_commenter_name || ': ' || v_comment_preview,
    p_data    := json_build_object('type', 'comment', 'postId', NEW.post_id)::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_follower_name TEXT;
BEGIN
  SELECT COALESCE(username, 'Jemand') INTO v_follower_name
    FROM public.profiles WHERE id = NEW.follower_id;

  PERFORM send_push_to_user(
    p_user_id := NEW.following_id,
    p_title   := '👤 Neuer Follower',
    p_body    := '@' || v_follower_name || ' folgt dir jetzt',
    p_data    := json_build_object('type', 'follow', 'userId', NEW.follower_id)::jsonb
  );

  RETURN NEW;
END;
$$;
