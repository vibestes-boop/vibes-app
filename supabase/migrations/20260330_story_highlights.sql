-- ──────────────────────────────────────────────────────────────────────────
-- Migration: story_highlights
-- Erstellt die Tabelle für dauerhaft gespeicherte Story-Highlights
-- Führe aus in: Supabase Dashboard → SQL Editor
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.story_highlights (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id    uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Highlight',
  created_at  timestamptz DEFAULT now() NOT NULL,

  -- Kein doppeltes Highlight für dieselbe Story
  UNIQUE (user_id, story_id)
);

-- Index für schnelles Laden des Profils
CREATE INDEX IF NOT EXISTS story_highlights_user_id_idx ON public.story_highlights (user_id);

-- Row Level Security
ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;

-- Jeder kann Highlights lesen (Profil-Ansicht)
DROP POLICY IF EXISTS "story_highlights_select" ON public.story_highlights;
CREATE POLICY "story_highlights_select"
  ON public.story_highlights FOR SELECT
  USING (true);

-- Nur eigene Highlights anlegen
DROP POLICY IF EXISTS "story_highlights_insert" ON public.story_highlights;
CREATE POLICY "story_highlights_insert"
  ON public.story_highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Nur eigene Highlights löschen
DROP POLICY IF EXISTS "story_highlights_delete" ON public.story_highlights;
CREATE POLICY "story_highlights_delete"
  ON public.story_highlights FOR DELETE
  USING (auth.uid() = user_id);
