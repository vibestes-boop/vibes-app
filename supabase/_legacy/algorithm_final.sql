-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Algorithm Final (3 letzte Korrekturen)
-- Nach vollständiger Code-Analyse gefunden
-- Im Supabase SQL Editor ausführen
-- ══════════════════════════════════════════════════════════════════════════════


-- ── FIX 1: Negativer dwell_ms Guard ──────────────────────────────────────────
-- Bug: Wenn dwell_ms < 0 (theoretisch durch Clock-Drift), sinkt der Score
-- Fix: GREATEST(dwell_ms, 0) vor der Division

CREATE OR REPLACE FUNCTION update_dwell_time(post_id UUID, dwell_ms INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET dwell_time_score = LEAST(
    dwell_time_score * 0.75
      + (LEAST(GREATEST(dwell_ms, 0), 60000)::FLOAT / 60000.0) * 0.25,
    1.0
  )
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── FIX 2: is_guild_post NULL-Handling ───────────────────────────────────────
-- Bug: WHERE is_guild_post = FALSE schließt NULL-Werte aus (NULL = FALSE → NULL)
-- Fix: IS NOT TRUE behandelt sowohl FALSE als auch NULL korrekt

CREATE OR REPLACE FUNCTION get_vibe_feed(
  explore_weight FLOAT DEFAULT 0.5,
  brain_weight   FLOAT DEFAULT 0.5,
  result_limit   INT   DEFAULT 20
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
      -- ── Algorithmus v3 FINAL ────────────────────────────────────────────
      -- Dwell     45%  → dominantes Signal, durch EMA fair gemittelt
      -- Explore   25%  → Slider-Match (spürbar bei Extrempositionen)
      -- Brain     25%  → Slider-Match
      -- Freshness 15%  → linearer Decay über 48h, löst Cold-Start
      -- MAX SCORE: 1.10 (intern für Ranking, kein User sieht diesen Wert)
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
    WHERE p.is_guild_post IS NOT TRUE   -- FIX: war "= FALSE", schloss NULLs aus
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
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Abschluss-Verifikation ────────────────────────────────────────────────────
-- Vollständiger Zustandsbericht des Algorithmus

SELECT
  '=== ALGORITHMUS STATUS ===' AS info,
  '' AS value
UNION ALL
SELECT 'Total Posts',          COUNT(*)::TEXT FROM public.posts
UNION ALL
SELECT 'Im globalen Feed',     COUNT(*)::TEXT FROM public.posts WHERE is_guild_post IS NOT TRUE
UNION ALL
SELECT 'Guild-Only Posts',     COUNT(*)::TEXT FROM public.posts WHERE is_guild_post IS TRUE
UNION ALL
SELECT 'Posts ohne Tags',      COUNT(*)::TEXT FROM public.posts WHERE tags IS NULL OR array_length(tags, 1) IS NULL
UNION ALL
SELECT 'Score = 0 (cold)',     COUNT(*)::TEXT FROM public.posts WHERE dwell_time_score = 0
UNION ALL
SELECT 'Score > 0 (aktiv)',    COUNT(*)::TEXT FROM public.posts WHERE dwell_time_score > 0
UNION ALL
SELECT 'Max Score (cap=1.0)',  ROUND(MAX(dwell_time_score)::NUMERIC, 4)::TEXT FROM public.posts
UNION ALL
SELECT 'Ø Score alle Posts',   ROUND(AVG(dwell_time_score)::NUMERIC, 4)::TEXT FROM public.posts
UNION ALL
SELECT 'Frisch < 48h',         COUNT(*)::TEXT FROM public.posts WHERE created_at > NOW() - INTERVAL '48 hours';
