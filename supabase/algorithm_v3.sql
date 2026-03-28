-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Algorithm v3 (Finale Produktionsversion)
-- Fixes: α 0.15→0.25 (schnellere EMA) + Autor-Diversity (max 2 Posts/Autor)
-- Im Supabase SQL Editor ausführen
-- ══════════════════════════════════════════════════════════════════════════════


-- ── FIX A: Dwell-Time EMA — α von 0.15 auf 0.25 ──────────────────────────────
-- Vorher: Nach 20 Views konvergiert Score auf ~0.5 (zu langsam)
-- Jetzt:  Nach 10 Views bereits ~0.5 — doppelt so responsiv
-- α=0.25 bedeutet: jeder neue View hat 25% Einfluss auf den Score

CREATE OR REPLACE FUNCTION update_dwell_time(post_id UUID, dwell_ms INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET dwell_time_score = LEAST(
    -- α=0.25: Score reagiert schnell, glättet aber trotzdem Ausreißer
    dwell_time_score * 0.75 + (LEAST(dwell_ms, 60000)::FLOAT / 60000.0) * 0.25,
    1.0  -- Hard-Cap: niemals > 1.0
  )
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── FIX B: Feed-Algorithmus — Autor-Diversity + schnellere EMA ───────────────
-- Vorher: Bis zu 20 Posts des gleichen Autors konnten den Feed dominieren
-- Jetzt:  Max. 2 Posts pro Autor in den Top-20 (wie Instagram/TikTok)
-- Technik: CTE + ROW_NUMBER() OVER PARTITION BY author_id

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
  -- Schritt 1: Alle Posts mit Score berechnen
  scored AS (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      LEAST(p.dwell_time_score, 1.0)        AS dwell_capped,
      p.score_explore,
      p.score_brain,
      p.tags,
      p.guild_id,
      p.is_guild_post,
      p.created_at,
      pr.username,
      pr.avatar_url,
      -- ── Algorithmus v3 ──────────────────────────────────────────────────
      -- Dwell     45%  (dominantes Signal, fair durch EMA)
      -- Explore   25%  (Slider-Match, jetzt spürbar durch vibe_scores.sql)
      -- Brain     25%  (Slider-Match)
      -- Freshness 15%  (linearer Decay über 48h → löst Cold-Start)
      -- SUMME MAX: 1.10 (frischer, perfekt gematchter Post mit vollem Dwell)
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
    WHERE p.is_guild_post = FALSE
  ),

  -- Schritt 2: Rang pro Autor berechnen
  ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY author_id
        ORDER BY final_score DESC, created_at DESC
      ) AS author_rank
    FROM scored
  )

  -- Schritt 3: Max. 2 Posts pro Autor zulassen → Diversity
  SELECT
    id,
    author_id,
    caption,
    media_url,
    media_type,
    dwell_capped,
    score_explore,
    score_brain,
    tags,
    guild_id,
    is_guild_post,
    created_at,
    username,
    avatar_url,
    final_score
  FROM ranked
  WHERE author_rank <= 2          -- ← Diversity-Guard
  ORDER BY final_score DESC, created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Simulation: Wie sehen die Scores jetzt aus? ───────────────────────────────
-- Zeigt was get_vibe_feed bei Default-Slider zurückgibt

SELECT
  p.id,
  LEFT(p.caption, 40) || '…'                                   AS caption,
  p.tags[1]                                                     AS main_tag,
  ROUND(LEAST(p.dwell_time_score, 1.0)::NUMERIC, 3)            AS dwell,
  ROUND(p.score_brain::NUMERIC, 2)                              AS brain,
  ROUND(p.score_explore::NUMERIC, 2)                            AS explore,
  ROUND((
    LEAST(p.dwell_time_score, 1.0) * 0.45
    + (1.0 - ABS(p.score_explore - 0.5)) * 0.25
    + (1.0 - ABS(p.score_brain   - 0.5)) * 0.25
    + GREATEST(0.0, 0.15 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (48.0 * 3600.0) * 0.15)
  )::NUMERIC, 4)                                                AS final_score,
  ROUND(GREATEST(0.0, 0.15 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (48.0 * 3600.0) * 0.15)::NUMERIC, 3) AS freshness_bonus,
  EXTRACT(HOUR FROM NOW() - p.created_at)::INT                 AS age_hours,
  pr.username                                                   AS author
FROM public.posts p
LEFT JOIN public.profiles pr ON pr.id = p.author_id
WHERE p.is_guild_post = FALSE
ORDER BY final_score DESC
LIMIT 20;
