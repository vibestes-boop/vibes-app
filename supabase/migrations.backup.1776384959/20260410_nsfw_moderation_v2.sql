-- ── Production-grade NSFW moderation fix v2 ───────────────────────────────
-- Löst 3 verbleibende Probleme:
-- 1. is_visible default → TRUE (optimistic posting, retroaktive Entfernung)
-- 2. get_vibe_feed RPC: nur is_visible-Filter hinzufügen — Algorithmus UNVERÄNDERT
-- 3. Bestehende Posts freischalten, besserer Index

-- ── 1. Default auf TRUE ────────────────────────────────────────────────────
ALTER TABLE posts
  ALTER COLUMN is_visible SET DEFAULT true;

-- ── 2. Bestehende Posts freischalten ──────────────────────────────────────
UPDATE posts
  SET is_visible = true
  WHERE is_visible = false
    AND is_flagged = false;

-- ── 3. Optimierter Partial Index ──────────────────────────────────────────
DROP INDEX IF EXISTS posts_is_visible_created_idx;
CREATE INDEX IF NOT EXISTS posts_feed_idx
  ON posts (created_at DESC, is_guild_post, privacy)
  WHERE is_visible = true AND is_flagged = false;

-- ── 4. get_vibe_feed: is_visible + is_flagged Filter HINZUFÜGEN ───────────
-- ⚠️ WICHTIG: Algorithmus (Dwell 45%, Explore 25%, Brain 25%, Freshness 15%)
-- und author_rank Deduplication sind 100% unverändert aus der ursprünglichen
-- Migration 20260405040000_thumbnail_url_in_feed.sql
-- Einzige Änderung: AND p.is_visible = TRUE AND p.is_flagged = FALSE im WHERE
CREATE OR REPLACE FUNCTION get_vibe_feed(
  explore_weight FLOAT    DEFAULT 0.5,
  brain_weight   FLOAT    DEFAULT 0.5,
  result_limit   INT      DEFAULT 20,
  filter_tag     TEXT     DEFAULT NULL,
  include_seen   BOOLEAN  DEFAULT FALSE,
  exclude_ids    UUID[]   DEFAULT '{}'
)
RETURNS TABLE (
  id               UUID,
  author_id        UUID,
  caption          TEXT,
  media_url        TEXT,
  media_type       TEXT,
  thumbnail_url    TEXT,
  dwell_time_score FLOAT,
  score_explore    FLOAT,
  score_brain      FLOAT,
  tags             TEXT[],
  guild_id         UUID,
  is_guild_post    BOOLEAN,
  created_at       TIMESTAMPTZ,
  username         TEXT,
  avatar_url       TEXT,
  final_score      FLOAT
) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  RETURN QUERY
  WITH
  seen_ids AS (
    SELECT post_id
    FROM public.seen_posts
    WHERE user_id = v_user_id
      AND v_user_id IS NOT NULL
  ),

  scored AS (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      p.thumbnail_url,
      LEAST(p.dwell_time_score, 1.0)  AS dwell_capped,
      p.score_explore,
      p.score_brain,
      p.tags,
      p.guild_id,
      p.is_guild_post,
      p.created_at,
      pr.username,
      pr.avatar_url,
      -- ── Algorithmus v3 FINAL (identisch zur ursprünglichen Migration) ────
      -- Dwell 45% | Explore 25% | Brain 25% | Freshness 15%
      (
        LEAST(p.dwell_time_score, 1.0) * 0.45
        + (1.0 - ABS(p.score_explore - explore_weight)) * 0.25
        + (1.0 - ABS(p.score_brain   - brain_weight))   * 0.25
        + GREATEST(
            0.0,
            0.15 - EXTRACT(EPOCH FROM (NOW() - p.created_at))
                   / (48.0 * 3600.0) * 0.15
          )
      ) AS final_score,
      (sp.post_id IS NOT NULL) AS is_seen
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    LEFT JOIN seen_ids sp ON sp.post_id = p.id
    WHERE
      p.is_guild_post IS NOT TRUE
      -- ✅ NEU: NSFW-Filter — nur moderierte, sichtbare Posts
      AND p.is_visible  = TRUE
      AND p.is_flagged  = FALSE
      -- Tag-Filter
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
      -- ID-Cursor (Pagination, kein OFFSET)
      AND (array_length(exclude_ids, 1) IS NULL OR p.id != ALL(exclude_ids))
  ),

  filtered AS (
    SELECT * FROM scored
    WHERE (include_seen = TRUE OR is_seen = FALSE)
  ),

  ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY author_id
        ORDER BY final_score DESC, created_at DESC
      ) AS author_rank
    FROM filtered
  )

  SELECT
    id, author_id, caption, media_url, media_type, thumbnail_url,
    dwell_capped AS dwell_time_score, score_explore, score_brain,
    tags, guild_id, is_guild_post, created_at,
    username, avatar_url, final_score
  FROM ranked
  WHERE author_rank <= 2
  ORDER BY final_score DESC, created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
