-- ================================================
-- VIBES APP – Stories (24h Posts)
-- Ausführen im Supabase SQL Editor
-- ================================================

-- Stories Tabelle
CREATE TABLE IF NOT EXISTS public.stories (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT NOT NULL,
  media_type  TEXT NOT NULL DEFAULT 'image',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select" ON public.stories
  FOR SELECT USING (true);

CREATE POLICY "stories_insert" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_delete" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- Story-Views (wer hat welche Story gesehen)
CREATE TABLE IF NOT EXISTS public.story_views (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (story_id, user_id)
);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_views_select" ON public.story_views
  FOR SELECT USING (true);

CREATE POLICY "story_views_insert" ON public.story_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Abgelaufene Stories automatisch löschen (optional: täglich via pg_cron)
-- Für MVP reichen wir im Query nach created_at > now() - interval '24 hours'
