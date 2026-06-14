-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — View Count Signal v1
--
-- Schließt die letzte analytische Lücke: view_count auf posts.
--
-- Warum view_count?
--   Bisher: 50 Likes auf einem Post ist immer gleich gut.
--   Mit view_count:
--     Post A: 50 Likes / 10.000 Views = 0.5%  → schwaches Signal
--     Post B: 50 Likes / 100 Views    = 50%   → virales Signal
--
-- Zwei neue Signale die damit möglich werden:
--   1. Engagement Rate   — relativer Erfolg eines Posts (max +0.08)
--   2. Viral Share Rate  — 3%-Threshold aus YouTube Viral-Formel (max +0.06)
--
-- Selbst-skalierend: Signale feuern nur bei genug Views (≥20 / ≥100).
--   → Bei wenig Usern: immer 0 (kein Rauschen)
--   → Bei großem Scale: starke, aussagekräftige Signale
--
-- Ausführungsreihenfolge: nach seen_posts_filter.sql (letzte Datei)
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 1 — view_count Spalte zu posts                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_view_count
  ON public.posts (view_count DESC)
  WHERE view_count > 0;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 2 — Backfill: view_count aus post_dwell_log berechnen          ║
-- ║  Bestehende Posts bekommen initialen view_count aus der Log-History      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

