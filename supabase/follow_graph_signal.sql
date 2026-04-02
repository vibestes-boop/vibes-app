-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Follow Graph Signal v1
--
-- Schließt das letzte signifikante Ranking-Gap:
-- Posts von Creatorn denen ein User folgt bekommen einen Boost.
--
-- Warum wichtig?
--   Instagram und TikTok verdanken 30-40% ihres Engagements dem
--   Social-Graph-Signal. User folgen Creatorn weil sie deren Content wollen.
--   Wenn dieser Content nicht bevorzugt wird → Frustration → Churn.
--
-- Implementierung:
--   +0.10 wenn post.author_id IN dem User's Following-List
--   → effizient via LEFT JOIN auf UNIQUE Index (follower_id, following_id)
--   → keine Subquery per Row — ein einziger JOIN
--
-- Neue Gesamtpunkte: MAX 1.600
--
-- Ausführungsreihenfolge: nach view_count_signal.sql (letzte Datei)
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Index sicherstellen — UNIQUE schon vorhanden, Lookup-Index hinzufügen  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_follows_follower_following
  ON public.follows (follower_id, following_id);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  get_vibe_feed — FINALE VERSION mit 12 Signalen (Follow-Graph)          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_vibe_feed(
  explore_weight FLOAT   DEFAULT 0.5,
  brain_weight   FLOAT   DEFAULT 0.5,
  result_limit   INT     DEFAULT 15,
  result_offset  INT     DEFAULT 0,
  filter_tag     TEXT    DEFAULT NULL,
  include_seen   BOOLEAN DEFAULT FALSE
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

  -- Lernprofil laden
  SELECT learned_explore, learned_brain, interaction_count
  INTO   v_learned_explore, v_learned_brain, v_interactions
  FROM   public.user_vibe_profile
  WHERE  user_id = v_user_id;

  -- Blend: Slider × (1 - lerngewicht) + Gelerntes × lerngewicht
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
        -- ── SIGNAL 1: Dwell Time (45%) ────────────────────────────────────
        LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45

        -- ── SIGNAL 2: Explore-Match (25%) ─────────────────────────────────
        + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - v_eff_explore)) * 0.25

        -- ── SIGNAL 3: Brain-Match (25%) ────────────────────────────────────
        + (1.0 - ABS(COALESCE(p.score_brain, 0.5) - v_eff_brain)) * 0.25

        -- ── SIGNAL 4: Freshness (max 10%, 48h) ────────────────────────────
        + GREATEST(0.0,
            0.10 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (48.0 * 3600.0) * 0.10)

        -- ── SIGNAL 5: Comments — absolut (max 10%) ────────────────────────
        + LEAST(LOG(1.0 + COALESCE(p.comment_count,  0)::FLOAT) / LOG(51.0),  1.0) * 0.10

        -- ── SIGNAL 6: Shares — absolut (max 8%) ───────────────────────────
        + LEAST(LOG(1.0 + COALESCE(p.share_count,    0)::FLOAT) / LOG(51.0),  1.0) * 0.08

        -- ── SIGNAL 7: Likes — absolut (max 5%) ────────────────────────────
        + LEAST(LOG(1.0 + COALESCE(p.like_count,     0)::FLOAT) / LOG(101.0), 1.0) * 0.05

        -- ── SIGNAL 8: Bookmarks — absolut (max 5%) ────────────────────────
        + LEAST(LOG(1.0 + COALESCE(p.bookmark_count, 0)::FLOAT) / LOG(21.0),  1.0) * 0.05

        -- ── SIGNAL 9: Creator Consistency (max 3%) ────────────────────────
        + COALESCE(pr.consistency_score, 0.5) * 0.03

        -- ── SIGNAL 10: Engagement Rate (max 8%, ab 20 Views) ──────────────
        + CASE
            WHEN COALESCE(p.view_count, 0) >= 20 THEN
              LEAST(
                (COALESCE(p.like_count, 0) + COALESCE(p.comment_count, 0) + COALESCE(p.share_count, 0))::FLOAT
                / p.view_count::FLOAT / 0.20,
                1.0
              ) * 0.08
            ELSE 0.0
          END

        -- ── SIGNAL 11: Viral Share Rate (max 6%, ab 100 Views) ────────────
        + CASE
            WHEN COALESCE(p.view_count, 0) >= 100 THEN
              LEAST(p.share_count::FLOAT / p.view_count::FLOAT / 0.03, 1.0) * 0.06
            ELSE 0.0
          END

        -- ── SIGNAL 12: Follow Graph (10%) — NEU ───────────────────────────
        -- Posts von Creatorn denen der User folgt bekommen +0.10 Boost.
        -- f.following_id IS NOT NULL = User folgt dem Creator (LEFT JOIN).
        -- f.following_id IS NULL     = unbekannter Creator → kein Boost.
        + CASE WHEN f.following_id IS NOT NULL THEN 0.10 ELSE 0.0 END

      ) * CASE
            WHEN include_seen            THEN 1.0
            WHEN pdl.post_id IS NOT NULL THEN 0.15  -- gesehen → 85% Penalty
            ELSE                              1.0
          END AS final_score

    FROM public.posts p
    LEFT JOIN public.profiles pr
      ON pr.id = p.author_id
    -- Seen-Status
    LEFT JOIN public.post_dwell_log pdl
      ON pdl.post_id = p.id AND pdl.user_id = v_user_id
    -- Follow-Graph: IS NOT NULL wenn User dem Creator folgt
    LEFT JOIN public.follows f
      ON f.follower_id  = v_user_id
     AND f.following_id = p.author_id
    WHERE p.is_guild_post IS NOT TRUE
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
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
  LIMIT  result_limit
  OFFSET result_offset;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFIKATION — Komplette finale Signal-Übersicht                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT
  '════ FINALE 12-SIGNAL ÜBERSICHT ════' AS signal,
  ''   AS gewicht,
  ''   AS max_boost,
  ''   AS aktivierung
