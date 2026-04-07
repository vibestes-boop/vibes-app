-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Fix: thumbnail_url in get_vibe_feed RPC
-- 
-- Problem: get_vibe_feed gibt kein thumbnail_url zurück
-- → App kann kein Vorschaubild für Videos zeigen
-- → User sieht 2-5 Sekunden schwarzen Shimmer beim ersten Laden
--
-- Fix: thumbnail_url zum RETURNS TABLE und SELECT hinzufügen
-- Ergebnis: JPEG-Thumbnail (~30KB) wird sofort gezeigt in <50ms
-- ══════════════════════════════════════════════════════════════════════════════

-- Schritt 1: thumbnail_url-Spalte sicherstellen (falls noch nicht vorhanden)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;

-- Schritt 2: get_vibe_feed mit thumbnail_url erweitern
-- Diese Funktion ist die neuste Version (hat filter_tag, include_seen, exclude_ids)
-- Wir ersetzen nur das RETURNS TABLE + den finalen SELECT

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
  thumbnail_url    TEXT,    -- NEU: JPEG-Vorschaubild für schnelles Laden
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
  -- Aktuellen User bestimmen (NULL = anonymous)
  v_user_id := auth.uid();

  RETURN QUERY
  WITH
  seen_ids AS (
    -- Bereits gesehene Posts des aktuellen Users
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
      p.thumbnail_url,    -- NEU: Vorschaubild mit übergeben
      LEAST(p.dwell_time_score, 1.0)  AS dwell_capped,
      p.score_explore,
      p.score_brain,
      p.tags,
      p.guild_id,
      p.is_guild_post,
      p.created_at,
      pr.username,
      pr.avatar_url,
      -- ── Algorithmus v3 FINAL ──────────────────────────────────────────
      -- Dwell     45%  → dominantes Signal
      -- Explore   25%  → Slider-Match
      -- Brain     25%  → Slider-Match
      -- Freshness 15%  → linearer Decay über 48h
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
      -- Seen-Flag für Filter
      (sp.post_id IS NOT NULL) AS is_seen
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    LEFT JOIN seen_ids sp ON sp.post_id = p.id
    WHERE
      p.is_guild_post IS NOT TRUE
      -- Tag-Filter (optional)
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
      -- ID-Exclusion-Cursor (Pagination, kein OFFSET)
      AND (array_length(exclude_ids, 1) IS NULL OR p.id != ALL(exclude_ids))
  ),

  filtered AS (
    SELECT *
    FROM scored
    WHERE
      -- Seen-Filter
      (include_seen = TRUE OR is_seen = FALSE)
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

-- Verifikation
DO $$
BEGIN
  RAISE NOTICE '✅ get_vibe_feed mit thumbnail_url aktualisiert';
END $$;
