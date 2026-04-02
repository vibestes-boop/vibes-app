-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Comment Signal v1
--
-- Was diese Datei tut:
--   1. Fügt comment_count Spalte zu posts hinzu (denormalisiert, schnell)
--   2. Trigger hält comment_count automatisch aktuell (INSERT / DELETE)
--   3. Backfill für bestehende Posts
--   4. Neue get_vibe_feed mit Comment-Signal (ersetzt user_learning_profile.sql Version)
--
-- Scoring nach dieser Änderung (max 1.15):
--   Dwell     × 0.45   (unverändert — dominantes Signal)
--   Explore   × 0.25   (mit gelernten Gewichten)
--   Brain     × 0.25   (mit gelernten Gewichten)
--   Freshness ≤ 0.10   (war 0.15 — leicht reduziert)
--   Comments  ≤ 0.10   (NEU — logarithmisch, 50 Comments = voller Wert)
--
-- Ausführungsreihenfolge:
--   1. algorithm_production.sql
--   2. user_learning_profile.sql
--   3. DIESE DATEI (comment_signal.sql)
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 1 — comment_count Spalte zu posts hinzufügen                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;

-- Index für Score-Sortierung (optional aber sauber)
CREATE INDEX IF NOT EXISTS idx_posts_comment_count
  ON public.posts (comment_count DESC)
  WHERE comment_count > 0;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 2 — Trigger: comments → posts.comment_count sync              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Hält comment_count automatisch aktuell.
-- Feuert nach INSERT (neuer Kommentar) und DELETE (Kommentar gelöscht).
-- GREATEST(..., 0) verhindert negative Werte bei Race Conditions.

CREATE OR REPLACE FUNCTION public._sync_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;

  RETURN NULL; -- AFTER Trigger → Rückgabewert wird ignoriert
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comment_count ON public.comments;
CREATE TRIGGER trg_sync_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_comment_count();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 3 — Backfill: Bestehende comment_count berechnen              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

UPDATE public.posts p
SET comment_count = (
  SELECT COUNT(*)::INT
  FROM public.comments c
  WHERE c.post_id = p.id
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 4 — get_vibe_feed: Comment-Signal integriert                  ║
-- ║  Ersetzt die Version aus user_learning_profile.sql                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Comment-Normalisierung (logarithmisch):
--   LOG(1 + comment_count) / LOG(51)   → 50 Comments = Signal 1.0
--
--   0 Comments  →  0.000
--   1 Comment   →  0.176  × 0.10 = +0.018 im Score
--   5 Comments  →  0.451  × 0.10 = +0.045
--   10 Comments →  0.596  × 0.10 = +0.060
--   25 Comments →  0.810  × 0.10 = +0.081
--   50 Comments →  1.000  × 0.10 = +0.100  (Maximum)
--
-- Warum logarithmisch?
--   Diminishing Returns: der Sprung von 0→1 ist wichtiger als 100→101.
--   Schützt vor viral Posts die den Feed komplett monopolisieren.

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

  -- ── Lernprofil laden ─────────────────────────────────────────────────────
  SELECT learned_explore, learned_brain, interaction_count
  INTO   v_learned_explore, v_learned_brain, v_interactions
  FROM   public.user_vibe_profile
  WHERE  user_id = v_user_id;

  -- ── Blend: Slider + Lernprofil ───────────────────────────────────────────
  -- 0 Interaktionen → 100% Slider | 20+ Interaktionen → 70% Lernprofil
  v_learn_weight := LEAST(COALESCE(v_interactions, 0)::FLOAT / 20.0, 0.70);

  v_eff_explore := LEAST(GREATEST(
    explore_weight * (1.0 - v_learn_weight)
    + COALESCE(v_learned_explore, explore_weight) * v_learn_weight,
    0.0), 1.0);

  v_eff_brain := LEAST(GREATEST(
    brain_weight * (1.0 - v_learn_weight)
    + COALESCE(v_learned_brain, brain_weight) * v_learn_weight,
    0.0), 1.0);

  -- ── Feed-Query ───────────────────────────────────────────────────────────
  RETURN QUERY
  WITH

  scored AS (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0)   AS dwell_capped,
      COALESCE(p.score_explore, 0.5)                   AS score_explore_safe,
      COALESCE(p.score_brain,   0.5)                   AS score_brain_safe,
      p.tags,
      p.guild_id,
      p.is_guild_post,
      p.created_at,
      pr.username,
      pr.avatar_url,
      (
        -- ── Dwell: 45% — echter Konsum-Beweis ──────────────────────────────
        LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45

        -- ── Explore-Match: 25% — Slider + Lernprofil ───────────────────────
        + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - v_eff_explore)) * 0.25

        -- ── Brain-Match: 25% — Slider + Lernprofil ─────────────────────────
        + (1.0 - ABS(COALESCE(p.score_brain, 0.5) - v_eff_brain)) * 0.25

        -- ── Freshness: bis 10% — Cold-Start-Boost (48h linear) ─────────────
        -- Reduziert von 15% auf 10% um Platz für Comment-Signal zu machen
        + GREATEST(
            0.0,
            0.10 - EXTRACT(EPOCH FROM (NOW() - p.created_at))
                   / (48.0 * 3600.0) * 0.10
          )

        -- ── Comments: bis 10% — logarithmisch (50 Comments = voll) ─────────
        -- LOG(51) ≈ 3.932 | Normalisiert auf [0, 1], dann × 0.10
        + LEAST(
            LOG(1.0 + COALESCE(p.comment_count, 0)::FLOAT) / LOG(51.0),
            1.0
          ) * 0.10

      ) AS final_score
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    WHERE p.is_guild_post IS NOT TRUE
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
  ),

  ranked AS (
    SELECT
      *,
      COUNT(DISTINCT author_id) OVER ()  AS total_authors,
      ROW_NUMBER() OVER (
        PARTITION BY author_id
        ORDER BY final_score DESC, created_at DESC
      ) AS author_rank
    FROM scored
  )

  SELECT
    id, author_id, caption, media_url, media_type,
    dwell_capped       AS dwell_time_score,
    score_explore_safe AS score_explore,
    score_brain_safe   AS score_brain,
    tags, guild_id, is_guild_post, created_at,
    username, avatar_url, final_score
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
  '══ COMMENT SIGNAL STATUS ══'                                   AS check_name, '' AS value
UNION ALL
SELECT 'Posts mit comment_count > 0',
  COUNT(*)::TEXT FROM public.posts WHERE comment_count > 0
UNION ALL
SELECT 'Posts ohne Kommentare',
  COUNT(*)::TEXT FROM public.posts WHERE comment_count = 0
UNION ALL
SELECT 'Max comment_count',
  MAX(comment_count)::TEXT FROM public.posts
UNION ALL
SELECT 'Ø comment_count',
  ROUND(AVG(comment_count)::NUMERIC, 2)::TEXT FROM public.posts
UNION ALL
SELECT 'Comment-Trigger aktiv',
  'trg_sync_comment_count' AS value
UNION ALL
SELECT 'Score-Beispiel (5 Comments)',
  ROUND((LOG(6.0) / LOG(51.0) * 0.10)::NUMERIC, 4)::TEXT || ' Punkte im Feed' AS value
UNION ALL
SELECT 'Score-Beispiel (50 Comments)',
  ROUND((LOG(51.0) / LOG(51.0) * 0.10)::NUMERIC, 4)::TEXT || ' Punkte im Feed' AS value;
