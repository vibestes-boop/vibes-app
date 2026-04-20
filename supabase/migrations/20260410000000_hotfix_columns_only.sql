-- ── SOFORT-FIX: Spalten hinzufügen (ohne Trigger) ──────────────────────────
-- Ausführen in: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_flagged  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason text,
  ADD COLUMN IF NOT EXISTS is_visible  boolean NOT NULL DEFAULT true;

-- Alle bestehenden Posts sofort sichtbar schalten
UPDATE posts SET is_visible = true WHERE is_visible = false;

-- Index für Feed-Performance
CREATE INDEX IF NOT EXISTS posts_feed_idx
  ON posts (created_at DESC)
  WHERE is_visible = true;
