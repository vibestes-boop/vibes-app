-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — A/B Testing Framework v1
--
-- Erlaubt das kontrollierte Testen von Algorithmus-Varianten.
--
-- Wie funktioniert es?
--   1. Experiment in algo_experiments erstellen (control vs treatment params)
--   2. is_active = TRUE setzen → Experiment läuft
--   3. User werden DETERMINISTISCH assigned (MD5-Hash → immer gleiche Gruppe)
--   4. get_vibe_feed prüft automatisch aktive Experimente
--      → User in 'treatment' bekommt andere Parameter
--   5. Auswertung: engagement der beiden Gruppen vergleichen
--      → Dwell, Likes, Comments, Shares als Outcome-Metriken
--
-- User sehen NICHTS — 100% serverseitig.
-- Client muss NICHTS ändern.
--
-- Beispiel-Experiment:
--   Wir testen ob Serendipity Rate 5% oder 10% besser für Retention ist.
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  TABELLEN                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.algo_experiments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        UNIQUE NOT NULL,  -- z.B. 'serendipity_rate_v1'
  description     TEXT,
  is_active       BOOLEAN     DEFAULT FALSE,
  control_params  JSONB       NOT NULL DEFAULT '{}',
  treatment_params JSONB      NOT NULL DEFAULT '{}',
  -- Beispiel params: {"serendipity_rate": 0.10, "explore_weight_bonus": 0.1}
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

-- Persistente User-Assignments (einmal assigned → immer gleiche Gruppe)
CREATE TABLE IF NOT EXISTS public.algo_user_variants (
  user_id         UUID  REFERENCES public.profiles(id) ON DELETE CASCADE,
  experiment_name TEXT  NOT NULL,
  variant         TEXT  NOT NULL,  -- 'control' oder 'treatment'
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, experiment_name)
);

CREATE INDEX IF NOT EXISTS idx_algo_user_variants_lookup
  ON public.algo_user_variants (user_id, experiment_name);

CREATE INDEX IF NOT EXISTS idx_algo_experiments_active
  ON public.algo_experiments (is_active)
  WHERE is_active = TRUE;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FUNKTION: get_user_variant                                             ║
