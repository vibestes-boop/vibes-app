-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Performance Fix Migration
-- Datum: 2026-04-05
-- Fixes:
--   1. update_dwell_time: Fehlendes GRANT (400-Fehler wenn anon/authenticated fehlt)
--   2. record_skip: Fehlendes GRANT
--   3. reposts: Fehlender Index für Batch-Query in useFeedEngagement
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Fix 1: update_dwell_time — GRANT für authenticated user ────────────────
-- Fehler 400 tritt auf wenn die Funktion existiert aber kein EXECUTE-Recht hat.
GRANT EXECUTE ON FUNCTION public.update_dwell_time(UUID, INTEGER) TO authenticated;

-- ─── Fix 2: record_skip — GRANT für authenticated user ──────────────────────
GRANT EXECUTE ON FUNCTION public.record_skip(UUID) TO authenticated;

-- ─── Fix 3: reposts Index für Batch-Query ───────────────────────────────────
-- useFeedEngagement macht: SELECT post_id FROM reposts WHERE user_id = X AND post_id IN (...)
-- Ohne Index: Seq-Scan über alle Reposts des Users
CREATE INDEX IF NOT EXISTS idx_reposts_user_post
  ON public.reposts (user_id, post_id);

-- ─── Fix 4: bookmarks Index für Batch-Query ─────────────────────────────────
-- useFeedEngagement macht: SELECT post_id FROM bookmarks WHERE user_id = X AND post_id IN (...)
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_post
  ON public.bookmarks (user_id, post_id);

-- ─── Fix 5: likes Index für Batch-Query ─────────────────────────────────────
-- useFeedEngagement macht: SELECT post_id FROM likes WHERE user_id = X AND post_id IN (...)
CREATE INDEX IF NOT EXISTS idx_likes_user_post
  ON public.likes (user_id, post_id);

-- ─── Verifikation ────────────────────────────────────────────────────────────
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_dwell_time', 'record_skip', 'get_post_comment_counts', 'get_post_like_counts')
ORDER BY routine_name;

SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('reposts', 'bookmarks', 'likes')
  AND indexname IN ('idx_reposts_user_post', 'idx_bookmarks_user_post', 'idx_likes_user_post');
