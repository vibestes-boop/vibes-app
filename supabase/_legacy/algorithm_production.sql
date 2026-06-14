-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Algorithm PRODUCTION v2 (Basis-Datei)
-- Enthält: Gaming-Resistenz, Diversity, Freshness, Decay, Leaderboard
--
-- AUSFÜHRUNGSREIHENFOLGE:
--   1. DIESE DATEI (algorithm_production.sql) — Basis
--   2. user_learning_profile.sql             — Passiver Lern-Loop (DANACH ausführen)
--      → Überschreibt: update_dwell_time + get_vibe_feed mit Lernprofil-Logik
--
-- Alle anderen algorithm_*.sql sind obsolet.
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 0 — Gaming-Log Tabelle (Voraussetzung für update_dwell_time)   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.post_dwell_log (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id    UUID        NOT NULL REFERENCES public.posts(id)    ON DELETE CASCADE,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count INT         NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.post_dwell_log ENABLE ROW LEVEL SECURITY;

-- Policy: jeder User verwaltet nur seine eigenen Einträge
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'post_dwell_log' AND policyname = 'Users manage own dwell log'
  ) THEN
    CREATE POLICY "Users manage own dwell log"
      ON public.post_dwell_log FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dwell_log_user_post
  ON public.post_dwell_log (user_id, post_id);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FUNKTION 1 — update_dwell_time                                         ║
-- ║  EMA-Score mit Gaming-Schutz (auth.uid + 60min-Guard + Max-5-Views)     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- EMA-Formel: score = score * 0.75 + observation * 0.25  (α = 0.25)
-- Cap:        Score niemals > 1.0, niemals < 0
-- Gaming:     Pro User/Post max 1 Update/Stunde, max 5 Updates gesamt
--
-- Alle bisherigen Fixes eingebaut:
--   COALESCE  → NULL-EMA-Bug behoben (erster View bricht nicht)
--   GREATEST  → negativer dwell_ms wird auf 0 gesetzt (Clock-Drift-Schutz)
--   LEAST×2   → dwell_ms cap 60s + score cap 1.0

CREATE OR REPLACE FUNCTION update_dwell_time(post_id UUID, dwell_ms INTEGER)
RETURNS VOID AS $$
DECLARE
  v_user_id     UUID;
  v_last_seen   TIMESTAMPTZ;
  v_view_count  INT;
  v_observation FLOAT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;  -- Anonym → ignorieren

  SELECT last_seen, view_count
  INTO   v_last_seen, v_view_count
  FROM   public.post_dwell_log
  WHERE  user_id = v_user_id AND post_id = update_dwell_time.post_id;

  -- Guard 1: < 60 Minuten seit letztem gültigen Update → abweisen
  IF v_last_seen IS NOT NULL
     AND v_last_seen > NOW() - INTERVAL '60 minutes' THEN
    RETURN;
  END IF;

  -- Guard 2: Max 5 Updates pro User/Post (danach kein Einfluss mehr)
  IF v_view_count IS NOT NULL AND v_view_count >= 5 THEN
    RETURN;
  END IF;

  v_observation := LEAST(GREATEST(dwell_ms, 0), 60000)::FLOAT / 60000.0;

  UPDATE public.posts
  SET dwell_time_score = LEAST(
    COALESCE(dwell_time_score, 0) * 0.75 + v_observation * 0.25,
    1.0
  )
  WHERE id = post_id;

  INSERT INTO public.post_dwell_log (user_id, post_id, last_seen, view_count)
  VALUES (v_user_id, post_id, NOW(), 1)
  ON CONFLICT (user_id, post_id)
  DO UPDATE SET
    last_seen  = NOW(),
    view_count = post_dwell_log.view_count + 1;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FUNKTION 2 — get_vibe_feed                                             ║
-- ║  Personalisierter Feed: Dwell + Slider + Freshness + Author-Diversity   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Scoring-Formel (max 1.10):
--   Dwell     × 0.45   — EMA aus echten Views (dominantes Signal)
--   Explore   × 0.25   — Match: Post-Charakter vs User-Slider
--   Brain     × 0.25   — Match: Post-Charakter vs User-Slider
--   Freshness ≤ 0.15   — Linearer Decay über 48h (Cold-Start-Lösung)
--
-- Author-Diversity: GREATEST(2, CEIL(limit / unique_authors))
--   → 3 Autoren / limit 20 → max 7 Posts/Autor
--   → 10 Autoren / limit 20 → max 2 Posts/Autor
--
-- Alle Fixes eingebaut:
--   COALESCE     → NULL-Scores zerstören keine final_score-Berechnung
--   NULLS LAST   → PostgreSQL DESC sortiert NULLs sonst nach oben
--   IS NOT TRUE  → schließt NULL is_guild_post korrekt ein
--   filter_tag   → Tag-Filter im RPC (kein Frontend-Bypass mehr)

CREATE OR REPLACE FUNCTION get_vibe_feed(
  explore_weight FLOAT DEFAULT 0.5,
  brain_weight   FLOAT DEFAULT 0.5,
  result_limit   INT   DEFAULT 20,
  filter_tag     TEXT  DEFAULT NULL
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
  WITH

  scored AS (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0)  AS dwell_capped,
      COALESCE(p.score_explore, 0.5)                  AS score_explore_safe,
      COALESCE(p.score_brain,   0.5)                  AS score_brain_safe,
      p.tags,
      p.guild_id,
      p.is_guild_post,
      p.created_at,
      pr.username,
      pr.avatar_url,
      (
        LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45
        + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - explore_weight)) * 0.25
        + (1.0 - ABS(COALESCE(p.score_brain,   0.5) - brain_weight))   * 0.25
        + GREATEST(
            0.0,
            0.15 - EXTRACT(EPOCH FROM (NOW() - p.created_at))
                   / (48.0 * 3600.0) * 0.15
          )
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
  LIMIT result_limit;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FUNKTION 3 — get_guild_leaderboard                                     ║
