-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Feed-Algorithmus v5 (Lebendig + Fair + Persönlich)
-- Datum: 2026-07-04
--
-- Behebt die drei toten Kreisläufe aus v4 und ergänzt echte Personalisierung.
-- Signatur von get_vibe_feed ist IDENTISCH zu v4 → kein Client-Bruch.
--
--   FIX 1  Seen-Gedächtnis: v4 las `seen_posts` — eine Tabelle, in die NICHTS
--          jemals schreibt. Geschrieben wird (seit Legacy) `post_dwell_log`
--          (Dwell ≥2s via update_dwell_time, Skips via record_skip). v5 liest
--          post_dwell_log und wendet einen WEICHEN Penalty an (Score × 0.15)
--          statt hartem Filter → Feed leert sich nie, Gesehenes rutscht nach
--          hinten. include_seen=TRUE deaktiviert den Penalty (Client-Fallback).
--
--   FIX 2  record_skip war ein POSITIV-Signal: es zählte view_count hoch
--          (+Popularity-Boost!) und schrieb in user_vibe_profile, das seit v4
--          niemand mehr liest. Jetzt: echtes Negativ-Signal (dwell_time_score
--          × 0.97, nur beim ersten Skip pro User) + Seen-Markierung. Kein
--          view_count++, keine toten Lernprofil-Writes mehr.
--
--   FIX 3  decay_dwell_scores() existierte, war aber nie per pg_cron geplant →
--          Dwell-Scores verfielen nie, Alt-Posts dominierten ewig. Jetzt
--          nächtlich 03:00 (−10 % ab Tag 7).
--
--   NEU 4  Jitter: ORDER BY final_score × (0.85 + random()·0.30) — jeder
--          App-Start fühlt sich anders an, Top-Content bleibt trotzdem vorn.
--
--   NEU 5  Cold-Start-Boost (statt Slot-Reservierung — einfacher & glatter):
--          Posts < 14 Tage mit wenig Reichweite bekommen bis zu +0.20, linear
--          abschmelzend über die ersten 20 Views. Jeder Post bekommt ein
--          Startpublikum (TikTok-Prinzip), neue Creator sind nicht chancenlos.
--
--   NEU 6  Wilson-Popularity: statt roher view/like-Counts (Rich-get-richer)
--          jetzt Like-RATE (likes/views) als Wilson-Lower-Bound → „ist gut"
--          schlägt „wurde oft gezeigt".
--
--   NEU 7  Tag-Affinität: user_tag_affinity (nächtlich aus Likes + Dwell
--          aggregiert, Top 20 Tags/User) → +0.12 × beste Tag-Übereinstimmung.
--          Ersetzt das tote user_vibe_profile durch lesbares, echtes Lernen.
--
--   NEU 8  Community-/Commerce-Boosts: Autor in meiner Guild (+0.05),
--          DM-Kontakt (+0.04), Shoppable Post (+0.02).
--
-- Gewichte v5 (relativ, Summe muss nicht 1 sein):
--   Dwell 0.35 · Following 0.15 · Freshness(72h) 0.12 · Tag-Affinität 0.12 ·
--   Explore-Match 0.08 · Brain-Match 0.05 · Wilson-Pop 0.06 · WOZ 0.05 ·
--   Cold-Start ≤0.20 · Guild 0.05 · DM 0.04 · Shoppable 0.02
--   → danach Seen-Penalty ×0.15 (falls gesehen & !include_seen), Jitter im Sort.
-- ══════════════════════════════════════════════════════════════════════════════


-- ─── 1. Tag-Affinitäts-Tabelle ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_tag_affinity (
  user_id    uuid  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag        text  NOT NULL,
  affinity   float NOT NULL DEFAULT 0,   -- 0..1, normalisiert pro User
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag)
);

ALTER TABLE public.user_tag_affinity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_tag_affinity_select_own" ON public.user_tag_affinity;
CREATE POLICY "user_tag_affinity_select_own"
  ON public.user_tag_affinity FOR SELECT
  USING (auth.uid() = user_id);
-- Kein INSERT/UPDATE/DELETE für Clients — nur die Refresh-Funktion schreibt.

GRANT SELECT ON public.user_tag_affinity TO authenticated;


