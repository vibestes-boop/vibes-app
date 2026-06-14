-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Algorithm Fixes (alle 4 Bugs auf einmal)
-- Im Supabase SQL Editor ausführen
-- ══════════════════════════════════════════════════════════════════════════════


-- ── FIX 1: Dwell Time — Score-Cap auf 1.0, Normalisierung korrigiert ─────────
-- Bug: EMA konvergierte gegen 3.0 (60s/20s), zerstörte Feed-Formel
-- Fix: Normalisierung auf 60s + LEAST(..., 1.0) Hard-Cap

CREATE OR REPLACE FUNCTION update_dwell_time(post_id UUID, dwell_ms INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET dwell_time_score = LEAST(
    dwell_time_score * 0.85 + (LEAST(dwell_ms, 60000)::FLOAT / 60000.0) * 0.15,
    1.0  -- Absoluter Cap: Score kann niemals > 1.0 werden
  )
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── FIX 2: Vibe Feed — Cold Start + Freshness ─────────────────────────────────
-- Bug 1: Neue Posts (dwell=0) hatten max 0.5 Score → kamen nie in den Feed
-- Bug 2: Alte Posts mit hohem Score dominierten ewig (kein Decay)
-- Fix: Freshness-Bonus (+0.15 für Posts < 48h, linear abnehmend auf 0)
--      Gewichte: Dwell 45% | Explore 25% | Brain 25% | Freshness 15% (max)

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
  SELECT
    p.id,
    p.author_id,
    p.caption,
    p.media_url,
    p.media_type,
    LEAST(p.dwell_time_score, 1.0),   -- Cap auch beim Lesen
    p.score_explore,
    p.score_brain,
    p.tags,
    p.guild_id,
    p.is_guild_post,
    p.created_at,
    pr.username,
    pr.avatar_url,
    -- ── Algorithmus v2 ────────────────────────────────────────────────────
    -- Dwell     45%  (gekappt auf 1.0)
    -- Explore   25%  (Slider-Match)
    -- Brain     25%  (Slider-Match)
    -- Freshness 15%  (neu erschaffene Posts bekommen Boost, linear decay über 48h)
    (
      LEAST(p.dwell_time_score, 1.0) * 0.45
      + (1.0 - ABS(p.score_explore - explore_weight)) * 0.25
      + (1.0 - ABS(p.score_brain   - brain_weight))   * 0.25
      + GREATEST(
          0.0,
          0.15 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (48.0 * 3600.0) * 0.15
        )
    ) AS final_score
  FROM public.posts p
  LEFT JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.is_guild_post = FALSE
  ORDER BY final_score DESC, p.created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── FIX 3: Guild Leaderboard — avg_seconds korrigiert + UUID-Cast ────────────
-- Bug 1: avg_seconds = score * 30, korrekt wäre score * 60 (da cap jetzt 60s)
-- Bug 2: p_guild_id TEXT → UUID-Cast fehlte (implizit, aber unsicher)

CREATE OR REPLACE FUNCTION get_guild_leaderboard(p_guild_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_top_posts   JSONB;
  v_top_members JSONB;
BEGIN

  SELECT jsonb_agg(row_to_json(t)) INTO v_top_posts
  FROM (
    SELECT
      p.id,
      p.caption,
      p.media_url,
      p.media_type,
      LEAST(COALESCE(p.dwell_time_score, 0), 1.0)                        AS dwell_time_score,
      -- avg_seconds: Score * 60s (neues Max nach Fix 1)
      ROUND((LEAST(COALESCE(p.dwell_time_score, 0), 1.0) * 60)::NUMERIC, 1) AS avg_seconds,
      -- completion_pct: 0–100%, gekappt
      ROUND((LEAST(COALESCE(p.dwell_time_score, 0), 1.0) * 100)::NUMERIC, 0) AS completion_pct,
      p.created_at,
      pr.id         AS author_id,
      pr.username   AS author_username,
      pr.avatar_url AS author_avatar
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    WHERE pr.guild_id = p_guild_id::UUID     -- Expliziter Cast
      AND p.created_at > NOW() - INTERVAL '7 days'
    ORDER BY p.dwell_time_score DESC NULLS LAST, p.created_at DESC
    LIMIT 10
  ) t;

  SELECT jsonb_agg(row_to_json(t)) INTO v_top_members
  FROM (
    SELECT
      pr.id,
      pr.username,
      pr.avatar_url,
      COUNT(p.id)                                                                AS post_count,
      ROUND(AVG(LEAST(COALESCE(p.dwell_time_score, 0), 1.0))::NUMERIC, 3)      AS avg_dwell_score,
      ROUND((AVG(LEAST(COALESCE(p.dwell_time_score, 0), 1.0)) * 100)::NUMERIC, 0) AS avg_completion_pct,
      MAX(LEAST(COALESCE(p.dwell_time_score, 0), 1.0))                          AS best_score
    FROM public.profiles pr
    JOIN public.posts p ON p.author_id = pr.id
    WHERE pr.guild_id = p_guild_id::UUID     -- Expliziter Cast
      AND p.created_at > NOW() - INTERVAL '7 days'
    GROUP BY pr.id, pr.username, pr.avatar_url
    HAVING COUNT(p.id) > 0
    ORDER BY avg_dwell_score DESC NULLS LAST
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'top_posts',   COALESCE(v_top_posts,   '[]'::JSONB),
    'top_members', COALESCE(v_top_members, '[]'::JSONB)
  );
END;
$$;


-- ── FIX 4: Bestehende Scores die > 1.0 sind normalisieren ────────────────────
-- Falls in der Vergangenheit Scores > 1.0 geschrieben wurden → auf 1.0 kappen

UPDATE public.posts
SET dwell_time_score = LEAST(dwell_time_score, 1.0)
WHERE dwell_time_score > 1.0;


-- ── Verifikation ──────────────────────────────────────────────────────────────
-- Nach dem Ausführen: Status-Check

SELECT
  COUNT(*)                                          AS total_posts,
  COUNT(*) FILTER (WHERE dwell_time_score = 0)      AS cold_start_posts,
  COUNT(*) FILTER (WHERE dwell_time_score > 0
                     AND dwell_time_score < 0.3)    AS low_score,
  COUNT(*) FILTER (WHERE dwell_time_score >= 0.3
                     AND dwell_time_score < 0.7)    AS mid_score,
  COUNT(*) FILTER (WHERE dwell_time_score >= 0.7)   AS high_score,
  MAX(dwell_time_score)                             AS max_score,  -- Sollte ≤ 1.0 sein
  ROUND(AVG(dwell_time_score)::NUMERIC, 3)          AS avg_score,
  COUNT(*) FILTER (
    WHERE created_at > NOW() - INTERVAL '48 hours'
  )                                                 AS fresh_posts_last_48h
FROM public.posts;
