-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Passives User-Lernprofil v1
--
-- Ziel: Session-Time maximieren durch automatisches Lernen aus Verhalten.
-- Der Algorithmus lernt passiv was jedem User gefällt — ohne manuellen Slider.
--
-- Ausführungsreihenfolge:
--   1. algorithm_production.sql (Basis)
--   2. DIESE DATEI (user_learning_profile.sql)
--
-- Wie es funktioniert:
--   Jede Interaktion (Bookmark, Like, Dwell) zieht das User-Profil
--   in Richtung des konsumierten Contents — wie ein Magnet.
--   Je mehr Interaktionen, desto mehr vertraut der Feed dem Lernprofil
--   statt dem manuellen Slider (70% Lernprofil nach 20+ Interaktionen).
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 1 — Tabelle: user_vibe_profile                                 ║
-- ║  Speichert das gelernte Präferenz-Profil pro User                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.user_vibe_profile (
  user_id           UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  learned_explore   FLOAT       NOT NULL DEFAULT 0.5,  -- 0=Vertraut, 1=Explorativ
  learned_brain     FLOAT       NOT NULL DEFAULT 0.5,  -- 0=Entertainment, 1=Lehrreich
  interaction_count INT         NOT NULL DEFAULT 0,    -- Gesamt-Interaktionen (Dwell+Like+Bookmark)
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_vibe_profile ENABLE ROW LEVEL SECURITY;

-- Jeder User sieht nur sein eigenes Profil
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_vibe_profile' AND policyname = 'Users manage own vibe profile'
  ) THEN
    CREATE POLICY "Users manage own vibe profile"
      ON public.user_vibe_profile FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_vibe_profile_user
  ON public.user_vibe_profile (user_id);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 2 — Hilfsfunktion: _learn_from_post                            ║
-- ║  Kern des Lernmechanismus: EMA-Update des User-Profils                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Formel (Exponential Moving Average):
--   learned = learned × (1 - alpha) + post_score × alpha
--
-- Lernraten (alpha):
--   Bookmark  0.12  — stärkstes Signal ("will ich behalten")
--   Like      0.08  — klares explizites Signal
--   Dwell     0.0–0.05 — passiv, skaliert mit Betrachtungszeit