-- ─── 2. Nächtliche Affinitäts-Aggregation ────────────────────────────────────
-- Voll-Rebuild (bei aktueller Größe trivial billig). Signale der letzten 90
-- Tage: Like = 1.0, Dwell ≥2s = 0.5. Affinität = Anteil am stärksten Tag des
-- Users (0..1). Nur Top 20 Tags pro User (Cap gegen Wildwuchs).

CREATE OR REPLACE FUNCTION public.refresh_user_tag_affinity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_tag_affinity;

  INSERT INTO public.user_tag_affinity (user_id, tag, affinity, updated_at)
  SELECT user_id, tag, affinity, now()
  FROM (
    SELECT
      s.user_id,
      s.tag,
      (s.weight / MAX(s.weight) OVER (PARTITION BY s.user_id))::float AS affinity,
      ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.weight DESC) AS rn
    FROM (
      SELECT eng.user_id, t.tag, SUM(eng.w) AS weight
      FROM (
        -- Likes (stärkstes explizites Signal)
        SELECT l.user_id, l.post_id, 1.0::float AS w
        FROM public.likes l
        WHERE l.created_at > now() - INTERVAL '90 days'
        UNION ALL
        -- Echte Dwells ≥ 2s (Skips haben last_dwell_ms NULL → fallen raus)
        SELECT d.user_id, d.post_id, 0.5::float AS w
        FROM public.post_dwell_log d
        WHERE d.last_dwell_ms >= 2000
          AND COALESCE(d.observed_at, d.last_seen) > now() - INTERVAL '90 days'
      ) eng
      JOIN public.posts p ON p.id = eng.post_id
      CROSS JOIN LATERAL unnest(COALESCE(p.tags, '{}')) AS t(tag)
      GROUP BY eng.user_id, t.tag
    ) s
  ) ranked
  WHERE ranked.rn <= 20;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_user_tag_affinity() FROM PUBLIC, anon, authenticated;


-- ─── 3. record_skip v2: echtes Negativ-Signal ────────────────────────────────
-- Vorher: view_count++ (machte geskippte Posts BESSER im Ranking!) + Writes in
-- das seit v4 ungelesene user_vibe_profile. Jetzt: Seen-Markierung (wichtig für
-- den v5-Penalty) + kleiner Dwell-Malus beim ERSTEN Skip pro (User, Post).