-- ║  Top 10 Posts + Mitglieder einer Guild nach Dwell-Time                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION get_guild_leaderboard(p_guild_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
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
      LEAST(COALESCE(p.dwell_time_score, 0), 1.0)                           AS dwell_time_score,
      ROUND((LEAST(COALESCE(p.dwell_time_score, 0), 1.0) * 60)::NUMERIC, 1)  AS avg_seconds,
      ROUND((LEAST(COALESCE(p.dwell_time_score, 0), 1.0) * 100)::NUMERIC, 0) AS completion_pct,
      p.created_at,
      pr.id         AS author_id,
      pr.username   AS author_username,
      pr.avatar_url AS author_avatar
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    WHERE pr.guild_id = p_guild_id::UUID
      AND p.created_at > NOW() - INTERVAL '7 days'
    ORDER BY COALESCE(p.dwell_time_score, 0) DESC NULLS LAST, p.created_at DESC
    LIMIT 10
  ) t;

  SELECT jsonb_agg(row_to_json(t)) INTO v_top_members
  FROM (
    SELECT
      pr.id,
      pr.username,
      pr.avatar_url,
      COUNT(p.id)                                                                     AS post_count,
      ROUND(AVG(LEAST(COALESCE(p.dwell_time_score, 0), 1.0))::NUMERIC, 3)           AS avg_dwell_score,
      ROUND((AVG(LEAST(COALESCE(p.dwell_time_score, 0), 1.0)) * 100)::NUMERIC, 0)   AS avg_completion_pct,
      MAX(LEAST(COALESCE(p.dwell_time_score, 0), 1.0))                               AS best_score
    FROM public.profiles pr
    JOIN public.posts p ON p.author_id = pr.id
    WHERE pr.guild_id = p_guild_id::UUID
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


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FUNKTION 4 — decay_dwell_scores                                        ║
-- ║  Wöchentlicher Score-Decay (verhindert Zombie-Post-Dominanz)            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Posts > 7 Tage alt verlieren 10% Score pro Woche:
--   Woche 1: 0.90  → Woche 4: 0.66  → Woche 12: 0.28
-- Aufruf: manuell oder via pg_cron (jeden Montag 03:00 UTC)
-- pg_cron aktivieren: Supabase Dashboard → Database → Extensions → pg_cron
-- Schedule: SELECT cron.schedule('weekly-decay', '0 3 * * 1', 'SELECT decay_dwell_scores();');

CREATE OR REPLACE FUNCTION decay_dwell_scores()
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET dwell_time_score = ROUND((dwell_time_score * 0.90)::NUMERIC, 4)
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND dwell_time_score > 0.05;

  RAISE NOTICE 'Score decay applied at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DATEN-MIGRATION                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Scores > 1.0 kappen
UPDATE public.posts SET dwell_time_score = 1.0  WHERE dwell_time_score > 1.0;
-- Score NULL → 0
UPDATE public.posts SET dwell_time_score = 0.0  WHERE dwell_time_score IS NULL;
-- Tags lowercase normalisieren
UPDATE public.posts
SET tags = ARRAY(SELECT lower(trim(t)) FROM unnest(tags) t)
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;
-- score_brain / score_explore via Trigger neu berechnen
UPDATE public.posts SET tags = tags
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFIKATION                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT
  '══ VIBES ALGORITHM STATUS ══'                                    AS check_name, '' AS value
UNION ALL SELECT 'Total Posts',             COUNT(*)::TEXT          FROM public.posts
UNION ALL SELECT 'Im Feed (IS NOT TRUE)',   COUNT(*)::TEXT          FROM public.posts WHERE is_guild_post IS NOT TRUE
UNION ALL SELECT 'Guild-Only',              COUNT(*)::TEXT          FROM public.posts WHERE is_guild_post IS TRUE
UNION ALL SELECT '⚠ Score IS NULL',         COUNT(*)::TEXT          FROM public.posts WHERE dwell_time_score IS NULL
UNION ALL SELECT '⚠ Score > 1.0',           COUNT(*)::TEXT          FROM public.posts WHERE dwell_time_score > 1.0
UNION ALL SELECT 'Cold-Start (score=0)',     COUNT(*)::TEXT          FROM public.posts WHERE dwell_time_score = 0
UNION ALL SELECT 'Aktive Posts (score>0)',   COUNT(*)::TEXT          FROM public.posts WHERE dwell_time_score > 0
UNION ALL SELECT 'Max Score (≤1.0)',         ROUND(MAX(COALESCE(dwell_time_score,0))::NUMERIC,4)::TEXT FROM public.posts
UNION ALL SELECT 'Ø Score',                  ROUND(AVG(COALESCE(dwell_time_score,0))::NUMERIC,4)::TEXT FROM public.posts
UNION ALL SELECT 'Frisch < 48h',             COUNT(*)::TEXT          FROM public.posts WHERE created_at > NOW() - INTERVAL '48 hours'
UNION ALL SELECT 'Posts mit Tags',           COUNT(*)::TEXT          FROM public.posts WHERE tags IS NOT NULL AND array_length(tags,1)>0
UNION ALL SELECT '⚠ score_explore IS NULL',  COUNT(*)::TEXT          FROM public.posts WHERE score_explore IS NULL
UNION ALL SELECT '⚠ score_brain IS NULL',    COUNT(*)::TEXT          FROM public.posts WHERE score_brain IS NULL
UNION ALL SELECT 'Gaming-Log Einträge',      COUNT(*)::TEXT          FROM public.post_dwell_log;
