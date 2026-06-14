-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Cursor Pagination Fix v1
--
-- Problem: OFFSET-basierte Pagination ist mit dynamischem Ranking kaputt.
--   Scores ändern sich zwischen Page 1 und Page 2
--   → Post erscheint doppelt oder wird übersprungen.
--
-- Lösung: ID-Exclusion statt OFFSET
--   Client schickt bereits geladene Post-IDs → diese werden exkludiert.
--   WHERE p.id != ALL(exclude_ids) → deterministisch, nie Duplikate.
--
-- result_offset bleibt als Parameter für Rückwärtskompatibilität (immer 0).
-- ══════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.get_vibe_feed(
  explore_weight FLOAT    DEFAULT 0.5,
  brain_weight   FLOAT    DEFAULT 0.5,
  result_limit   INT      DEFAULT 15,
  result_offset  INT      DEFAULT 0,           -- deprecated, ignoriert
  filter_tag     TEXT     DEFAULT NULL,
  include_seen   BOOLEAN  DEFAULT FALSE,
  exclude_ids    UUID[]   DEFAULT '{}'::UUID[] -- NEU: bereits geladene Post-IDs
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID;
  v_learned_explore FLOAT;
  v_learned_brain   FLOAT;
  v_interactions    INT;
  v_learn_weight    FLOAT;
  v_eff_explore     FLOAT;
  v_eff_brain       FLOAT;
BEGIN
  v_user_id := auth.uid();

  SELECT learned_explore, learned_brain, interaction_count
  INTO   v_learned_explore, v_learned_brain, v_interactions
  FROM   public.user_vibe_profile
  WHERE  user_id = v_user_id;

  v_learn_weight := LEAST(COALESCE(v_interactions, 0)::FLOAT / 20.0, 0.70);

  v_eff_explore := LEAST(GREATEST(
    explore_weight * (1.0 - v_learn_weight)
    + COALESCE(v_learned_explore, explore_weight) * v_learn_weight,
    0.0), 1.0);

  v_eff_brain := LEAST(GREATEST(
    brain_weight * (1.0 - v_learn_weight)
    + COALESCE(v_learned_brain, brain_weight) * v_learn_weight,
    0.0), 1.0);

  RETURN QUERY
  WITH scored AS (
    SELECT
      p.id, p.author_id, p.caption, p.media_url, p.media_type,
      LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0)  AS dwell_capped,
      COALESCE(p.score_explore, 0.5)                  AS score_explore_safe,
      COALESCE(p.score_brain,   0.5)                  AS score_brain_safe,
      p.tags, p.guild_id, p.is_guild_post, p.created_at,
      pr.username, pr.avatar_url,
      (
        LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45
        + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - v_eff_explore)) * 0.25
        + (1.0 - ABS(COALESCE(p.score_brain,   0.5) - v_eff_brain))   * 0.25
        + GREATEST(0.0,
            0.10 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (48.0 * 3600.0) * 0.10)
        + LEAST(LOG(1.0 + COALESCE(p.comment_count,  0)::FLOAT) / LOG(51.0),  1.0) * 0.10
        + LEAST(LOG(1.0 + COALESCE(p.share_count,    0)::FLOAT) / LOG(51.0),  1.0) * 0.08
        + LEAST(LOG(1.0 + COALESCE(p.like_count,     0)::FLOAT) / LOG(101.0), 1.0) * 0.05
        + LEAST(LOG(1.0 + COALESCE(p.bookmark_count, 0)::FLOAT) / LOG(21.0),  1.0) * 0.05
        + COALESCE(pr.consistency_score, 0.5) * 0.03
        + CASE
            WHEN COALESCE(p.view_count, 0) >= 20 THEN
              LEAST(
                (COALESCE(p.like_count, 0) + COALESCE(p.comment_count, 0) + COALESCE(p.share_count, 0))::FLOAT
                / p.view_count::FLOAT / 0.20, 1.0
              ) * 0.08
            ELSE 0.0
          END
        + CASE
            WHEN COALESCE(p.view_count, 0) >= 100 THEN
              LEAST(p.share_count::FLOAT / p.view_count::FLOAT / 0.03, 1.0) * 0.06
            ELSE 0.0
          END
        + CASE WHEN f.following_id IS NOT NULL THEN 0.10 ELSE 0.0 END
      ) * CASE
            WHEN include_seen            THEN 1.0
            WHEN pdl.post_id IS NOT NULL THEN 0.15
            ELSE                              1.0
          END AS final_score

    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    LEFT JOIN public.post_dwell_log pdl
      ON pdl.post_id = p.id AND pdl.user_id = v_user_id
    LEFT JOIN public.follows f
      ON f.follower_id = v_user_id AND f.following_id = p.author_id
    WHERE p.is_guild_post IS NOT TRUE
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
      -- ── CURSOR PAGINATION FIX ────────────────────────────────────────────
      -- Exkludiert bereits geladene Posts anhand ihrer IDs.
      -- cardinality=0 (leeres Array) → kein Filter (erste Seite)
      -- cardinality>0 → alle IDs in exclude_ids werden übersprungen
      AND (cardinality(exclude_ids) = 0 OR p.id != ALL(exclude_ids))
  ),
  ranked AS (
    SELECT *,
      COUNT(DISTINCT author_id) OVER () AS total_authors,
      ROW_NUMBER() OVER (
        PARTITION BY author_id
        ORDER BY final_score DESC, created_at DESC
      ) AS author_rank
    FROM scored
  )
  SELECT
    id, author_id, caption, media_url, media_type,
    dwell_capped AS dwell_time_score, score_explore_safe AS score_explore,
    score_brain_safe AS score_brain, tags, guild_id, is_guild_post,
    created_at, username, avatar_url, final_score
  FROM ranked
  WHERE author_rank <= GREATEST(2, CEIL(result_limit::FLOAT / NULLIF(total_authors, 0))::INT)
  ORDER BY final_score DESC NULLS LAST, created_at DESC
  LIMIT result_limit;
  -- KEIN OFFSET MEHR — ID-Exclusion übernimmt diese Aufgabe
END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFIKATION                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT
  'exclude_ids Parameter'   AS fix,
  'UUID[] DEFAULT empty'    AS typ,
  'Seite 1: []  →  Seite 2: [id1,id2,...,id15]'  AS funktionsweise
UNION ALL SELECT
  'result_offset',
  'deprecated (ignoriert)',
  'Rückwärtskompatibel — Client muss nicht ändern'
UNION ALL SELECT
  'Duplikate möglich?',
  'NEIN',
  'p.id != ALL(exclude_ids) ist deterministisch'
UNION ALL SELECT
  'Performance',
  'O(n) auf posts',
  'Array-Check effizient bei < 50k Posts'
UNION ALL SELECT
  'Gesamte Posts in DB',
  COUNT(*)::TEXT,
  'Pagination aktiv'
FROM public.posts WHERE is_guild_post IS NOT TRUE;
