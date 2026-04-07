-- Story-Antwort als DM: Story-Thumbnail im Chat anzeigen
-- Fügt story_media_url zur messages-Tabelle hinzu

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS story_media_url TEXT DEFAULT NULL;
