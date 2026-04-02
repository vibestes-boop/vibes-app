-- ═══════════════════════════════════════════════════════════════════════════
-- VIBES — Highlight-System Complete Migration
-- Ausführen in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) story_highlights: neue Spalten ────────────────────────────────────────
--    media_url  → URL direkt im Highlight gespeichert (überlebt Story-Ablauf)
--    media_type → 'image' | 'video'
--    post_id    → für Post-Highlights (nullable)
--    story_id   → nullable machen (Post-Highlights haben keine story_id)

ALTER TABLE public.story_highlights
  ADD COLUMN IF NOT EXISTS media_url  text,
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS post_id    uuid REFERENCES public.posts(id) ON DELETE SET NULL;

-- story_id nullable machen (wurde vorher NOT NULL erzwungen)
ALTER TABLE public.story_highlights
  ALTER COLUMN story_id DROP NOT NULL;

-- ── 2) stories: archived-Flag ─────────────────────────────────────────────────
--    archived = true  → Story ist abgelaufen, war aber aktiv
--    archived = false → Aktiv oder noch nicht relevant

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- ── 3) Indizes für Performance ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stories_user_archived
  ON public.stories(user_id, archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_story_highlights_story_id
  ON public.story_highlights(story_id);

CREATE INDEX IF NOT EXISTS idx_story_highlights_post_id
  ON public.story_highlights(post_id);

-- ── 4) archive_expired_stories() Funktion ────────────────────────────────────
--    Markiert Stories die älter als 24h als archiviert.
--    LÖSCHT KEINE R2-Dateien — nur das archived-Flag wird gesetzt.

CREATE OR REPLACE FUNCTION public.archive_expired_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.stories
  SET archived = true
  WHERE archived = false
    AND created_at < now() - interval '24 hours';
END;
$$;

-- ── 5) Cron-Job (Supabase Pro — pg_cron) ─────────────────────────────────────
--    Stündlich ausführen: Stories nach 24h archivieren

SELECT cron.schedule(
  'archive-expired-stories',     -- Job-Name (eindeutig)
  '0 * * * *',                   -- Jede Stunde zur vollen Stunde
  'SELECT public.archive_expired_stories()'
);

-- ── 6) RLS Policy für archived Stories ───────────────────────────────────────
--    User kann eigene archivierte Stories lesen (für Highlight-Picker)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stories'
      AND policyname = 'stories_own_archived_select'
  ) THEN
    CREATE POLICY "stories_own_archived_select"
      ON public.stories FOR SELECT
      USING (auth.uid() = user_id OR archived = false);
  END IF;
END;
$$;

-- ── Fertig ────────────────────────────────────────────────────────────────────
-- Prüfen ob alles geklappt hat:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'story_highlights'
  AND column_name IN ('media_url', 'media_type', 'post_id', 'story_id')
ORDER BY column_name;
