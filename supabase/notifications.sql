-- ── Notifications Tabelle ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow')),
  post_id      UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_text TEXT,
  read         BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Neueste zuerst, Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS notifications_recipient_idx
  ON public.notifications (recipient_id, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "notif_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

CREATE POLICY "notif_insert" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ── Trigger-Funktion: Like → Notification ─────────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_like_to_table()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  -- Nicht sich selbst benachrichtigen
  IF post_author IS NOT NULL AND post_author <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, post_id)
    VALUES (post_author, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ── Trigger-Funktion: Kommentar → Notification ────────────────────────────
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

-- ── Trigger-Funktion: Follow → Notification ───────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_follow_to_table()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.following_id <> NEW.follower_id THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END;
$$;

-- ── Trigger registrieren ──────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='likes') THEN
    DROP TRIGGER IF EXISTS on_like_notif ON public.likes;
    CREATE TRIGGER on_like_notif
      AFTER INSERT ON public.likes
      FOR EACH ROW EXECUTE FUNCTION notify_on_like_to_table();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='comments') THEN
    DROP TRIGGER IF EXISTS on_comment_notif ON public.comments;
    CREATE TRIGGER on_comment_notif
      AFTER INSERT ON public.comments
      FOR EACH ROW EXECUTE FUNCTION notify_on_comment_to_table();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='follows') THEN
    DROP TRIGGER IF EXISTS on_follow_notif ON public.follows;
    CREATE TRIGGER on_follow_notif
      AFTER INSERT ON public.follows
      FOR EACH ROW EXECUTE FUNCTION notify_on_follow_to_table();
  END IF;
END $$;
