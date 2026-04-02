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
CREATE POLICY "story_comments_read" ON public.story_comments
  FOR SELECT USING (true);

-- Nur authentifizierte User können kommentieren
CREATE POLICY "story_comments_insert" ON public.story_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Nur der Autor kann seinen Kommentar löschen
CREATE POLICY "story_comments_delete" ON public.story_comments
  FOR DELETE USING (auth.uid() = author_id);

-- Realtime aktivieren für Live-Updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_comments;
