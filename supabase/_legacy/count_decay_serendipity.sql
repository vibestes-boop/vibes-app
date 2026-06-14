-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Count Decay + Serendipity v1
--
-- 1. COUNT DECAY
--    Problem: Ein Post von vor 6 Monaten mit 1.000 Likes rankt wie ein
--             frischer Post mit 1.000 Likes. Das ist falsch.
--    Lösung:  age_decay_factor (Halbwertszeit 90 Tage, 30 Tage Schonfrist)
--             0-30 Tage:  factor = 1.00 (kein Decay)
--             120 Tage:   factor = 0.50 (Counts halbiert)
--             210 Tage:   factor = 0.25 (Counts geviertelt)
--    Wichtig: Nur SCORING-Formel betroffen. Gespeicherte Daten unberührt.
--
-- 2. SERENDIPITY
--    Problem: Algorithmus optimiert immer Richtung bekannte Präferenzen.
--             Kein "unerwartetes Erlebnis" → Filter Bubble.
--    Lösung:  serendipity_rate (default 5%) — jeder Post mit 5% Chance:
--             - Muss ungesehen sein (post_dwell_log = NULL)
--             - Muss "andere Vibe" haben (> 0.25 Distanz vom User-Profil)
--             - Bekommt +0.50 Score-Boost → taucht bei Position 5-10 auf
--
-- Ausführungsreihenfolge: nach cursor_pagination_fix.sql
-- ══════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.get_vibe_feed(
  explore_weight    FLOAT   DEFAULT 0.5,
  brain_weight      FLOAT   DEFAULT 0.5,
  result_limit      INT     DEFAULT 15,
  result_offset     INT     DEFAULT 0,        -- deprecated, ignoriert
  filter_tag        TEXT    DEFAULT NULL,
  include_seen      BOOLEAN DEFAULT FALSE,
  exclude_ids       UUID[]  DEFAULT '{}'::UUID[],
  serendipity_rate  FLOAT   DEFAULT 0.05      -- NEU: 5% = 1/20 Posts
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
  WITH post_data AS (
    -- ── Schritt 1: Posts filtern + age_decay_factor berechnen ───────────────
    -- Zwei CTE-Layer nötig, da age_decay in scored CTE verwendet wird.
    SELECT
      p.*,
      -- Count-Decay: Halbwertszeit 90 Tage, 30 Tage Schonfrist
      -- 0-30 Tage   → factor = 1.00 (keine Wirkung)
      -- 120 Tage    → factor = 0.50 (Counts halbiert in Scoring)
      -- 210 Tage    → factor = 0.25 (Counts geviertelt in Scoring)
      POWER(
        0.5,
        GREATEST(
          EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400.0 - 30.0,
          0.0
        ) / 90.0
      ) AS age_decay
    FROM public.posts p
    WHERE p.is_guild_post IS NOT TRUE
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
      AND (cardinality(exclude_ids) = 0 OR p.id != ALL(exclude_ids))
  ),
  scored AS (
    SELECT
      pd.id, pd.author_id, pd.caption, pd.media_url, pd.media_type,
      LEAST(COALESCE(pd.dwell_time_score, 0.0), 1.0)  AS dwell_capped,
      COALESCE(pd.score_explore, 0.5)                  AS score_explore_safe,
      COALESCE(pd.score_brain,   0.5)                  AS score_brain_safe,
      pd.tags, pd.guild_id, pd.is_guild_post, pd.created_at,
      pr.username, pr.avatar_url,
      (
        -- ── SIGNAL 1: Dwell (45%) ────────────────────────────────────────────
        LEAST(COALESCE(pd.dwell_time_score, 0.0), 1.0) * 0.45

        -- ── SIGNAL 2: Explore-Match (25%) ────────────────────────────────────
        + (1.0 - ABS(COALESCE(pd.score_explore, 0.5) - v_eff_explore)) * 0.25

        -- ── SIGNAL 3: Brain-Match (25%) ──────────────────────────────────────
        + (1.0 - ABS(COALESCE(pd.score_brain, 0.5) - v_eff_brain)) * 0.25

        -- ── SIGNAL 4: Freshness (max 10%, 48h) ──────────────────────────────
        + GREATEST(0.0,
            0.10 - EXTRACT(EPOCH FROM (NOW() - pd.created_at)) / (48.0 * 3600.0) * 0.10)

        -- ── SIGNAL 5: Comments × age_decay (max 10%) ─────────────────────────
        + LEAST(LOG(COALESCE(pd.comment_count, 0)::FLOAT * pd.age_decay + 1.0) / LOG(51.0), 1.0) * 0.10

        -- ── SIGNAL 6: Shares × age_decay (max 8%) ────────────────────────────
        + LEAST(LOG(COALESCE(pd.share_count, 0)::FLOAT * pd.age_decay + 1.0) / LOG(51.0), 1.0) * 0.08

        -- ── SIGNAL 7: Likes × age_decay (max 5%) ─────────────────────────────
        + LEAST(LOG(COALESCE(pd.like_count, 0)::FLOAT * pd.age_decay + 1.0) / LOG(101.0), 1.0) * 0.05

        -- ── SIGNAL 8: Bookmarks × age_decay (max 5%) ─────────────────────────
        + LEAST(LOG(COALESCE(pd.bookmark_count, 0)::FLOAT * pd.age_decay + 1.0) / LOG(21.0), 1.0) * 0.05

        -- ── SIGNAL 9: Creator Consistency (max 3%) ────────────────────────────
        + COALESCE(pr.consistency_score, 0.5) * 0.03

        -- ── SIGNAL 10: Engagement Rate (ab 20 Views, max 8%) ─────────────────
        + CASE
            WHEN COALESCE(pd.view_count, 0) >= 20 THEN
              LEAST(
                (COALESCE(pd.like_count, 0) + COALESCE(pd.comment_count, 0) + COALESCE(pd.share_count, 0))::FLOAT
                * pd.age_decay / pd.view_count::FLOAT / 0.20,
                1.0
              ) * 0.08
            ELSE 0.0
          END

        -- ── SIGNAL 11: Viral Share Rate (ab 100 Views + 3%, max 6%) ──────────
        + CASE
            WHEN COALESCE(pd.view_count, 0) >= 100 THEN
              LEAST(pd.share_count::FLOAT * pd.age_decay / pd.view_count::FLOAT / 0.03, 1.0) * 0.06
            ELSE 0.0
          END

        -- ── SIGNAL 12: Follow Graph (+10%) ────────────────────────────────────
        + CASE WHEN f.following_id IS NOT NULL THEN 0.10 ELSE 0.0 END

        -- ── SERENDIPITY BOOST (+50%) ───────────────────────────────────────────
        -- Bedingungen:
        --   1. serendipity_rate > 0 (Feature aktiv)
        --   2. Post ist ungesehen (pdl = NULL)
        --   3. Post hat anderen Vibe (> 0.25 Distanz vom User-Profil)
        --   4. RANDOM() < serendipity_rate (5% Chance pro Post)
        -- Effekt: Post erscheint ~Position 5-10 statt unten im Feed
        + CASE
            WHEN serendipity_rate > 0
              AND pdl.post_id IS NULL
              AND (ABS(COALESCE(pd.score_explore, 0.5) - v_eff_explore) > 0.25
                    OR ABS(COALESCE(pd.score_brain, 0.5) - v_eff_brain) > 0.25)
              AND RANDOM() < serendipity_rate
            THEN 0.50
            ELSE 0.0
          END

      ) * CASE
            WHEN include_seen            THEN 1.0
            WHEN pdl.post_id IS NOT NULL THEN 0.15  -- gesehen → 85% Penalty
            ELSE                              1.0
          END AS final_score

    FROM post_data pd
    LEFT JOIN public.profiles pr ON pr.id = pd.author_id
    LEFT JOIN public.post_dwell_log pdl
      ON pdl.post_id = pd.id AND pdl.user_id = v_user_id
    LEFT JOIN public.follows f
      ON f.follower_id = v_user_id AND f.following_id = pd.author_id
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
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFIKATION
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  'Count Decay'     AS feature,
  'Halbwertszeit 90 Tage, 30 Tage Schonfrist'  AS beschreibung,
  'age_decay = POWER(0.5, MAX(age_days-30, 0)/90)'  AS formel
UNION ALL SELECT
  'Serendipity',
  '5% Chance pro Post (ungesehen + anderer Vibe)',
  '+0.50 Score-Boost → erscheint bei Position 5-10'
UNION ALL SELECT
  'Beispiel Count Decay',
  'Post mit 100 Likes, Alter 120 Tage',
  'Effektiv: LOG(100×0.5+1)/LOG(101)×0.05 = 0.031 (statt 0.040)'
UNION ALL SELECT
  'Serendipity Beispiel',
  'User mag Brain=0.9, Post hat Brain=0.2',
  'Distanz 0.7 > 0.25 → Serendipity-Kandidat → 5% Boost-Chance';
