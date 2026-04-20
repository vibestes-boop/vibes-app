-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Critical Fix: get_vibe_feed Overload Conflict + Performance Indexes
-- Datum: 2026-04-05
--
-- Problem: 15+ Versionen von get_vibe_feed mit unterschiedlichen Signaturen
--          → PostgREST: HTTP 300 Multiple Choices bei jedem Feed-Aufruf
--          → Jeder Feed-Request macht 2 HTTP-Hops statt 1
--
-- Fix:
--   1. Alle alten Overloads mit DROP FUNCTION IF EXISTS entfernen
--   2. Einzige, kanonische Version mit allen App-Parametern erstellen
--   3. Index auf posts(author_id, created_at) für Profile-Posts 1.23s → ~30ms
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Schritt 1: Alle alten Overloads droppen ────────────────────────────────
-- PostgreSQL-Overloads werden durch exakte Parameterlisten unterschieden.
-- Wir droppen alle bekannten alten Signaturen.
DROP FUNCTION IF EXISTS public.get_vibe_feed();
DROP FUNCTION IF EXISTS public.get_vibe_feed(FLOAT, FLOAT, INT, TEXT);
DROP FUNCTION IF EXISTS public.get_vibe_feed(FLOAT, FLOAT, INT, INT, TEXT);
DROP FUNCTION IF EXISTS public.get_vibe_feed(FLOAT, FLOAT, INT, INT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_vibe_feed(FLOAT, FLOAT, INT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS get_vibe_feed();
DROP FUNCTION IF EXISTS get_vibe_feed(FLOAT, FLOAT, INT, TEXT);
DROP FUNCTION IF EXISTS get_vibe_feed(FLOAT, FLOAT, INT, INT, TEXT);
DROP FUNCTION IF EXISTS get_vibe_feed(FLOAT, FLOAT, INT, INT, TEXT, BOOLEAN);

-- ─── Schritt 2: Kanonische Version (exakt was die App sendet) ───────────────
-- App ruft auf mit: explore_weight, brain_weight, result_limit,
--                   filter_tag, include_seen, exclude_ids
--
-- Kernlogik vom seen_posts_filter.sql übernommen + exclude_ids hinzugefügt.

CREATE OR REPLACE FUNCTION public.get_vibe_feed(
  explore_weight FLOAT   DEFAULT 0.5,
  brain_weight   FLOAT   DEFAULT 0.5,
  result_limit   INT     DEFAULT 15,
  filter_tag     TEXT    DEFAULT NULL,
  include_seen   BOOLEAN DEFAULT FALSE,
  exclude_ids    UUID[]  DEFAULT '{}'
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

  -- Lernprofil laden (falls vorhanden)
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
      p.thumbnail_url,
      LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0)  AS dwell_capped,
      COALESCE(p.score_explore, 0.5)                  AS score_explore_safe,
      COALESCE(p.score_brain,   0.5)                  AS score_brain_safe,
      p.tags, p.guild_id, p.is_guild_post, p.created_at,
      pr.username, pr.avatar_url,
      (
        (
          LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45
          + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - v_eff_explore)) * 0.25
          + (1.0 - ABS(COALESCE(p.score_brain,   0.5) - v_eff_brain))   * 0.25
          + GREATEST(0.0, 0.10 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (48.0 * 3600.0) * 0.10)
          + LEAST(LOG(1.0 + COALESCE(p.comment_count,  0)::FLOAT) / LOG(51.0),  1.0) * 0.10
          + LEAST(LOG(1.0 + COALESCE(p.share_count,    0)::FLOAT) / LOG(51.0),  1.0) * 0.08
          + LEAST(LOG(1.0 + COALESCE(p.like_count,     0)::FLOAT) / LOG(101.0), 1.0) * 0.05
          + LEAST(LOG(1.0 + COALESCE(p.bookmark_count, 0)::FLOAT) / LOG(21.0),  1.0) * 0.05
        )
        -- Seen-Posts Penalty: 85% Reduktion für bereits gesehene Posts
        * CASE
            WHEN include_seen            THEN 1.0   -- alle Posts zeigen → kein Penalty
            WHEN pdl.post_id IS NOT NULL THEN 0.15  -- gesehen → 85% Penalty
            ELSE                              1.0   -- ungesehen → voller Score
          END
      ) AS final_score
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    LEFT JOIN public.post_dwell_log pdl
      ON pdl.post_id = p.id
     AND pdl.user_id = v_user_id
    WHERE p.is_guild_post IS NOT TRUE
      AND (filter_tag  IS NULL OR p.tags @> ARRAY[filter_tag])
      AND (array_length(exclude_ids, 1) IS NULL OR p.id != ALL(exclude_ids))
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
    id, author_id, caption, media_url, media_type, thumbnail_url,
    dwell_capped AS dwell_time_score,
    score_explore_safe AS score_explore,
    score_brain_safe   AS score_brain,
    tags, guild_id, is_guild_post, created_at, username, avatar_url, final_score
  FROM ranked
  WHERE author_rank <= GREATEST(2, CEIL(result_limit::FLOAT / NULLIF(total_authors, 0))::INT)
  ORDER BY final_score DESC NULLS LAST, created_at DESC
  LIMIT result_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vibe_feed(FLOAT, FLOAT, INT, TEXT, BOOLEAN, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vibe_feed(FLOAT, FLOAT, INT, TEXT, BOOLEAN, UUID[]) TO anon;


-- ─── Schritt 3: Index für Profile/User Posts [$1.23s → ~30ms] ───────────────
-- Abfrage: SELECT * FROM posts WHERE author_id = X ORDER BY created_at DESC
-- Ohne Index: Seq-Scan über alle Posts
CREATE INDEX IF NOT EXISTS idx_posts_author_created
  ON public.posts (author_id, created_at DESC);


-- ─── Verifikation ────────────────────────────────────────────────────────────
-- Prüfen ob nur EINE Funktion mit dem Namen get_vibe_feed existiert
SELECT
  routine_name,
  routine_schema,
  (SELECT COUNT(*) FROM information_schema.parameters p
   WHERE p.specific_name = r.specific_name) AS param_count
FROM information_schema.routines r
WHERE routine_schema IN ('public')
  AND routine_name = 'get_vibe_feed';
