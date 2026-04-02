-- ═══════════════════════════════════════════════════════════════════════════
-- VIBES — Highlight Multi-Item Migration
-- Ermöglicht mehrere Stories/Posts pro Highlight (wie Instagram)
-- Ausführen in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- items: Array von Media-Objekten im Highlight
-- Jedes Item: { media_url, media_type, thumbnail_url? }
-- Das erste Item ist das Cover (identisch mit media_url/media_type in der Hauptzeile)
ALTER TABLE public.story_highlights
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Bestehende Highlights migrieren:
-- Für alte Highlights (items=[]) → items aus media_url/media_type befüllen
-- So bleiben bestehende Highlights gültig ohne Datenverlust
UPDATE public.story_highlights
SET items = jsonb_build_array(
  jsonb_build_object(
    'media_url',     media_url,
    'media_type',    media_type,
    'thumbnail_url', thumbnail_url
  )
)
WHERE items = '[]'::jsonb
  AND media_url IS NOT NULL;

-- Prüfen:
SELECT id, title, jsonb_array_length(items) AS item_count
FROM story_highlights
ORDER BY created_at DESC
LIMIT 10;
