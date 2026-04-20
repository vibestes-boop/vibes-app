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
