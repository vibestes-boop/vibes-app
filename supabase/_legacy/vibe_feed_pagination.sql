-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — get_vibe_feed: filter_tag + result_offset ergänzt
-- Ausführen im Supabase SQL Editor (ersetzt die bisherige Version aus algorithm_final.sql)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Was neu ist:
--   filter_tag    TEXT    → filtert nach Tag (z.B. 'Musik'), NULL = alle Tags
--   result_offset INT     → Offset für Paginierung (Seite 2 = Offset 15, etc.)
--
-- Damit funktioniert:
--   1) Der Kategorie-Filter im Feed (war vorher immer im Fallback gelandet)
--   2) Infinite Scroll (jede Seite ruft RPC mit höherem Offset auf)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_vibe_feed(
  explore_weight FLOAT   DEFAULT 0.5,
  brain_weight   FLOAT   DEFAULT 0.5,
  result_limit   INT     DEFAULT 15,
  result_offset  INT     DEFAULT 0,
  filter_tag     TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  author_id        UUID,
  caption          TEXT,
  media_url        TEXT,
  media_type       TEXT,
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
BEGIN
  RETURN QUERY
  WITH
  scored AS (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      LEAST(p.dwell_time_score, 1.0)  AS dwell_capped,
      p.score_explore,
      p.score_brain,
      p.tags,
      p.guild_id,
      p.is_guild_post,
      p.created_at,
      pr.username,
      pr.avatar_url,
      -- ── Algorithmus v3 FINAL ─────────────────────────────────────────────
      -- Dwell     45%  → dominantes Signal (EMA)
      -- Explore   25%  → Slider-Match
      -- Brain     25%  → Slider-Match
      -- Freshness 15%  → linearer Decay über 48h (Cold-Start-Lösung)
      (
        LEAST(p.dwell_time_score, 1.0) * 0.45
        + (1.0 - ABS(p.score_explore - explore_weight)) * 0.25
        + (1.0 - ABS(p.score_brain   - brain_weight))   * 0.25
        + GREATEST(
            0.0,
            0.15 - EXTRACT(EPOCH FROM (NOW() - p.created_at))
                   / (48.0 * 3600.0) * 0.15
          )
      ) AS final_score
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    WHERE
      p.is_guild_post IS NOT TRUE
      -- Tag-Filter: wenn filter_tag gesetzt ist, nur Posts mit diesem Tag
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
  ),

  ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY author_id
        ORDER BY final_score DESC, created_at DESC
      ) AS author_rank
    FROM scored
  )

  SELECT
    id, author_id, caption, media_url, media_type,
    dwell_capped, score_explore, score_brain,
    tags, guild_id, is_guild_post, created_at,
    username, avatar_url, final_score
  FROM ranked
  WHERE author_rank <= 2
  ORDER BY final_score DESC, created_at DESC
  LIMIT  result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schnell-Test: Liefert die ersten 15 Posts des personalisierten Feeds
-- SELECT id, username, ROUND(final_score::NUMERIC, 3) AS score
-- FROM get_vibe_feed(0.5, 0.5, 15, 0, NULL)
-- ORDER BY score DESC;
