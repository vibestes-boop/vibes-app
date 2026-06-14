-- ═══════════════════════════════════════════════════════════════════════════
-- VIBES — Thumbnail URL Migration
-- Ausführen in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) stories: thumbnail_url für Video-Previews
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- 2) posts: thumbnail_url für Video-Previews
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- 3) story_highlights: thumbnail_url direkt gespeichert → überlebt Story/Post-Löschung
ALTER TABLE public.story_highlights
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Prüfen:
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('stories', 'posts', 'story_highlights')
  AND column_name = 'thumbnail_url'
ORDER BY table_name;