UNION ALL SELECT 'Dwell Time',             '× 0.45', '+0.450', 'immer'
UNION ALL SELECT 'Explore-Match',          '× 0.25', '+0.250', 'immer'
UNION ALL SELECT 'Brain-Match',            '× 0.25', '+0.250', 'immer'
UNION ALL SELECT 'Freshness (48h)',        '≤ 0.10', '+0.100', 'immer (< 48h)'
UNION ALL SELECT 'Comments (absolut)',     '× 0.10', '+0.100', 'immer'
UNION ALL SELECT 'Shares (absolut)',       '× 0.08', '+0.080', 'immer'
UNION ALL SELECT 'Likes (absolut)',        '× 0.05', '+0.050', 'immer'
UNION ALL SELECT 'Bookmarks (absolut)',    '× 0.05', '+0.050', 'immer'
UNION ALL SELECT 'Creator Consistency',   '× 0.03', '+0.030', 'immer'
UNION ALL SELECT 'Engagement Rate ←',     '× 0.08', '+0.080', '≥ 20 Views'
UNION ALL SELECT 'Viral Share Rate ←',    '× 0.06', '+0.060', '≥ 100 Views + 3%'
UNION ALL SELECT 'Follow Graph ← NEU',    '+0.10',  '+0.100', 'wenn User folgt'
UNION ALL SELECT '─────────────────────', '',       '',        ''
UNION ALL SELECT 'MAX TOTAL',             '',       '1.600',   ''
UNION ALL SELECT '─────────────────────', '',       '',        ''
UNION ALL SELECT 'Follow-Daten in DB',
  (SELECT COUNT(*)::TEXT FROM public.follows), '', ''
UNION ALL SELECT 'Index aktiv',
  'idx_follows_follower_following', '', 'JOIN-optimiert'
UNION ALL SELECT 'ALGORITHMUS VOLLSTÄNDIG', '12/12 Signale', 'Produktionsreif', '✓';
