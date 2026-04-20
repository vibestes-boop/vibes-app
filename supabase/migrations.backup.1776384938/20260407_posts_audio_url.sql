-- Audio URL Spalte für Posts
-- Führe dies im Supabase SQL Editor aus
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Optional: Index für Audio-Posts (für "Discover by Sound" Feature)
CREATE INDEX IF NOT EXISTS idx_posts_audio_url ON public.posts(audio_url) WHERE audio_url IS NOT NULL;

DO $$ BEGIN RAISE NOTICE '✅ audio_url Spalte zu posts hinzugefügt'; END $$;