UPDATE public.posts p
SET view_count = COALESCE((
  SELECT SUM(dl.view_count)
  FROM public.post_dwell_log dl
  WHERE dl.post_id = p.id
), 0)
WHERE EXISTS (
  SELECT 1 FROM public.post_dwell_log WHERE post_id = p.id
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 3 — update_dwell_time: view_count erhöhen                      ║
-- ║  Bereits durch Gaming-Guard (60min + max 5 pro User) geschützt          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.update_dwell_time(post_id UUID, dwell_ms INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_last_seen   TIMESTAMPTZ;
  v_view_count  INT;
  v_observation FLOAT;
  v_learn_alpha FLOAT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT last_seen, view_count
  INTO   v_last_seen, v_view_count
  FROM   public.post_dwell_log
  WHERE  user_id = v_user_id AND post_id = update_dwell_time.post_id;

  -- Guard 1: 60min Cooldown
  IF v_last_seen IS NOT NULL
     AND v_last_seen > NOW() - INTERVAL '60 minutes' THEN
    RETURN;
  END IF;

  -- Guard 2: Max 5 Updates pro User/Post
  IF v_view_count IS NOT NULL AND v_view_count >= 5 THEN
    RETURN;
  END IF;

  v_observation := LEAST(GREATEST(dwell_ms, 0), 60000)::FLOAT / 60000.0;

  -- Post-Score + view_count updaten (beide in einem UPDATE)
  UPDATE public.posts
  SET
    dwell_time_score = LEAST(COALESCE(dwell_time_score, 0) * 0.75 + v_observation * 0.25, 1.0),
    view_count       = view_count + 1   -- ← NEU: globaler View-Counter
  WHERE id = post_id;

  -- Gaming-Log updaten
  INSERT INTO public.post_dwell_log (user_id, post_id, last_seen, view_count)
  VALUES (v_user_id, post_id, NOW(), 1)
  ON CONFLICT (user_id, post_id) DO UPDATE SET
    last_seen  = NOW(),
    view_count = post_dwell_log.view_count + 1;

  -- Lernprofil (nur bei >= 5 Sekunden)
  IF dwell_ms >= 5000 THEN
    v_learn_alpha := LEAST(dwell_ms::FLOAT / 60000.0, 1.0) * 0.05;
    PERFORM public._learn_from_post(v_user_id, post_id, v_learn_alpha);
  END IF;

END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 4 — record_skip: view_count nur beim ERSTEN Skip erhöhen       ║
-- ║  ON CONFLICT DO NOTHING = zweiter Skip zählt nicht doppelt              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

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
  v_rows    INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(score_explore, 0.5),
    COALESCE(score_brain,   0.5)
  INTO v_explore, v_brain
  FROM public.posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Guard: nur wenn Post klassifiziert ist
  IF ABS(v_explore - 0.5) < 0.05 AND ABS(v_brain - 0.5) < 0.05 THEN RETURN; END IF;

  -- Als "gesehen" markieren — NUR erster Skip zählt für view_count
  INSERT INTO public.post_dwell_log (user_id, post_id, last_seen, view_count)
  VALUES (v_user_id, p_post_id, NOW(), 0)
  ON CONFLICT (user_id, post_id) DO NOTHING;

  -- ROW_COUNT: 1 = neue Zeile (erster Skip) → view_count erhöhen
  --            0 = bereits gesehen           → kein doppeltes Counting
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    UPDATE public.posts
    SET view_count = view_count + 1
    WHERE id = p_post_id;
  END IF;

  -- Lernprofil: Repulsion (Profil weg vom Skip-Content)
  INSERT INTO public.user_vibe_profile (user_id, learned_explore, learned_brain, interaction_count, updated_at)
  VALUES (
    v_user_id,
    ROUND((1.0 - v_explore)::NUMERIC, 4),
    ROUND((1.0 - v_brain)::NUMERIC,   4),
    1, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    learned_explore = ROUND((user_vibe_profile.learned_explore * (1.0 - v_alpha) + (1.0 - v_explore) * v_alpha)::NUMERIC, 4),
    learned_brain   = ROUND((user_vibe_profile.learned_brain   * (1.0 - v_alpha) + (1.0 - v_brain)   * v_alpha)::NUMERIC, 4),
    updated_at      = NOW();
END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 5 — get_vibe_feed: FINALE VERSION mit allen 11 Signalen        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Zwei neue Signale:
--
-- Engagement Rate (max +0.08):
--   Formel: (likes + comments + shares) / view_count
--   Threshold: min 20 Views (darunter: statistisch bedeutungslos)
--   Skalierung: 20% Rate = maximaler Bonus (LEAST normalisiert)
--   Beispiel:
--     50 Likes / 100 Views  = 50% → +0.080 (MAX)
--     50 Likes / 1000 Views =  5% → +0.020
--     50 Likes / 10000 Views = 0.5% → +0.002
--
-- Viral Share Rate (max +0.06):
--   Formel: shares / view_count — 3%-Threshold = viral (aus YouTube-Formel)
--   Threshold: min 100 Views (darunter: 3% könnte Zufall sein)
--   Bonus: linear bis zum 3%-Threshold, danach voller Bonus
--   Beispiel:
--     5% Share Rate (100+ Views) → +0.060 (viral!)
--     3% Share Rate (100+ Views) → +0.060 (viral!)
--     1% Share Rate              → +0.020
--     0% Share Rate              → +0.000

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
        -- ── SIGNAL 1: Dwell Time (45%) ────────────────────────────────────
        LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45

        -- ── SIGNAL 2: Explore-Match (25%) ─────────────────────────────────
        + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - v_eff_explore)) * 0.25

        -- ── SIGNAL 3: Brain-Match (25%) ────────────────────────────────────
        + (1.0 - ABS(COALESCE(p.score_brain, 0.5) - v_eff_brain)) * 0.25

        -- ── SIGNAL 4: Freshness (max 10%, linear 48h) ─────────────────────
        + GREATEST(0.0,
            0.10 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (48.0 * 3600.0) * 0.10)

        -- ── SIGNAL 5: Comments — absolut (max 10%) ────────────────────────
        + LEAST(LOG(1.0 + COALESCE(p.comment_count, 0)::FLOAT) / LOG(51.0), 1.0) * 0.10

        -- ── SIGNAL 6: Shares — absolut (max 8%) ───────────────────────────
        + LEAST(LOG(1.0 + COALESCE(p.share_count, 0)::FLOAT) / LOG(51.0), 1.0) * 0.08

        -- ── SIGNAL 7: Likes — absolut (max 5%) ────────────────────────────
        + LEAST(LOG(1.0 + COALESCE(p.like_count, 0)::FLOAT) / LOG(101.0), 1.0) * 0.05

        -- ── SIGNAL 8: Bookmarks — absolut (max 5%) ────────────────────────
        + LEAST(LOG(1.0 + COALESCE(p.bookmark_count, 0)::FLOAT) / LOG(21.0), 1.0) * 0.05

        -- ── SIGNAL 9: Creator Consistency (max 3%) ────────────────────────
        + COALESCE(pr.consistency_score, 0.5) * 0.03

        -- ── SIGNAL 10: Engagement Rate (max 8%) — NEU ─────────────────────
        -- Relativer Erfolg: Interaktionen / Views
        -- Threshold: min 20 Views (darunter statistisch bedeutungslos)
        + CASE
            WHEN COALESCE(p.view_count, 0) >= 20 THEN
              LEAST(
                (COALESCE(p.like_count, 0) + COALESCE(p.comment_count, 0) + COALESCE(p.share_count, 0))::FLOAT
                / p.view_count::FLOAT
                / 0.20,   -- 20% Engagement Rate = voller Bonus
                1.0
              ) * 0.08
            ELSE 0.0
          END

        -- ── SIGNAL 11: Viral Share Rate (max 6%) — NEU ────────────────────
        -- 3% Share Rate = viral (aus YouTube Viral-Formel)
        -- Threshold: min 100 Views (statistische Signifikanz)
        + CASE
            WHEN COALESCE(p.view_count, 0) >= 100 THEN
              LEAST(
                p.share_count::FLOAT / p.view_count::FLOAT / 0.03,  -- 3% = voller Bonus
                1.0
              ) * 0.06
            ELSE 0.0
          END

      ) * CASE
            WHEN include_seen          THEN 1.0
            WHEN pdl.post_id IS NOT NULL THEN 0.15   -- gesehen → 85% Penalty
            ELSE                          1.0
          END AS final_score

    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    LEFT JOIN public.post_dwell_log pdl
      ON pdl.post_id = p.id AND pdl.user_id = v_user_id
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
-- ║  VERIFIKATION — Vollständige Signal-Übersicht                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT '═══ FINALE 11-SIGNAL ÜBERSICHT ═══'  AS signal, '' AS gewicht, '' AS max_boost, '' AS threshold
UNION ALL SELECT 'Dwell Time',           '× 0.45', '+0.450', 'immer aktiv'
UNION ALL SELECT 'Explore-Match',        '× 0.25', '+0.250', 'immer aktiv'
UNION ALL SELECT 'Brain-Match',          '× 0.25', '+0.250', 'immer aktiv'
UNION ALL SELECT 'Freshness',            '× 0.10', '+0.100', '< 48h'
UNION ALL SELECT 'Comments (absolut)',   '× 0.10', '+0.100', 'immer aktiv'
UNION ALL SELECT 'Shares (absolut)',     '× 0.08', '+0.080', 'immer aktiv'
UNION ALL SELECT 'Likes (absolut)',      '× 0.05', '+0.050', 'immer aktiv'
UNION ALL SELECT 'Bookmarks (absolut)',  '× 0.05', '+0.050', 'immer aktiv'
UNION ALL SELECT 'Creator Consistency', '× 0.03', '+0.030', 'immer aktiv'
UNION ALL SELECT 'Engagement Rate ← NEU','× 0.08', '+0.080', '≥ 20 Views'
UNION ALL SELECT 'Viral Share Rate ← NEU','× 0.06','+0.060', '≥ 100 Views + 3% Rate'
UNION ALL SELECT '──────────────────────', '',  '',  ''
UNION ALL SELECT 'MAX TOTAL',            '',  '1.500', ''
UNION ALL SELECT '──────────────────────', '',  '',  ''
UNION ALL SELECT 'Posts mit view_count > 0', COUNT(*)::TEXT, '', ''
  FROM public.posts WHERE view_count > 0
UNION ALL SELECT 'Σ view_count (alle Posts)', COALESCE(SUM(view_count), 0)::TEXT, '', ''
  FROM public.posts WHERE caption LIKE '[TEST]%';