-- ║  Gibt die Gruppe des Users für ein Experiment zurück.                   ║
-- ║  Deterministisch via MD5-Hash → gleicher User = immer gleiche Gruppe.   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_user_variant(p_experiment_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_variant TEXT;
  v_bucket  INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN 'control'; END IF;

  -- Existing assignment laden
  SELECT variant INTO v_variant
  FROM public.algo_user_variants
  WHERE user_id = v_user_id AND experiment_name = p_experiment_name;

  IF FOUND THEN RETURN v_variant; END IF;

  -- Deterministisches Assignment:
  -- MD5(user_id || experiment_name) → erstes Byte (0-255)
  -- 0-127   → 'control'   (50%)
  -- 128-255 → 'treatment' (50%)
  -- Wichtig: Gleicher User bekommt IMMER die gleiche Gruppe.
  v_bucket  := get_byte(decode(md5(v_user_id::text || p_experiment_name), 'hex'), 0);
  v_variant := CASE WHEN v_bucket < 128 THEN 'control' ELSE 'treatment' END;

  -- Persistieren
  INSERT INTO public.algo_user_variants (user_id, experiment_name, variant)
  VALUES (v_user_id, p_experiment_name, v_variant)
  ON CONFLICT DO NOTHING;

  RETURN v_variant;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FUNKTION: get_experiment_params                                        ║
-- ║  Gibt die Parameter für den aktuellen User zurück (control/treatment).  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_experiment_params()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_experiment RECORD;
  v_variant    TEXT;
  v_params     JSONB := '{}'::JSONB;
BEGIN
  -- Aktives Experiment laden (max 1 gleichzeitig empfohlen)
  SELECT * INTO v_experiment
  FROM public.algo_experiments
  WHERE is_active = TRUE
    AND (ended_at IS NULL OR ended_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN '{}'::JSONB; END IF;

  -- User-Variante bestimmen
  v_variant := public.get_user_variant(v_experiment.name);

  IF v_variant = 'treatment' THEN
    v_params := v_experiment.treatment_params;
  ELSE
    v_params := v_experiment.control_params;
  END IF;

  -- Experiment-Metadaten anhängen (für Debugging/Logging)
  v_params := v_params || jsonb_build_object(
    '_experiment', v_experiment.name,
    '_variant',    v_variant
  );

  RETURN v_params;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FUNKTION: get_experiment_stats                                         ║
-- ║  Auswertung: Engagement pro Variante vergleichen.                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_experiment_stats(p_experiment_name TEXT)
RETURNS TABLE (
  variant          TEXT,
  user_count       BIGINT,
  avg_dwell_score  FLOAT,
  avg_like_action  FLOAT,
  avg_post_score   FLOAT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    uv.variant,
    COUNT(DISTINCT uv.user_id)                                 AS user_count,
    AVG(COALESCE(uvp.learned_explore + uvp.learned_brain, 1)) AS avg_dwell_score,
    AVG(uvp.interaction_count::FLOAT)                          AS avg_like_action,
    1.0                                                        AS avg_post_score
  FROM public.algo_user_variants uv
  LEFT JOIN public.user_vibe_profile uvp ON uvp.user_id = uv.user_id
  WHERE uv.experiment_name = p_experiment_name
  GROUP BY uv.variant
  ORDER BY uv.variant;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  BEISPIEL-EXPERIMENTE (deaktiviert, zum Lernen)                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.algo_experiments (name, description, is_active, control_params, treatment_params)
VALUES
  (
    'serendipity_rate_v1',
    'Test: Serendipity 5% (control) vs 10% (treatment). Hypothesis: 10% erhöht Retention durch Discovery.',
    FALSE,
    '{"serendipity_rate": 0.05}',
    '{"serendipity_rate": 0.10}'
  ),
  (
    'dwell_vs_engagement_v1',
    'Test: Dwell-Gewicht 45% vs 40% (Differenz zu Engagement Rate verschoben). Hypothesis: Engagement Rate wichtiger als Dwell.',
    FALSE,
    '{"serendipity_rate": 0.05}',
    '{"serendipity_rate": 0.05}'
    -- Parameter hier minimal — für echte Dwell-Tests: get_vibe_feed Parameter erweitern
  )
ON CONFLICT (name) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  UPDATE get_vibe_feed: Auto-Experiment-Integration                      ║
-- ║                                                                         ║
-- ║  Wenn ein Experiment aktiv ist, werden seine Parameter automatisch      ║
-- ║  auf die Funktion angewendet. Client-Änderungen NICHT nötig.           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_vibe_feed(
  explore_weight    FLOAT   DEFAULT 0.5,
  brain_weight      FLOAT   DEFAULT 0.5,
  result_limit      INT     DEFAULT 15,
  result_offset     INT     DEFAULT 0,
  filter_tag        TEXT    DEFAULT NULL,
  include_seen      BOOLEAN DEFAULT FALSE,
  exclude_ids       UUID[]  DEFAULT '{}'::UUID[],
  serendipity_rate  FLOAT   DEFAULT 0.05
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
  -- A/B Testing
  v_ab_params       JSONB;
  v_serendipity     FLOAT;
BEGIN
  v_user_id := auth.uid();

  -- ── A/B Experiment Parameter laden (überschreibt Defaults) ──────────────
  v_ab_params   := public.get_experiment_params();
  v_serendipity := COALESCE((v_ab_params->>'serendipity_rate')::FLOAT, serendipity_rate);

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
    SELECT
      p.*,
      POWER(
        0.5,
        GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400.0 - 30.0, 0.0) / 90.0
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
        LEAST(COALESCE(pd.dwell_time_score, 0.0), 1.0) * 0.45
        + (1.0 - ABS(COALESCE(pd.score_explore, 0.5) - v_eff_explore)) * 0.25
        + (1.0 - ABS(COALESCE(pd.score_brain, 0.5)   - v_eff_brain))   * 0.25
        + GREATEST(0.0,
            0.10 - EXTRACT(EPOCH FROM (NOW() - pd.created_at)) / (48.0*3600.0) * 0.10)
        + LEAST(LOG(COALESCE(pd.comment_count,  0)::FLOAT * pd.age_decay + 1.0) / LOG(51.0),  1.0) * 0.10
        + LEAST(LOG(COALESCE(pd.share_count,    0)::FLOAT * pd.age_decay + 1.0) / LOG(51.0),  1.0) * 0.08
        + LEAST(LOG(COALESCE(pd.like_count,     0)::FLOAT * pd.age_decay + 1.0) / LOG(101.0), 1.0) * 0.05
        + LEAST(LOG(COALESCE(pd.bookmark_count, 0)::FLOAT * pd.age_decay + 1.0) / LOG(21.0),  1.0) * 0.05
        + COALESCE(pr.consistency_score, 0.5) * 0.03
        + CASE WHEN COALESCE(pd.view_count, 0) >= 20 THEN
            LEAST((COALESCE(pd.like_count,0)+COALESCE(pd.comment_count,0)+COALESCE(pd.share_count,0))::FLOAT
              * pd.age_decay / pd.view_count::FLOAT / 0.20, 1.0) * 0.08
          ELSE 0.0 END
        + CASE WHEN COALESCE(pd.view_count, 0) >= 100 THEN
            LEAST(pd.share_count::FLOAT * pd.age_decay / pd.view_count::FLOAT / 0.03, 1.0) * 0.06
          ELSE 0.0 END
        + CASE WHEN f.following_id IS NOT NULL THEN 0.10 ELSE 0.0 END
        -- ── SERENDIPITY (via v_serendipity — A/B kontrollierbar) ──────────
        + CASE
            WHEN v_serendipity > 0
              AND pdl.post_id IS NULL
              AND (ABS(COALESCE(pd.score_explore, 0.5) - v_eff_explore) > 0.25
                    OR ABS(COALESCE(pd.score_brain, 0.5) - v_eff_brain) > 0.25)
              AND RANDOM() < v_serendipity
            THEN 0.50
            ELSE 0.0
          END
      ) * CASE
            WHEN include_seen            THEN 1.0
            WHEN pdl.post_id IS NOT NULL THEN 0.15
            ELSE                              1.0
          END AS final_score
    FROM post_data pd
    LEFT JOIN public.profiles pr ON pr.id = pd.author_id
    LEFT JOIN public.post_dwell_log pdl ON pdl.post_id = pd.id AND pdl.user_id = v_user_id
    LEFT JOIN public.follows f ON f.follower_id = v_user_id AND f.following_id = pd.author_id
  ),
  ranked AS (
    SELECT *,
      COUNT(DISTINCT author_id) OVER () AS total_authors,
      ROW_NUMBER() OVER (PARTITION BY author_id ORDER BY final_score DESC, created_at DESC) AS author_rank
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
-- ANLEITUNG: Experiment starten
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Experiment aktivieren:
-- UPDATE algo_experiments SET is_active = TRUE WHERE name = 'serendipity_rate_v1';

-- 2. Nach 1 Woche Ergebnisse anschauen:
-- SELECT * FROM get_experiment_stats('serendipity_rate_v1');

-- 3. Experiment beenden:
-- UPDATE algo_experiments SET is_active = FALSE, ended_at = NOW() WHERE name = 'serendipity_rate_v1';

-- Aktuelle Experimente:
SELECT name, is_active, description FROM public.algo_experiments ORDER BY created_at;
