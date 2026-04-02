-- ============================================================
-- Live Like Count + Heat Score Algorithmus
-- In Supabase SQL Editor ausführen
-- ============================================================

-- 1. like_count Spalte zu live_sessions hinzufügen
ALTER TABLE live_sessions 
  ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- 2. RPC Funktion: Likes inkrementieren (atomic, race-condition-safe)
CREATE OR REPLACE FUNCTION increment_live_likes(p_session_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE live_sessions 
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = p_session_id AND status = 'active';
$$;

-- 3. Index für heat score Sortierung (viewer_count * 3 + like_count * 2)
-- Ermöglicht schnelles Laden der "heißesten" Lives
CREATE INDEX IF NOT EXISTS idx_live_sessions_active_heat 
  ON live_sessions(status, viewer_count DESC, like_count DESC)
  WHERE status = 'active';

-- Grant für authenticated users
GRANT EXECUTE ON FUNCTION increment_live_likes(UUID) TO authenticated;