CREATE OR REPLACE FUNCTION public._learn_from_post(
  p_user_id UUID,
  p_post_id UUID,
  p_alpha   FLOAT   -- Lernrate: 0.01 (schwach) bis 0.15 (stark)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_explore FLOAT;
  v_brain   FLOAT;
BEGIN
  -- Post-Koordinaten im Vibe-Raum laden
  SELECT
    COALESCE(score_explore, 0.5),
    COALESCE(score_brain,   0.5)
  INTO v_explore, v_brain
  FROM public.posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN RETURN; END IF;  -- Post existiert nicht mehr

  -- Lernrate auf sicheres Intervall begrenzen
  p_alpha := LEAST(GREATEST(p_alpha, 0.0), 0.15);

  -- User-Profil in Richtung Post-Vibe ziehen (EMA)
  INSERT INTO public.user_vibe_profile (user_id, learned_explore, learned_brain, interaction_count, updated_at)
  VALUES (
    p_user_id,
    ROUND(v_explore::NUMERIC, 4),
    ROUND(v_brain::NUMERIC,   4),
    1,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    learned_explore   = ROUND((
      user_vibe_profile.learned_explore * (1.0 - p_alpha)
      + v_explore * p_alpha
    )::NUMERIC, 4),
    learned_brain     = ROUND((
      user_vibe_profile.learned_brain * (1.0 - p_alpha)
      + v_brain * p_alpha
    )::NUMERIC, 4),
    interaction_count = user_vibe_profile.interaction_count + 1,
    updated_at        = NOW();

END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 3 — update_dwell_time (ersetzt Version aus production.sql)     ║
-- ║  Neu: ruft _learn_from_post auf wenn Dwell bedeutungsvoll ist           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Lernrate steigt mit Betrachtungszeit:
--   5s  → alpha = 0.004  (fast nix)
--   15s → alpha = 0.012
--   30s → alpha = 0.025
--   60s → alpha = 0.050  (Maximum fürs Lernen)
--
-- Schwellwert fürs Lernen: > 5000ms (5 Sekunden)
-- Darunter: Dwell-Score wird trotzdem aktualisiert, aber kein Lernen

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

  -- Gaming-Guard: Log abfragen
  SELECT last_seen, view_count
  INTO   v_last_seen, v_view_count
  FROM   public.post_dwell_log
  WHERE  user_id = v_user_id AND post_id = update_dwell_time.post_id;

  -- Guard 1: < 60 Minuten seit letztem gültigen Update → abweisen
  IF v_last_seen IS NOT NULL
     AND v_last_seen > NOW() - INTERVAL '60 minutes' THEN
    RETURN;
  END IF;

  -- Guard 2: Max 5 Updates pro User/Post
  IF v_view_count IS NOT NULL AND v_view_count >= 5 THEN
    RETURN;
  END IF;

  -- Observation normalisieren: 0ms–60s → 0.0–1.0
  v_observation := LEAST(GREATEST(dwell_ms, 0), 60000)::FLOAT / 60000.0;

  -- ── Post-Score updaten (EMA wie bisher) ──────────────────────────────────
  UPDATE public.posts
  SET dwell_time_score = LEAST(
    COALESCE(dwell_time_score, 0) * 0.75 + v_observation * 0.25,
    1.0
  )
  WHERE id = post_id;

  -- ── Gaming-Log updaten ───────────────────────────────────────────────────
  INSERT INTO public.post_dwell_log (user_id, post_id, last_seen, view_count)
  VALUES (v_user_id, post_id, NOW(), 1)
  ON CONFLICT (user_id, post_id) DO UPDATE SET
    last_seen  = NOW(),
    view_count = post_dwell_log.view_count + 1;

  -- ── NEU: User-Lernprofil aktualisieren (nur bei >= 5 Sekunden) ───────────
  -- Lernrate proportional zur Betrachtungszeit (max 0.05 bei 60s)
  IF dwell_ms >= 5000 THEN
    v_learn_alpha := LEAST(dwell_ms::FLOAT / 60000.0, 1.0) * 0.05;
    PERFORM public._learn_from_post(v_user_id, post_id, v_learn_alpha);
  END IF;

END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 4 — Trigger: Likes & Bookmarks → Lernprofil                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Like-Trigger ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._on_like_learn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Like = starkes Signal (alpha 0.08)
  PERFORM public._learn_from_post(NEW.user_id, NEW.post_id, 0.08);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_like_learn ON public.likes;
CREATE TRIGGER trg_like_learn
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public._on_like_learn();


-- ── Bookmark-Trigger ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._on_bookmark_learn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bookmark = stärkstes Signal (alpha 0.12) — User will den Content behalten
  PERFORM public._learn_from_post(NEW.user_id, NEW.post_id, 0.12);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookmark_learn ON public.bookmarks;
CREATE TRIGGER trg_bookmark_learn
  AFTER INSERT ON public.bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION public._on_bookmark_learn();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 5 — get_vibe_feed (neue Version mit Lernprofil + Pagination)   ║
-- ║  ERSETZT BEIDE: algorithm_production.sql UND vibe_feed_pagination.sql   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Blend-Formel:
--   learn_weight = MIN(interaction_count / 20, 0.70)
--   effective    = slider × (1 - learn_weight) + learned × learn_weight
--
-- 0 Interaktionen → 100% Slider (kein Profil vorhanden)
-- 10 Interaktionen → 50% Slider / 50% Lernprofil
-- 20+ Interaktionen → 30% Slider / 70% Lernprofil
--
-- Slider verliert NIE seinen gesamten Einfluss — User-Kontrolle bleibt.
--
-- Scoring-Formel (max 1.10, unverändert):
--   Dwell     × 0.45
--   Explore   × 0.25 (jetzt mit gelernten Gewichten)
--   Brain     × 0.25 (jetzt mit gelernten Gewichten)
--   Freshness ≤ 0.15

CREATE OR REPLACE FUNCTION public.get_vibe_feed(
  explore_weight FLOAT   DEFAULT 0.5,   -- Slider-Wert (vom Client)
  brain_weight   FLOAT   DEFAULT 0.5,   -- Slider-Wert (vom Client)
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

  -- ── Lernprofil laden (falls vorhanden) ───────────────────────────────────
  SELECT learned_explore, learned_brain, interaction_count
  INTO   v_learned_explore, v_learned_brain, v_interactions
  FROM   public.user_vibe_profile
  WHERE  user_id = v_user_id;

  -- ── Blend: Slider × (1 - lerngewicht) + Lernprofil × lerngewicht ─────────
  -- 0 Interaktionen → 100% Slider; 20+ Interaktionen → 70% Lernprofil
  v_learn_weight := LEAST(COALESCE(v_interactions, 0)::FLOAT / 20.0, 0.70);

  v_eff_explore := explore_weight * (1.0 - v_learn_weight)
                 + COALESCE(v_learned_explore, explore_weight) * v_learn_weight;

  v_eff_brain   := brain_weight * (1.0 - v_learn_weight)
                 + COALESCE(v_learned_brain, brain_weight) * v_learn_weight;

  -- Auf [0, 1] klemmen (defensiv)
  v_eff_explore := LEAST(GREATEST(v_eff_explore, 0.0), 1.0);
  v_eff_brain   := LEAST(GREATEST(v_eff_brain,   0.0), 1.0);

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
        -- Dwell: 45% — dominantes Qualitäts-Signal
        LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45

        -- Explore-Match: 25% — mit gelernten Gewichten
        + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - v_eff_explore)) * 0.25

        -- Brain-Match: 25% — mit gelernten Gewichten
        + (1.0 - ABS(COALESCE(p.score_brain, 0.5) - v_eff_brain)) * 0.25

        -- Freshness: bis 15% — Cold-Start-Boost für neue Posts (linear 0–48h)
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
  -- Author-Diversity Guard: dynamisch (nicht hardcoded 2!)
  WHERE author_rank <= GREATEST(2, CEIL(result_limit::FLOAT / NULLIF(total_authors, 0))::INT)
  ORDER BY final_score DESC NULLS LAST, created_at DESC
  LIMIT  result_limit
  OFFSET result_offset;

END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHRITT 6 — Backfill: Profile für bestehende User anlegen              ║
-- ║  Berechnet initiales Lernprofil aus bisherigen Likes                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Für User die bereits Likes gegeben haben: initiales Profil aus Like-History ableiten
-- (damit das Lernprofil nicht bei 0.5/0.5 startet für echte User)

INSERT INTO public.user_vibe_profile (user_id, learned_explore, learned_brain, interaction_count, updated_at)
SELECT
  l.user_id,
  ROUND(AVG(COALESCE(p.score_explore, 0.5))::NUMERIC, 4) AS learned_explore,
  ROUND(AVG(COALESCE(p.score_brain,   0.5))::NUMERIC, 4) AS learned_brain,
  COUNT(*) AS interaction_count,
  NOW()    AS updated_at
FROM public.likes l
JOIN public.posts p ON p.id = l.post_id
GROUP BY l.user_id
ON CONFLICT (user_id) DO UPDATE SET
  learned_explore   = EXCLUDED.learned_explore,
  learned_brain     = EXCLUDED.learned_brain,
  interaction_count = EXCLUDED.interaction_count,
  updated_at        = NOW();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFIKATION                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT
  '══ USER LEARNING PROFILE STATUS ══'                              AS check_name, '' AS value
UNION ALL SELECT 'User-Profile angelegt',    COUNT(*)::TEXT         FROM public.user_vibe_profile
UNION ALL SELECT 'Ø gelernte Explore-Pref',  ROUND(AVG(learned_explore)::NUMERIC,3)::TEXT FROM public.user_vibe_profile
UNION ALL SELECT 'Ø gelernte Brain-Pref',    ROUND(AVG(learned_brain)::NUMERIC,3)::TEXT   FROM public.user_vibe_profile
UNION ALL SELECT 'Ø Interaktionen/User',     ROUND(AVG(interaction_count)::NUMERIC,1)::TEXT FROM public.user_vibe_profile
UNION ALL SELECT 'Max Interaktionen',        MAX(interaction_count)::TEXT                  FROM public.user_vibe_profile
UNION ALL SELECT 'Like-Trigger aktiv',       'trg_like_learn'      AS value
UNION ALL SELECT 'Bookmark-Trigger aktiv',   'trg_bookmark_learn'  AS value;
