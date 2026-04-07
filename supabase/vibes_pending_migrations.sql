-- ── Comment Replies (Threaded Comments) ──────────────────────────────────────
-- Adds parent_id to comments table to support one level of threading.
-- Only one level deep (replies to replies are shown flat under the parent).

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Index for fast reply lookups
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);

-- View: comments with reply count (helper for UI)
-- Not strictly needed but useful
COMMENT ON COLUMN public.comments.parent_id IS 'If set, this comment is a reply to the comment with this id. Max one level deep.';
-- ── Fix: is_guild_post war fälschlicherweise TRUE für Posts von Guild-Mitgliedern ───
-- Das führte dazu, dass diese Posts NICHT im Vibe-Feed erschienen.
-- Der Guild-Feed filtert nach author guild_id, NICHT nach is_guild_post.
-- Daher: Alle Posts auf is_guild_post = false setzen damit sie im Vibe-Feed erscheinen.

UPDATE public.posts
SET is_guild_post = false
WHERE is_guild_post = true;

-- Verification
SELECT 
  COUNT(*) FILTER (WHERE is_guild_post IS NOT TRUE) AS "Im Vibe-Feed sichtbar",
  COUNT(*) FILTER (WHERE is_guild_post IS TRUE)     AS "Noch ausgeblendet (sollte 0 sein)"
FROM public.posts;
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
-- ────────────────────────────────────────────────────────────────────────────
-- Migration: pinned_posts
-- Führe aus in: Supabase Dashboard → SQL Editor
-- ────────────────────────────────────────────────────────────────────────────

-- 1. is_pinned Spalte zu posts hinzufügen
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- 2. Index für schnelle Profil-Abfrage (pinned zuerst)
CREATE INDEX IF NOT EXISTS posts_author_pinned_idx
  ON public.posts(author_id, is_pinned DESC, created_at DESC);

-- 3. Funktion: setzt is_pinned für einen Post, entfernt Pin von allen anderen
--    des gleichen Autors (max 1 pinned Post pro User)
CREATE OR REPLACE FUNCTION public.toggle_pin_post(p_post_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_currently_pinned boolean;
BEGIN
  -- Aktuellen Status ermitteln
  SELECT is_pinned INTO v_currently_pinned
  FROM public.posts
  WHERE id = p_post_id AND author_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post nicht gefunden oder kein Zugriff';
  END IF;

  -- Alle Pins dieses Users entfernen
  UPDATE public.posts
  SET is_pinned = false
  WHERE author_id = p_user_id AND is_pinned = true;

  -- Wenn vorher nicht gepinnt → jetzt pinnen
  IF NOT v_currently_pinned THEN
    UPDATE public.posts
    SET is_pinned = true
    WHERE id = p_post_id AND author_id = p_user_id;
  END IF;
END;
$$;
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
DROP POLICY IF EXISTS "follow_requests_select" ON public.follow_requests;
CREATE POLICY "follow_requests_select"
  ON public.follow_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Nur eigene Requests senden (nicht doppelt – unique constraint greift)
DROP POLICY IF EXISTS "follow_requests_insert" ON public.follow_requests;
CREATE POLICY "follow_requests_insert"
  ON public.follow_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND sender_id != receiver_id);

-- Empfänger oder Absender können Request löschen (ablehnen / zurückziehen)
DROP POLICY IF EXISTS "follow_requests_delete" ON public.follow_requests;
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
-- Story Comments: öffentliche Kommentare auf Stories
-- Ermöglicht das einzigartige DM + Öffentlich Toggle-System

CREATE TABLE IF NOT EXISTS public.story_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    UUID        NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  is_emoji    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Index
CREATE INDEX IF NOT EXISTS story_comments_story_id_idx ON public.story_comments(story_id, created_at DESC);

-- RLS aktivieren
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

-- Jeder kann öffentliche Kommentare lesen
DROP POLICY IF EXISTS "story_comments_read" ON public.story_comments;
CREATE POLICY "story_comments_read" ON public.story_comments
  FOR SELECT USING (true);

-- Nur authentifizierte User können kommentieren
DROP POLICY IF EXISTS "story_comments_insert" ON public.story_comments;
CREATE POLICY "story_comments_insert" ON public.story_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Nur der Autor kann seinen Kommentar löschen
DROP POLICY IF EXISTS "story_comments_delete" ON public.story_comments;
CREATE POLICY "story_comments_delete" ON public.story_comments
  FOR DELETE USING (auth.uid() = author_id);

-- Realtime aktivieren für Live-Updates (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'story_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_comments;
  END IF;
END $$;
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: story_interactives
-- Füge Poll-Support zu Stories hinzu
-- Führe aus in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. interactive JSON-Feld zu stories hinzufügen
--    Beispiel: {"type":"poll","question":"Was denkst du?","options":["Ja","Nein"]}
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS interactive jsonb;

-- 2. story_votes Tabelle (1 Vote pro User pro Story)
CREATE TABLE IF NOT EXISTS public.story_votes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  option_idx integer NOT NULL, -- 0 oder 1 (Index der gewählten Option)
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(story_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS story_votes_story_idx ON public.story_votes(story_id);

-- RLS
ALTER TABLE public.story_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_votes_select" ON public.story_votes;
CREATE POLICY "story_votes_select"
  ON public.story_votes FOR SELECT USING (true); -- Ergebnisse öffentlich lesbar

DROP POLICY IF EXISTS "story_votes_insert" ON public.story_votes;
CREATE POLICY "story_votes_insert"
  ON public.story_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "story_votes_delete" ON public.story_votes;
CREATE POLICY "story_votes_delete"
  ON public.story_votes FOR DELETE
  USING (auth.uid() = user_id);
-- Story-Antwort als DM: Story-Thumbnail im Chat anzeigen
-- Fügt story_media_url zur messages-Tabelle hinzu

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS story_media_url TEXT DEFAULT NULL;
-- ────────────────────────────────────────────────────────────────────────────
-- Migration: comment_likes
-- Führe aus in: Supabase Dashboard → SQL Editor
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS comment_likes_comment_idx ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_idx    ON public.comment_likes(user_id);

-- RLS
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_likes_select" ON public.comment_likes;
CREATE POLICY "comment_likes_select"
  ON public.comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "comment_likes_insert" ON public.comment_likes;
CREATE POLICY "comment_likes_insert"
  ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_likes_delete" ON public.comment_likes;
CREATE POLICY "comment_likes_delete"
  ON public.comment_likes FOR DELETE
  USING (auth.uid() = user_id);
-- Live Replay: replay_url + is_replayable Spalten
-- Migration: 20260403_live_replay

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS replay_url      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_replayable   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replay_views    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thumbnail_url   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS category        TEXT    DEFAULT 'talk',
  ADD COLUMN IF NOT EXISTS peak_viewers    INTEGER NOT NULL DEFAULT 0;

-- Replay-URL setzen darf nur der Host selbst (host_id)
DROP POLICY IF EXISTS "Host kann replay_url setzen" ON public.live_sessions;
CREATE POLICY "Host kann replay_url setzen"
  ON public.live_sessions
  FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());
-- Post Settings: Privacy, Allow Comments/Download/Duet, Cover Time
-- Migration: 20260403_post_settings

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS privacy        TEXT    NOT NULL DEFAULT 'public'
    CHECK (privacy IN ('public', 'friends', 'private')),
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_download BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_duet     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cover_time_ms  INTEGER DEFAULT 0;

-- thumbnail_url war schon vorhanden via vorherige Migrations, guard:
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;
