-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Datenbank-Indizes (Performance-Grundlage)
-- Ohne diese Indizes → Full Table Scan bei jedem Feed-Aufruf
-- Im Supabase SQL Editor ausführen (einmalig)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Index 1: GIN auf tags (für @> Operator in Tag-Filter) ─────────────────────
-- Macht "p.tags @> ARRAY['tech']" von O(n) auf O(log n)
-- Kritisch für: CategoryFilter, get_vibe_feed mit filter_tag
CREATE INDEX IF NOT EXISTS idx_posts_tags_gin
  ON public.posts USING GIN(tags);

-- ── Index 2: Partial B-Tree auf Feed-Hauptspalten ─────────────────────────────
-- Optimiert den "For You" Feed: nur non-guild Posts, sortiert nach Score
-- WHERE is_guild_post IS NOT TRUE ORDER BY dwell_time_score DESC
CREATE INDEX IF NOT EXISTS idx_posts_feed_score
  ON public.posts (dwell_time_score DESC NULLS LAST, created_at DESC)
  WHERE is_guild_post IS NOT TRUE;

-- ── Index 3: created_at für Freshness-Berechnung ─────────────────────────────
-- Macht EXTRACT(EPOCH FROM (NOW() - created_at)) effizienter
-- Auch nützlich für "letzte 48h" / "letzte 7 Tage" Queries
CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON public.posts (created_at DESC);

-- ── Index 4: author_id für JOIN + ROW_NUMBER() PARTITION ─────────────────────
-- Optimiert den Author-Diversity Guard (PARTITION BY author_id)
CREATE INDEX IF NOT EXISTS idx_posts_author_id
  ON public.posts (author_id, dwell_time_score DESC NULLS LAST);

-- ── Index 5: Guild Leaderboard (profile guild_id) ────────────────────────────
-- Optimiert get_guild_leaderboard (WHERE pr.guild_id = ...)
CREATE INDEX IF NOT EXISTS idx_profiles_guild_id
  ON public.profiles (guild_id);

-- ── Index 6: Dwell-Tracker (update WHERE id = post_id) ───────────────────────
-- posts.id ist bereits PK → kein extra Index nötig ✓

-- ── Verifikation: Alle Indizes der posts-Tabelle anzeigen ─────────────────────
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'posts'
  AND schemaname = 'public'
ORDER BY indexname;