CREATE OR REPLACE FUNCTION public.record_skip(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rows    int;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Als gesehen markieren — nur der erste Kontakt zählt (Dedup wie gehabt)
  INSERT INTO public.post_dwell_log (user_id, post_id, last_seen, view_count)
  VALUES (v_user_id, p_post_id, NOW(), 0)
  ON CONFLICT (user_id, post_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Negativ-Signal: erster Skip senkt den Dwell-Score leicht (−3 %).
  -- Bewusst mild — ein Skip ist schwaches Signal, viele Skips summieren sich.
  IF v_rows > 0 THEN
    UPDATE public.posts
       SET dwell_time_score = GREATEST(0, COALESCE(dwell_time_score, 0) * 0.97)
     WHERE id = p_post_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_skip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_skip(uuid) TO authenticated;


-- ─── 4. get_vibe_feed v5 ─────────────────────────────────────────────────────
-- Signatur + RETURNS TABLE identisch zu v4. #variable_conflict use_column ist
-- PFLICHT (42702-Lehre vom 1.7.): RETURNS-TABLE-Namen kollidieren sonst mit
-- Spalten in PARTITION BY / ORDER BY / finalem SELECT.

CREATE OR REPLACE FUNCTION public.get_vibe_feed(
  explore_weight double precision DEFAULT 0.5,
  brain_weight   double precision DEFAULT 0.5,
  result_limit   integer          DEFAULT 20,
  filter_tag     text             DEFAULT NULL,
  include_seen   boolean          DEFAULT false,
  exclude_ids    uuid[]           DEFAULT '{}'::uuid[]
) RETURNS TABLE(
  id uuid, author_id uuid, caption text, media_url text, media_type text,
  thumbnail_url text, audio_url text, dwell_time_score double precision,
  score_explore double precision, score_brain double precision, tags text[],
  guild_id uuid, is_guild_post boolean, created_at timestamp with time zone,
  privacy text, allow_comments boolean, allow_download boolean,
  allow_duet boolean, username text, avatar_url text, is_verified boolean,
  final_score double precision
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
#variable_conflict use_column
DECLARE
  v_user_id         UUID;
  v_is_woz_verified BOOLEAN := FALSE;
  v_my_guild        UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT (gender = 'female' AND women_only_verified = TRUE), profiles.guild_id
      INTO v_is_woz_verified, v_my_guild
      FROM public.profiles
     WHERE profiles.id = v_user_id;
  END IF;

  RETURN QUERY
  WITH

  -- ── Gesehene Posts: DIE Tabelle, in die Dwell + Skip wirklich schreiben ──
  seen_ids AS (
    SELECT post_id
    FROM public.post_dwell_log
    WHERE user_id = v_user_id
      AND v_user_id IS NOT NULL
  ),

  following_ids AS (
    SELECT following_id
    FROM public.follows
    WHERE follower_id = v_user_id
      AND v_user_id IS NOT NULL
  ),

  -- ── DM-Kontakte: enge Beziehungen leicht bevorzugen ──
  dm_ids AS (
    SELECT CASE WHEN c.participant_1 = v_user_id
                THEN c.participant_2 ELSE c.participant_1 END AS uid
    FROM public.conversations c
    WHERE v_user_id IS NOT NULL
      AND v_user_id IN (c.participant_1, c.participant_2)
  ),

  scored AS (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      p.thumbnail_url,
      p.audio_url,
      LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0)  AS dwell_capped,
      COALESCE(p.score_explore, 0.5)                  AS score_explore,
      COALESCE(p.score_brain,   0.5)                  AS score_brain,
      p.tags,
      p.guild_id,
      p.is_guild_post,
      p.created_at,
      COALESCE(p.privacy, 'public')          AS privacy,
      COALESCE(p.allow_comments, TRUE)       AS allow_comments,
      COALESCE(p.allow_download, TRUE)       AS allow_download,
      COALESCE(p.allow_duet, TRUE)           AS allow_duet,
      pr.username,
      pr.avatar_url,
      COALESCE(pr.is_verified, FALSE)        AS is_verified,

      (
        (
          -- 1. Dwell (35 %) — weiterhin dominant
          LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.35

          -- 2. Following (15 %)
          + CASE WHEN fi.following_id IS NOT NULL THEN 0.15 ELSE 0.0 END

          -- 3. Freshness (12 %, linear über 72h)
          + GREATEST(
              0.0,
              0.12 - EXTRACT(EPOCH FROM (NOW() - p.created_at))
                     / (72.0 * 3600.0) * 0.12
            )

          -- 4. Tag-Affinität (12 %) — echtes gelerntes Interesse
          + COALESCE(ta.max_aff, 0.0) * 0.12

          -- 5. Explore-/Brain-Slider-Match (8 % + 5 %)
          + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - explore_weight)) * 0.08
          + (1.0 - ABS(COALESCE(p.score_brain,   0.5) - brain_weight))   * 0.05

          -- 6. Wilson-Popularity (6 %) — Like-RATE statt Roh-Counts.
          --    Lower bound des 95%-Konfidenzintervalls von likes/views.
          + CASE
              WHEN COALESCE(p.view_count, 0) > 0 THEN
                0.06 * GREATEST(0.0, (
                  (LEAST(COALESCE(p.like_count,0)::float / p.view_count, 1.0)
                    + 1.9208 / p.view_count
                    - 1.96 * sqrt(
                        (LEAST(COALESCE(p.like_count,0)::float / p.view_count, 1.0)
                         * (1.0 - LEAST(COALESCE(p.like_count,0)::float / p.view_count, 1.0))
                         + 0.9604 / p.view_count
                        ) / p.view_count
                      )
                  ) / (1.0 + 3.8416 / p.view_count)
                ))
              ELSE 0.0
            END

          -- 7. Cold-Start-Boost (≤ 20 %): junge Posts mit wenig Reichweite
          --    bekommen ein Startpublikum; schmilzt über die ersten 20 Views ab.
          + CASE
              WHEN p.created_at > NOW() - INTERVAL '14 days' THEN
                0.20 * GREATEST(0.0, 1.0 - COALESCE(p.view_count, 0) / 20.0)
              ELSE 0.0
            END

          -- 8. Community-/Commerce-Boosts
          + CASE WHEN v_my_guild IS NOT NULL AND pr.guild_id = v_my_guild THEN 0.05 ELSE 0.0 END
          + CASE WHEN dm.uid IS NOT NULL THEN 0.04 ELSE 0.0 END
          + CASE WHEN p.product_id IS NOT NULL THEN 0.02 ELSE 0.0 END

          -- 9. Women-Only-Boost (5 %)
          + CASE WHEN p.women_only = TRUE AND v_is_woz_verified = TRUE THEN 0.05 ELSE 0.0 END
        )
        -- ── Seen-Penalty: weich statt hartem Filter — Gesehenes rutscht nach
        --    hinten, Feed leert sich nie. include_seen=TRUE (Client-Fallback/
        --    „alles zeigen") deaktiviert den Penalty.
        * CASE
            WHEN include_seen OR sp.post_id IS NULL THEN 1.0
            ELSE 0.15
          END
      ) AS final_score,

      -- Jitter einmal pro Row: ±15 % um 1.0 → jeder Aufruf mischt leicht anders
      (0.85 + random() * 0.30) AS jitter

    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    LEFT JOIN seen_ids sp        ON sp.post_id = p.id
    LEFT JOIN following_ids fi   ON fi.following_id = p.author_id
    LEFT JOIN dm_ids dm          ON dm.uid = p.author_id
    LEFT JOIN LATERAL (
      SELECT MAX(a.affinity) AS max_aff
      FROM public.user_tag_affinity a
      WHERE a.user_id = v_user_id
        AND a.tag = ANY(COALESCE(p.tags, '{}'))
    ) ta ON TRUE
    WHERE
      p.is_guild_post IS NOT TRUE
      AND p.privacy = 'public'
      AND COALESCE(p.is_visible, TRUE) = TRUE
      AND (p.women_only = FALSE OR v_is_woz_verified = TRUE)
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
      AND (array_length(exclude_ids, 1) IS NULL OR p.id != ALL(exclude_ids))
  ),

  -- ── Diversity: max 2 Posts pro Creator (nach echtem Score, ohne Jitter) ──
  ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY author_id
        ORDER BY final_score DESC, created_at DESC
      ) AS author_rank
    FROM scored
  )

  SELECT
    id, author_id, caption, media_url, media_type, thumbnail_url,
    audio_url,
    dwell_capped AS dwell_time_score, score_explore, score_brain,
    tags, guild_id, is_guild_post, created_at,
    privacy, allow_comments, allow_download, allow_duet,
    username, avatar_url, is_verified, final_score
  FROM ranked
  WHERE author_rank <= 2
  ORDER BY (final_score * jitter) DESC, created_at DESC
  LIMIT result_limit;

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vibe_feed(double precision, double precision, integer, text, boolean, uuid[]) TO authenticated, anon;


-- ─── 5. pg_cron: Decay + Affinitäts-Refresh nächtlich ───────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Dwell-Decay (existierende Funktion, war nie geplant): täglich 03:00 UTC
SELECT cron.unschedule('decay-dwell-scores')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'decay-dwell-scores');
SELECT cron.schedule(
  'decay-dwell-scores',
  '0 3 * * *',
  $$ SELECT public.decay_dwell_scores(); $$
);

-- Tag-Affinität: täglich 03:30 UTC
SELECT cron.unschedule('refresh-user-tag-affinity')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-user-tag-affinity');
SELECT cron.schedule(
  'refresh-user-tag-affinity',
  '30 3 * * *',
  $$ SELECT public.refresh_user_tag_affinity(); $$
);

-- Initiale Befüllung sofort (nicht erst morgen Nacht warten)
SELECT public.refresh_user_tag_affinity();


DO $$
BEGIN
  RAISE NOTICE '✅ Feed-Algorithmus v5 deployed: Seen-Penalty (post_dwell_log), Skip=Negativ-Signal, Decay-Cron, Jitter, Cold-Start-Boost, Wilson-Popularity, Tag-Affinität, Community-Boosts';
END $$;
