-- ─── Story-Archiv Migration ──────────────────────────────────────────────────
-- Stories bleiben nach 24h im Archiv erhalten (archived = true).
-- Highlights können jetzt auch Posts referenzieren (post_id IS NOT NULL).
-- media_url + media_type werden im Highlight selbst gespeichert →
--   überlebt Story-Löschung und funktioniert für Posts.

-- 1) archived-Flag an stories
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- 2) story_highlights erweitern: eigene media_url + media_type + optionaler post_id
ALTER TABLE story_highlights
  ADD COLUMN IF NOT EXISTS media_url  text,
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS post_id    uuid REFERENCES posts(id) ON DELETE SET NULL,
  ALTER COLUMN story_id DROP NOT NULL;  -- story_id kann null sein wenn es ein Post-Highlight ist

-- 3) Index für schnelle Archiv-Abfragen
CREATE INDEX IF NOT EXISTS idx_stories_user_archived
  ON stories(user_id, archived, created_at DESC);

-- 4) RLS: User kann eigene archivierten Stories lesen
-- (Annahme: vorhandene Policy erlaubt eigene Stories zu lesen — ggf. anpassen)

-- 5) Funktion: Stories nach 24h archivieren statt löschen (Cron alle 1h)
CREATE OR REPLACE FUNCTION archive_expired_stories()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE stories
  SET archived = true
  WHERE archived = false
    AND created_at < now() - interval '24 hours';
END;
$$;

-- Falls pg_cron verfügbar (Supabase Pro):
-- SELECT cron.schedule('archive-stories', '0 * * * *', 'SELECT archive_expired_stories()');
