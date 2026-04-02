-- ============================================================
-- Vibes App — Live Stream SQL Migration
-- Ausführen in: Supabase Dashboard → SQL Editor → New Query
-- Reihenfolge: Alles zusammen in einer Query ausführen ✅
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. live_sessions: Neue Spalten
-- ──────────────────────────────────────────────────────────────

ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS like_count     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pinned_comment JSONB   DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 2. like_count: Atomic RPC-Funktion (race-condition-safe)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_live_likes(p_session_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE live_sessions
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = p_session_id
    AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION increment_live_likes(UUID) TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- 3. comment_count: Trigger — erhöht automatisch bei neuem Kommentar
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION incr_live_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE live_sessions
  SET comment_count = COALESCE(comment_count, 0) + 1
  WHERE id = NEW.session_id
    AND status = 'active';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_comment_count ON live_comments;

CREATE TRIGGER trg_live_comment_count
  AFTER INSERT ON live_comments
  FOR EACH ROW
  EXECUTE FUNCTION incr_live_comment_count();


-- ──────────────────────────────────────────────────────────────
-- 4. live_reports: Tabelle für gemeldete Lives
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_reports (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID        NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  reporter_id UUID        NOT NULL REFERENCES profiles(id),
  reason      TEXT        NOT NULL
                          CHECK (reason IN ('inappropriate', 'spam', 'violence', 'other')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE live_reports ENABLE ROW LEVEL SECURITY;

-- Jeder eingeloggte User darf nur eigene Reports einfügen
CREATE POLICY "insert_own_live_reports"
  ON live_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Admins können alle Reports lesen (optional — für euer Dashboard)
CREATE POLICY "admin_read_live_reports"
  ON live_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());


-- ──────────────────────────────────────────────────────────────
-- Fertig ✅
-- ──────────────────────────────────────────────────────────────
