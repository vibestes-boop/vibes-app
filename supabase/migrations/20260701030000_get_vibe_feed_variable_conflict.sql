-- 20260701030000_get_vibe_feed_variable_conflict.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Bugfix (Prod-Log 42702): get_vibe_feed → 400 „column reference 'id' is ambiguous".
--
-- Die Funktion ist RETURNS TABLE(id, author_id, created_at, final_score, …) —
-- diese Namen werden in PL/pgSQL zu Variablen. Der Query nutzt aber
-- unqualifizierte Spalten (PARTITION BY author_id, ORDER BY final_score/
-- created_at, finales SELECT id, …) → Postgres kann Variable vs. Spalte nicht
-- auflösen → Abbruch mit 42702. Der App-Feed fiel dadurch auf eine nicht-
-- personalisierte Fallback-Query zurück (Algorithmus v4 kam nie zum Tragen).
--
-- Fix: eine einzige Compiler-Direktive `#variable_conflict use_column` am
-- Funktionsanfang → bei Namensgleichheit gewinnt immer die SPALTE. Der Rest der
-- Funktion ist WORTGETREU aus dem Live-Schema-Dump (supabase/schema_live.sql)
-- übernommen — nur CREATE→CREATE OR REPLACE + diese eine Zeile ergänzt.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_vibe_feed(explore_weight double precision DEFAULT 0.5, brain_weight double precision DEFAULT 0.5, result_limit integer DEFAULT 20, filter_tag text DEFAULT NULL::text, include_seen boolean DEFAULT false, exclude_ids uuid[] DEFAULT '{}'::uuid[]) RETURNS TABLE(id uuid, author_id uuid, caption text, media_url text, media_type text, thumbnail_url text, audio_url text, dwell_time_score double precision, score_explore double precision, score_brain double precision, tags text[], guild_id uuid, is_guild_post boolean, created_at timestamp with time zone, privacy text, allow_comments boolean, allow_download boolean, allow_duet boolean, username text, avatar_url text, is_verified boolean, final_score double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
#variable_conflict use_column
DECLARE
  v_user_id         UUID;
  v_is_woz_verified BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();

  -- Women-Only Verifikation des aktuellen Users einmalig prüfen
  IF v_user_id IS NOT NULL THEN
    SELECT (gender = 'female' AND women_only_verified = TRUE)
      INTO v_is_woz_verified
      FROM public.profiles
     WHERE id = v_user_id;
  END IF;

  RETURN QUERY
  WITH

  -- ── Bereits gesehene Posts ────────────────────────────────────────────────
  seen_ids AS (
    SELECT post_id
    FROM public.seen_posts
    WHERE user_id = v_user_id
      AND v_user_id IS NOT NULL
  ),

  -- ── Gefolgten Creatoren des Users ─────────────────────────────────────────
  -- Wird für Following-Boost genutzt
  following_ids AS (
    SELECT following_id
    FROM public.follows
    WHERE follower_id = v_user_id
      AND v_user_id IS NOT NULL
  ),

  -- ── Score-Berechnung ──────────────────────────────────────────────────────
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
      (sp.post_id IS NOT NULL)               AS is_seen,

      -- ── Algorithmus v4 FINAL ───────────────────────────────────────────
      --
      -- Signal              Gewicht   Begründung
      -- ─────────────────── ──────── ──────────────────────────────────────
      -- Dwell Time          40%      Stärkstes Engagement-Signal
      -- Following-Boost     15%      Creator denen du folgst bevorzugen
      -- Freshness           15%      Neuere Posts eine Chance geben (72h)
      -- Explore-Match       15%      User-Slider Präferenz
      -- Brain-Match         10%      User-Slider Präferenz
      -- Popularity          05% (LOG)Bewährte Inhalte leicht bevorzugen
      --
      (
        -- 1. Dwell Time (40%) — dominantes Signal
        LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.40

        -- 2. Following-Boost (15%) — Post vom gefolgten Creator?
        + CASE WHEN fi.following_id IS NOT NULL THEN 0.15 ELSE 0.0 END

        -- 3. Freshness (15%) — linearer Decay über 72h (statt 48h)
        + GREATEST(
            0.0,
            0.15 - EXTRACT(EPOCH FROM (NOW() - p.created_at))
                   / (72.0 * 3600.0) * 0.15
          )

        -- 4. Explore-Slider-Match (15%)
        + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - explore_weight)) * 0.15

        -- 5. Brain-Slider-Match (10%)
        + (1.0 - ABS(COALESCE(p.score_brain, 0.5) - brain_weight)) * 0.10

        -- 6. Popularitäts-Boost (5%) — logarithmisch damit Viral-Posts
        --    nicht alles dominieren (TikTok-Prinzip: auch kleine Posts Chance)
        + LEAST(
            0.05,
            LN(1.0 + COALESCE(p.view_count, 0) * 0.001 + COALESCE(p.like_count, 0) * 0.01)
            / 10.0
          )

        -- 7. Women-Only Boost (5%) — Verifizierte Frauen sehen WOZ-Posts oben
        + CASE
            WHEN p.women_only = TRUE AND v_is_woz_verified = TRUE THEN 0.05
            ELSE 0.0
          END

      ) AS final_score

    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    LEFT JOIN seen_ids sp ON sp.post_id = p.id
    LEFT JOIN following_ids fi ON fi.following_id = p.author_id
    WHERE
      p.is_guild_post IS NOT TRUE
      AND p.privacy = 'public'
      AND COALESCE(p.is_visible, TRUE) = TRUE
      -- Women-Only: Gefiltert durch RLS, aber doppelt sicher:
      AND (
        p.women_only = FALSE
        OR v_is_woz_verified = TRUE
      )
      -- Tag-Filter (optional)
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
      -- ID-Exclusion cursor (kein OFFSET → keine Duplikate)
      AND (array_length(exclude_ids, 1) IS NULL OR p.id != ALL(exclude_ids))
  ),

  -- ── Seen-Filter ───────────────────────────────────────────────────────────
  filtered AS (
    SELECT *
    FROM scored
    WHERE (include_seen = TRUE OR is_seen = FALSE)
  ),

  -- ── Diversity: max 2 Posts pro Creator ───────────────────────────────────
  -- Verhindert dass ein Creator den ganzen Feed dominiert
  ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY author_id
        ORDER BY final_score DESC, created_at DESC
      ) AS author_rank
    FROM filtered
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
  ORDER BY final_score DESC, created_at DESC
  LIMIT result_limit;

END;
$$;
