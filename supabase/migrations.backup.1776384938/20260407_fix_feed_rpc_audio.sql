-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Fix: audio_url + privacy + allow_* in get_vibe_feed RPC
--
-- Problem: get_vibe_feed gibt kein audio_url, privacy, allow_comments,
--          allow_duet, allow_download, is_verified zurück
-- Fix: Alle fehlenden Felder zum RETURNS TABLE und SELECT hinzufügen
-- ══════════════════════════════════════════════════════════════════════════════

-- Sicherstellen dass Spalten vorhanden sind
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS privacy TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_download BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_duet BOOLEAN NOT NULL DEFAULT TRUE;

-- Alte Versionen entfernen
DROP FUNCTION IF EXISTS get_vibe_feed(FLOAT, FLOAT, INT, TEXT, BOOLEAN, UUID[]);
DROP FUNCTION IF EXISTS get_vibe_feed(FLOAT, FLOAT, INT);

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
  audio_url        TEXT,       -- Musik-Track URL
  dwell_time_score FLOAT,
  score_explore    FLOAT,
  score_brain      FLOAT,
  tags             TEXT[],
  guild_id         UUID,
  is_guild_post    BOOLEAN,
  created_at       TIMESTAMPTZ,
  privacy          TEXT,       -- Post-Sichtbarkeit
  allow_comments   BOOLEAN,    -- Kommentare erlaubt?
  allow_download   BOOLEAN,    -- Download erlaubt?
  allow_duet       BOOLEAN,    -- Duet erlaubt?
  username         TEXT,
  avatar_url       TEXT,
  is_verified      BOOLEAN,    -- Creator verifiziert?
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
      p.audio_url,
      LEAST(p.dwell_time_score, 1.0)  AS dwell_capped,
      p.score_explore,
      p.score_brain,
      p.tags,
      p.guild_id,
      p.is_guild_post,
      p.created_at,
      COALESCE(p.privacy, 'public')          AS privacy,
      COALESCE(p.allow_comments, TRUE)       AS allow_comments,
      COALESCE(p.allow_download, TRUE)       AS allow_download,
      COALESCE(p.allow_duet, TRUE)           AS allow_duet,
      pr.username,
      pr.avatar_url,
      COALESCE(pr.is_verified, FALSE)        AS is_verified,
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
      AND p.privacy = 'public'      -- Nur öffentliche Posts im Haupt-Feed
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
      AND (array_length(exclude_ids, 1) IS NULL OR p.id != ALL(exclude_ids))
  ),

  filtered AS (
    SELECT *
    FROM scored
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
    audio_url,
    dwell_capped AS dwell_time_score, score_explore, score_brain,
    tags, guild_id, is_guild_post, created_at,
    privacy, allow_comments, allow_download, allow_duet,
    username, avatar_url, is_verified, final_score
  FROM ranked
  WHERE author_rank <= 2
  ORDER BY final_score DESC, created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '✅ get_vibe_feed mit audio_url, privacy, allow_*, is_verified aktualisiert';
END $$;
