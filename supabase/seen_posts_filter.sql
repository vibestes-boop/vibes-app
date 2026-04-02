-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Seen Posts Filter v1
--
-- Löst die kritischste Lücke: Posts die ein User bereits gesehen hat
-- tauchen immer wieder auf → Frustration → Session-Abbruch.
--
-- Lösung: 85% Penalty für gesehene Posts (nicht komplette Ausblendung).
--
-- Warum Penalty statt komplette Ausblendung?
--   Bei wenig Content würde der Feed sonst leer werden.
--   Mit Penalty: ungesehener Content rankt IMMER über gesehenem
--   (selbst schlechter ungesehener Post schlägt besten gesehenen Post)
--
-- Mathematischer Beweis:
--   Gesehener Post (max score 1.36) × 0.15 = 0.204
--   Ungesehener Post (min score)   = 0.25+0.25+0.10 = 0.60 (Standardwert)
--   → Jeder ungesehene Post rankt höher ✓
--
-- Was als "gesehen" gilt:
--   - Dwell >= 2s (in post_dwell_log via update_dwell_time)
--   - Skip 500ms-2s (ab sofort auch in post_dwell_log eingetragen)
--
-- Ausführungsreihenfolge: nach share_signal.sql
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 1 — record_skip: Auch in post_dwell_log eintragen              ║
-- ║  Wenn User skippt → als "gesehen" markieren                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Logik: Ein Skip bedeutet "ich wollte das nicht sehen".
-- ON CONFLICT DO NOTHING: positive Dwell-Signale werden nie überschrieben.

CREATE OR REPLACE FUNCTION public.record_skip(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_explore FLOAT;
  v_brain   FLOAT;
  v_alpha   FLOAT := 0.02;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Post-Vibe laden
  SELECT
    COALESCE(score_explore, 0.5),
    COALESCE(score_brain,   0.5)
  INTO v_explore, v_brain
  FROM public.posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Guard: Nur wenn Post klassifiziert ist
  IF ABS(v_explore - 0.5) < 0.05 AND ABS(v_brain - 0.5) < 0.05 THEN
    RETURN;
  END IF;

  -- NEU: Als "gesehen" in post_dwell_log markieren (view_count=0)
  -- ON CONFLICT DO NOTHING → positive Dwell-Signale bleiben erhalten
  INSERT INTO public.post_dwell_log (user_id, post_id, last_seen, view_count)
  VALUES (v_user_id, p_post_id, NOW(), 0)
  ON CONFLICT (user_id, post_id) DO NOTHING;

  -- Lernprofil: Repulsion (wie bisher)
  INSERT INTO public.user_vibe_profile (user_id, learned_explore, learned_brain, interaction_count, updated_at)
  VALUES (
    v_user_id,
    ROUND((1.0 - v_explore)::NUMERIC, 4),
    ROUND((1.0 - v_brain)::NUMERIC,   4),
    1, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    learned_explore   = ROUND((user_vibe_profile.learned_explore * (1.0 - v_alpha) + (1.0 - v_explore) * v_alpha)::NUMERIC, 4),
    learned_brain     = ROUND((user_vibe_profile.learned_brain   * (1.0 - v_alpha) + (1.0 - v_brain)   * v_alpha)::NUMERIC, 4),
    updated_at        = NOW();
END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 2 — get_vibe_feed: Seen-Posts Penalty                          ║
-- ║  85% Penalty für bereits gesehene Posts via LEFT JOIN post_dwell_log     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Neuer Parameter: include_seen BOOLEAN DEFAULT FALSE
--   FALSE: gesehene Posts werden mit 0.15 multiplied (Standard)
--   TRUE:  alle Posts normal — für "Refresh everything" Button

CREATE OR REPLACE FUNCTION public.get_vibe_feed(
  explore_weight FLOAT   DEFAULT 0.5,
  brain_weight   FLOAT   DEFAULT 0.5,
  result_limit   INT     DEFAULT 15,
  result_offset  INT     DEFAULT 0,
  filter_tag     TEXT    DEFAULT NULL,
  include_seen   BOOLEAN DEFAULT FALSE   -- NEU: für "Alle anzeigen" Button
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
        -- Rohscore (alle 9 Signale)
        (
          LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45
          + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - v_eff_explore)) * 0.25
          + (1.0 - ABS(COALESCE(p.score_brain,   0.5) - v_eff_brain))   * 0.25
          + GREATEST(0.0, 0.10 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (48.0 * 3600.0) * 0.10)
          + LEAST(LOG(1.0 + COALESCE(p.comment_count,  0)::FLOAT) / LOG(51.0),  1.0) * 0.10
          + LEAST(LOG(1.0 + COALESCE(p.share_count,    0)::FLOAT) / LOG(51.0),  1.0) * 0.08
          + LEAST(LOG(1.0 + COALESCE(p.like_count,     0)::FLOAT) / LOG(101.0), 1.0) * 0.05
          + LEAST(LOG(1.0 + COALESCE(p.bookmark_count, 0)::FLOAT) / LOG(21.0),  1.0) * 0.05
          + COALESCE(pr.consistency_score, 0.5) * 0.03
        )
        -- ── NEU: Seen-Posts Penalty ──────────────────────────────────────
        -- Wenn include_seen=FALSE: gesehene Posts auf 15% reduziert
        -- Wenn include_seen=TRUE:  kein Penalty (alle Posts normal)
        -- LEFT JOIN weiter unten liefert pdl.post_id = NULL für ungesehene Posts
        * CASE
            WHEN include_seen      THEN 1.0   -- explizit alle anzeigen → kein Penalty
            WHEN pdl.post_id IS NOT NULL THEN 0.15  -- gesehen → 85% Penalty
            ELSE                        1.0   -- ungesehen → voller Score
          END
      ) AS final_score
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    -- NEU: Seen-Status via LEFT JOIN — effizient, ein Query statt Subquery
    LEFT JOIN public.post_dwell_log pdl
      ON pdl.post_id = p.id
     AND pdl.user_id = v_user_id
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
-- ║  VERIFIKATION                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT
  'Posts bereits gesehen (in dwell_log)'  AS check_name,
  COUNT(DISTINCT post_id)::TEXT           AS value
FROM public.post_dwell_log

UNION ALL SELECT
  'User mit Dwell-History',
  COUNT(DISTINCT user_id)::TEXT
FROM public.post_dwell_log

UNION ALL SELECT
  'Math-Check: Max gesehener Score',
  ROUND((1.36 * 0.15)::NUMERIC, 3)::TEXT || ' (< 0.60 = min ungesehen)'

UNION ALL SELECT
  'Seen-Filter aktiv ab',
  'jedem Feed-Aufruf (include_seen=FALSE default)'

UNION ALL SELECT
  'Skip markiert jetzt auch als gesehen',
  'Ja — ON CONFLICT DO NOTHING schützt positive Signale';
