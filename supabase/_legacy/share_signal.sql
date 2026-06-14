-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Share Signal v1
--
-- Schließt die letzte Ranking-Lücke: Shares sind das mächtigste virale Signal
-- (laut Viral Formula: Share Rate > 3% = viral).
--
-- Implementierung bewusst konservativ (weight=0.08, wie Likes):
--   Unser Tracking erfasst nur App-Shares (native Share-Sheet + DM).
--   Screenshots, Copy-Link etc. werden nicht gezählt → Unterzählung.
--   Deshalb: nicht übergewichten — gleich wie Likes.
--
-- DANACH: Stopp mit neuen Signalen. Fokus auf echte User.
--
-- Ausführungsreihenfolge: nach advanced_signals.sql
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  share_count Spalte zu posts                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_share_count
  ON public.posts (share_count DESC)
  WHERE share_count > 0;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  record_share_learn erweitern: jetzt auch share_count erhöhen           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.record_share_learn(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;
  IF p_post_id IS NULL THEN RETURN; END IF;

  -- 1. Post-Share-Counter erhöhen (für Feed-Ranking)
  UPDATE public.posts
  SET share_count = share_count + 1
  WHERE id = p_post_id;

  -- 2. Lernprofil updaten (wie bisher, alpha=0.10)
  PERFORM public._learn_from_post(v_user_id, p_post_id, 0.10);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_share_learn(UUID) TO authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  get_vibe_feed — finale Version mit allen 9 Signalen                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Share-Normalisierung (logarithmisch, 50 Shares = voller Wert):
--   0 Shares  → +0.000
--   1 Share   → +0.014
--   5 Shares  → +0.036
--   10 Shares → +0.048
--   50 Shares → +0.080  (Maximum)
--
-- Gewicht: 0.08 (wie Likes) — konservativ wegen unvollständigem Tracking

CREATE OR REPLACE FUNCTION public.get_vibe_feed(
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
        -- 1. Dwell: 45% — echter Konsum-Beweis
        LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45

        -- 2. Explore-Match: 25% — Slider + Lernprofil
        + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - v_eff_explore)) * 0.25

        -- 3. Brain-Match: 25% — Slider + Lernprofil
        + (1.0 - ABS(COALESCE(p.score_brain, 0.5) - v_eff_brain)) * 0.25

        -- 4. Freshness: bis 10% — 48h Cold-Start
        + GREATEST(0.0,
            0.10 - EXTRACT(EPOCH FROM (NOW() - p.created_at))
                   / (48.0 * 3600.0) * 0.10)

        -- 5. Comments: bis 10% — log(50 = max)
        + LEAST(LOG(1.0 + COALESCE(p.comment_count,  0)::FLOAT) / LOG(51.0),  1.0) * 0.10

        -- 6. Shares: bis 8% — log(50 = max) | NEUE SIGNAL
        + LEAST(LOG(1.0 + COALESCE(p.share_count,    0)::FLOAT) / LOG(51.0),  1.0) * 0.08

        -- 7. Likes: bis 5% — log(100 = max)
        + LEAST(LOG(1.0 + COALESCE(p.like_count,     0)::FLOAT) / LOG(101.0), 1.0) * 0.05

        -- 8. Bookmarks: bis 5% — log(20 = max)
        + LEAST(LOG(1.0 + COALESCE(p.bookmark_count, 0)::FLOAT) / LOG(21.0),  1.0) * 0.05

        -- 9. Creator Consistency: bis 3%
        + COALESCE(pr.consistency_score, 0.5) * 0.03

      ) AS final_score
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
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
-- ║  VERIFIKATION — Finale Signal-Übersicht                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT '═══ FINALE SIGNAL-ÜBERSICHT ═══' AS signal, '' AS gewicht, '' AS max_boost
UNION ALL SELECT 'Dwell Time',          '× 0.45', '+0.450'
UNION ALL SELECT 'Explore-Match',       '× 0.25', '+0.250'
UNION ALL SELECT 'Brain-Match',         '× 0.25', '+0.250'
UNION ALL SELECT 'Freshness (48h)',     '× 0.10', '+0.100'
UNION ALL SELECT 'Comments',           '× 0.10', '+0.100'
UNION ALL SELECT 'Shares ← NEU',       '× 0.08', '+0.080'
UNION ALL SELECT 'Likes',              '× 0.05', '+0.050'
UNION ALL SELECT 'Bookmarks',          '× 0.05', '+0.050'
UNION ALL SELECT 'Creator Consistency','× 0.03', '+0.030'
UNION ALL SELECT '───────────────────────', '', ''
UNION ALL SELECT 'MAX TOTAL',           '',      '1.360'
UNION ALL SELECT '───────────────────────', '', ''
UNION ALL SELECT 'share_count auf Posts', COUNT(*)::TEXT || ' Posts', '' FROM public.posts
UNION ALL SELECT 'ALGORITHMUS KOMPLETT — Fokus jetzt: echte User', '', '';
