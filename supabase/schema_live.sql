--
-- PostgreSQL database dump
--

-- \restrict gf26gkQhJL3bsIhblDyKMmTk5KAVWMZtVvbKmxlRbahok4BER0asdKBpm0pdgzq

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: ai_image_purpose; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."ai_image_purpose" AS ENUM (
    'shop_mockup',
    'post_cover',
    'live_thumbnail',
    'avatar',
    'sticker',
    'icon'
);


ALTER TYPE "public"."ai_image_purpose" OWNER TO "postgres";

--
-- Name: coin_order_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."coin_order_status" AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded',
    'cancelled'
);


ALTER TYPE "public"."coin_order_status" OWNER TO "postgres";

--
-- Name: _caption_to_scores("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_caption_to_scores"("p_caption" "text") RETURNS TABLE("c_brain" double precision, "c_explore" double precision)
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  cap       TEXT;
  v_brain   FLOAT := 0;
  v_explore FLOAT := 0;
  v_count   INT   := 0;
BEGIN
  IF p_caption IS NULL OR length(trim(p_caption)) = 0 THEN
    RETURN QUERY SELECT NULL::FLOAT, NULL::FLOAT;
    RETURN;
  END IF;

  cap := lower(p_caption);

  -- ── 🧠 Tech & Wissenschaft ────────────────────────────────────────────────
  IF cap ~ '(tech|technolog|coding|programm|software|developer|github|api|algorithm)' THEN
    v_brain := v_brain + 0.92; v_explore := v_explore + 0.22; v_count := v_count + 1;
  END IF;
  IF cap ~ '(science|research|studie|experiment|physik|biolog|chemie|math)' THEN
    v_brain := v_brain + 0.90; v_explore := v_explore + 0.30; v_count := v_count + 1;
  END IF;
  IF cap ~ '(business|startup|entrepreneur|revenue|profit|marketing|strategy)' THEN
    v_brain := v_brain + 0.80; v_explore := v_explore + 0.35; v_count := v_count + 1;
  END IF;
  IF cap ~ '(mindful|meditation|mental health|achtsamkeit|selbstreflexion)' THEN
    v_brain := v_brain + 0.62; v_explore := v_explore + 0.70; v_count := v_count + 1;
  END IF;
  IF cap ~ '(motivation|inspiration|productivity|wachstum|lernen|tipps)' THEN
    v_brain := v_brain + 0.55; v_explore := v_explore + 0.60; v_count := v_count + 1;
  END IF;

  -- ── 🎨 Kreativität & Kunst ────────────────────────────────────────────────
  IF cap ~ '(design|ui|ux|graphic|visual|branding|kreativ|gestalt)' THEN
    v_brain := v_brain + 0.68; v_explore := v_explore + 0.62; v_count := v_count + 1;
  END IF;
  IF cap ~ '(art|painting|drawing|illustration|canvas|galerie|kunst)' THEN
    v_brain := v_brain + 0.42; v_explore := v_explore + 0.88; v_count := v_count + 1;
  END IF;
  IF cap ~ '(photo|photograph|camera|bild|shot|portrait|landscape|analog)' THEN
    v_brain := v_brain + 0.38; v_explore := v_explore + 0.78; v_count := v_count + 1;
  END IF;
  IF cap ~ '(film|movie|cinema|director|kino|scene|cinemat)' THEN
    v_brain := v_brain + 0.45; v_explore := v_explore + 0.72; v_count := v_count + 1;
  END IF;
  IF cap ~ '(architect|building|structure|design bau|gebäude)' THEN
    v_brain := v_brain + 0.72; v_explore := v_explore + 0.55; v_count := v_count + 1;
  END IF;

  -- ── ✈️ Reise & Abenteuer ──────────────────────────────────────────────────
  IF cap ~ '(travel|reise|trip|journey|explore|wanderlust|urlaub|vacation)' THEN
    v_brain := v_brain + 0.32; v_explore := v_explore + 0.92; v_count := v_count + 1;
  END IF;
  IF cap ~ '(adventure|abenteuer|hiking|wandern|backpack|offroad)' THEN
    v_brain := v_brain + 0.28; v_explore := v_explore + 0.90; v_count := v_count + 1;
  END IF;
  IF cap ~ '(nature|natur|forest|wald|ocean|beach|mountain|berg|wilderness)' THEN
    v_brain := v_brain + 0.30; v_explore := v_explore + 0.82; v_count := v_count + 1;
  END IF;

  -- ── 🎵 Entertainment & Lifestyle ─────────────────────────────────────────
  IF cap ~ '(music|musik|song|beat|artist|producer|playlist|concert|album)' THEN
    v_brain := v_brain + 0.35; v_explore := v_explore + 0.65; v_count := v_count + 1;
  END IF;
  IF cap ~ '(dance|tanz|choreograph|freestyle|routine)' THEN
    v_brain := v_brain + 0.25; v_explore := v_explore + 0.68; v_count := v_count + 1;
  END IF;
  IF cap ~ '(comedy|funny|humor|joke|lol|challenge|meme)' THEN
    v_brain := v_brain + 0.18; v_explore := v_explore + 0.58; v_count := v_count + 1;
  END IF;
  IF cap ~ '(food|recipe|kochen|rezept|restaurant|essen|chef|cuisine)' THEN
    v_brain := v_brain + 0.22; v_explore := v_explore + 0.48; v_count := v_count + 1;
  END IF;
  IF cap ~ '(fashion|mode|outfit|style|ootd|kleidung|look|trend)' THEN
    v_brain := v_brain + 0.20; v_explore := v_explore + 0.52; v_count := v_count + 1;
  END IF;
  IF cap ~ '(beauty|makeup|skincare|cosmetic|pflege|glow)' THEN
    v_brain := v_brain + 0.18; v_explore := v_explore + 0.50; v_count := v_count + 1;
  END IF;

  -- ── ⚡ Sport & Fitness ────────────────────────────────────────────────────
  IF cap ~ '(sport|workout|training|gym|fitness|exercise|run|swim|muscle)' THEN
    v_brain := v_brain + 0.30; v_explore := v_explore + 0.40; v_count := v_count + 1;
  END IF;
  IF cap ~ '(gaming|game|twitch|stream|esport|level|gamer|play)' THEN
    v_brain := v_brain + 0.40; v_explore := v_explore + 0.55; v_count := v_count + 1;
  END IF;

  -- Keine Matches → keine Caption-Scores (Tags allein bestimmen)
  IF v_count = 0 THEN
    RETURN QUERY SELECT NULL::FLOAT, NULL::FLOAT;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_brain / v_count, v_explore / v_count;
END;
$$;


ALTER FUNCTION "public"."_caption_to_scores"("p_caption" "text") OWNER TO "postgres";

--
-- Name: _clear_replay_on_recording_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_clear_replay_on_recording_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.live_sessions
  SET replay_url = NULL, is_replayable = FALSE
  WHERE id = OLD.session_id
    AND replay_url = OLD.file_url;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."_clear_replay_on_recording_delete"() OWNER TO "postgres";

--
-- Name: _close_duet_history_on_revoke(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_close_duet_history_on_revoke"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND (OLD.revoked_at IS NULL) THEN
    UPDATE public.live_duet_history
       SET ended_at      = NEW.revoked_at,
           duration_secs = GREATEST(0, EXTRACT(EPOCH FROM (NEW.revoked_at - started_at))::INT),
           end_reason    = COALESCE(end_reason, 'host-ended')
     WHERE session_id = NEW.session_id
       AND guest_id   = NEW.user_id
       AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_close_duet_history_on_revoke"() OWNER TO "postgres";

--
-- Name: _close_duet_history_on_session_end(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_close_duet_history_on_session_end"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'ended' AND (OLD.status IS DISTINCT FROM 'ended') THEN
    UPDATE public.live_duet_history
       SET ended_at      = COALESCE(ended_at, NOW()),
           duration_secs = COALESCE(duration_secs, GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::INT)),
           end_reason    = COALESCE(end_reason, 'session-ended')
     WHERE session_id = NEW.id
       AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_close_duet_history_on_session_end"() OWNER TO "postgres";

--
-- Name: _compute_creator_consistency("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_compute_creator_consistency"("p_author_id" "uuid") RETURNS double precision
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_stddev_explore FLOAT;
  v_stddev_brain   FLOAT;
  v_post_count     INT;
BEGIN
  SELECT
    COALESCE(STDDEV(score_explore), 0),
    COALESCE(STDDEV(score_brain),   0),
    COUNT(*)
  INTO v_stddev_explore, v_stddev_brain, v_post_count
  FROM (
    SELECT score_explore, score_brain
    FROM public.posts
    WHERE author_id = p_author_id
      AND score_explore IS NOT NULL
      AND score_brain   IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
  ) last_posts;

  -- Mindestens 3 Posts um aussagekräftig zu sein
  IF v_post_count < 3 THEN
    RETURN 0.5; -- Neutral bis genug Daten vorhanden
  END IF;

  RETURN GREATEST(0.0, 1.0 - (v_stddev_explore + v_stddev_brain) * 2.0);
END;
$$;


ALTER FUNCTION "public"."_compute_creator_consistency"("p_author_id" "uuid") OWNER TO "postgres";

--
-- Name: _learn_from_post("uuid", "uuid", double precision); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_learn_from_post"("p_user_id" "uuid", "p_post_id" "uuid", "p_alpha" double precision) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."_learn_from_post"("p_user_id" "uuid", "p_post_id" "uuid", "p_alpha" double precision) OWNER TO "postgres";

--
-- Name: _on_bookmark_learn(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_on_bookmark_learn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Bookmark = stärkstes Signal (alpha 0.12) — User will den Content behalten
  PERFORM public._learn_from_post(NEW.user_id, NEW.post_id, 0.12);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_on_bookmark_learn"() OWNER TO "postgres";

--
-- Name: _on_comment_learn(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_on_comment_learn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Kommentar schreiben = sehr starkes Interesse-Signal (alpha 0.10)
  PERFORM public._learn_from_post(NEW.user_id, NEW.post_id, 0.10);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_on_comment_learn"() OWNER TO "postgres";

--
-- Name: _on_like_learn(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_on_like_learn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Like = starkes Signal (alpha 0.08)
  PERFORM public._learn_from_post(NEW.user_id, NEW.post_id, 0.08);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_on_like_learn"() OWNER TO "postgres";

--
-- Name: _on_post_update_consistency(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_on_post_update_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
  SET consistency_score = public._compute_creator_consistency(NEW.author_id)
  WHERE id = NEW.author_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_on_post_update_consistency"() OWNER TO "postgres";

--
-- Name: _purge_live_session_viewers_on_end(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_purge_live_session_viewers_on_end"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'ended' AND OLD.status <> 'ended' THEN
    DELETE FROM public.live_session_viewers WHERE session_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_purge_live_session_viewers_on_end"() OWNER TO "postgres";

--
-- Name: _set_live_placed_products_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_set_live_placed_products_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."_set_live_placed_products_updated_at"() OWNER TO "postgres";

--
-- Name: _set_live_sessions_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_set_live_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_set_live_sessions_updated_at"() OWNER TO "postgres";

--
-- Name: _set_live_stickers_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_set_live_stickers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."_set_live_stickers_updated_at"() OWNER TO "postgres";

--
-- Name: _sync_bookmark_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_sync_bookmark_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET bookmark_count = bookmark_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."_sync_bookmark_count"() OWNER TO "postgres";

--
-- Name: _sync_comment_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_sync_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."_sync_comment_count"() OWNER TO "postgres";

--
-- Name: _sync_like_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_sync_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."_sync_like_count"() OWNER TO "postgres";

--
-- Name: _sync_recording_to_session(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_sync_recording_to_session"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'ready' AND NEW.file_url IS NOT NULL AND NEW.is_public THEN
    UPDATE public.live_sessions
    SET replay_url    = NEW.file_url,
        thumbnail_url = COALESCE(NEW.thumbnail_url, thumbnail_url),
        is_replayable = TRUE
    WHERE id = NEW.session_id;
  ELSIF NEW.status IN ('failed') OR NEW.is_public = FALSE THEN
    -- Recording wurde privat gemacht oder ist fehlgeschlagen → replay_url entfernen
    UPDATE public.live_sessions
    SET is_replayable = FALSE
    WHERE id = NEW.session_id
      AND (replay_url = NEW.file_url OR replay_url IS NULL);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_sync_recording_to_session"() OWNER TO "postgres";

--
-- Name: _update_user_whip_ingresses_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_update_user_whip_ingresses_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."_update_user_whip_ingresses_updated_at"() OWNER TO "postgres";

--
-- Name: add_user_support_message("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."add_user_support_message"("p_thread_id" "uuid", "p_body" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 OR length(p_body) > 4000 THEN
    RETURN jsonb_build_object('error', 'invalid_body');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_support_threads
     WHERE id = p_thread_id AND user_id = v_actor
  ) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  INSERT INTO public.admin_support_messages (thread_id, sender_type, sender_id, body)
  VALUES (p_thread_id, 'user', v_actor, trim(p_body));

  UPDATE public.admin_support_threads
     SET last_message_at = NOW(),
         status = CASE WHEN status IN ('resolved', 'closed') THEN 'pending' ELSE status END
   WHERE id = p_thread_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."add_user_support_message"("p_thread_id" "uuid", "p_body" "text") OWNER TO "postgres";

--
-- Name: admin_campaign_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_campaign_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_total BIGINT := 0;
  v_active BIGINT := 0;
  v_paused BIGINT := 0;
  v_failed BIGINT := 0;
  v_budget BIGINT := 0;
  v_spend BIGINT := 0;
  v_revenue BIGINT := 0;
  v_impressions BIGINT := 0;
  v_clicks BIGINT := 0;
  v_conversions BIGINT := 0;
  v_items JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.can_operate() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'paused'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COALESCE(SUM(budget_cents), 0),
    COALESCE(SUM(spend_cents), 0)
  INTO v_total, v_active, v_paused, v_failed, v_budget, v_spend
  FROM public.admin_campaigns;

  SELECT
    COALESCE(SUM(revenue_cents), 0),
    COALESCE(SUM(impressions), 0),
    COALESCE(SUM(clicks), 0),
    COALESCE(SUM(conversions), 0),
    COALESCE(SUM(spend_cents), 0)
  INTO v_revenue, v_impressions, v_clicks, v_conversions, v_spend
  FROM public.admin_campaign_daily_metrics
  WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days';

  IF v_spend = 0 THEN
    SELECT COALESCE(SUM(spend_cents), 0)
      INTO v_spend
      FROM public.admin_campaigns;
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_updated_at DESC), '[]'::JSONB)
    INTO v_items
    FROM (
      SELECT
        c.updated_at AS sort_updated_at,
        jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'channel', c.channel,
          'status', c.status,
          'target_metric', c.target_metric,
          'budget_cents', c.budget_cents,
          'spend_cents', COALESCE(m.spend_cents_30d, c.spend_cents),
          'impressions_30d', COALESCE(m.impressions_30d, 0),
          'clicks_30d', COALESCE(m.clicks_30d, 0),
          'conversions_30d', COALESCE(m.conversions_30d, 0),
          'revenue_cents_30d', COALESCE(m.revenue_cents_30d, 0),
          'updated_at', c.updated_at
        ) AS row_data
      FROM public.admin_campaigns c
      LEFT JOIN LATERAL (
        SELECT
          SUM(impressions) AS impressions_30d,
          SUM(clicks) AS clicks_30d,
          SUM(conversions) AS conversions_30d,
          SUM(revenue_cents) AS revenue_cents_30d,
          SUM(spend_cents) AS spend_cents_30d
        FROM public.admin_campaign_daily_metrics m
        WHERE m.campaign_id = c.id
          AND m.metric_date >= CURRENT_DATE - INTERVAL '30 days'
      ) m ON TRUE
      ORDER BY
        CASE c.status
          WHEN 'active' THEN 1
          WHEN 'paused' THEN 2
          WHEN 'failed' THEN 3
          WHEN 'draft' THEN 4
          ELSE 5
        END,
        c.updated_at DESC
      LIMIT 5
    ) ranked;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'summary', jsonb_build_object(
      'total', v_total,
      'active', v_active,
      'paused', v_paused,
      'failed', v_failed,
      'budget_cents', v_budget,
      'spend_cents_30d', v_spend,
      'revenue_cents_30d', v_revenue,
      'impressions_30d', v_impressions,
      'clicks_30d', v_clicks,
      'conversions_30d', v_conversions,
      'roas', CASE WHEN v_spend > 0 THEN ROUND((v_revenue::NUMERIC / v_spend::NUMERIC), 2) ELSE NULL END
    ),
    'campaigns', v_items
  );
END;
$$;


ALTER FUNCTION "public"."admin_campaign_snapshot"() OWNER TO "postgres";

--
-- Name: admin_create_activation_support_thread("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_create_activation_support_thread"("p_user_id" "uuid", "p_kind" "text" DEFAULT 'first_post'::"text", "p_body" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_kind TEXT := COALESCE(NULLIF(trim(p_kind), ''), 'first_post');
  v_subject TEXT;
  v_body TEXT;
  v_thread_id UUID;
  v_existing_thread_id UUID;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin() OR public.can_operate() OR public.can_creator_ops()) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('error', 'invalid_user');
  END IF;

  IF v_kind NOT IN ('first_post', 'engagement') THEN
    RETURN jsonb_build_object('error', 'invalid_kind');
  END IF;

  SELECT id
    INTO v_existing_thread_id
    FROM public.admin_support_threads
   WHERE user_id = p_user_id
     AND source = 'activation'
     AND status IN ('open', 'pending')
     AND metadata->>'activation_kind' = v_kind
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_thread_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'thread_id', v_existing_thread_id,
      'existing', true
    );
  END IF;

  v_subject := CASE
    WHEN v_kind = 'engagement' THEN 'Creator Activation: Engagement anstossen'
    ELSE 'Creator Activation: Ersten Post starten'
  END;

  v_body := COALESCE(NULLIF(trim(p_body), ''), CASE
    WHEN v_kind = 'engagement' THEN
      'Hi! Dein Content ist live. Wir pruefen gerade, wie wir dir schneller zu den ersten sinnvollen Reaktionen helfen koennen. Wenn du magst, antworte kurz: Welches Thema soll als naechstes gepusht werden?'
    ELSE
      'Hi! Willkommen bei Serlo. Wir helfen dir gern beim ersten Post. Ein guter Start ist ein kurzes Bild oder Video mit einer konkreten Frage an die Community.'
  END);

  IF length(v_body) > 4000 THEN
    RETURN jsonb_build_object('error', 'invalid_body');
  END IF;

  INSERT INTO public.admin_support_threads (
    source,
    user_id,
    subject,
    status,
    priority,
    assigned_admin_id,
    metadata
  )
  VALUES (
    'activation',
    p_user_id,
    v_subject,
    'open',
    'medium',
    v_actor,
    jsonb_build_object(
      'activation_kind', v_kind,
      'created_from', 'admin_activation_review'
    )
  )
  RETURNING id INTO v_thread_id;

  INSERT INTO public.admin_support_messages (
    thread_id,
    sender_type,
    sender_id,
    body,
    metadata,
    read_at
  )
  VALUES (
    v_thread_id,
    'admin',
    v_actor,
    v_body,
    jsonb_build_object('activation_kind', v_kind),
    NOW()
  );

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    v_actor,
    'activation.support_thread.create',
    'profile',
    p_user_id,
    jsonb_build_object(
      'support_thread_id', v_thread_id,
      'activation_kind', v_kind
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'thread_id', v_thread_id,
    'existing', false
  );
END;
$$;


ALTER FUNCTION "public"."admin_create_activation_support_thread"("p_user_id" "uuid", "p_kind" "text", "p_body" "text") OWNER TO "postgres";

--
-- Name: admin_enforce_content_report("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_enforce_content_report"("p_report_id" "uuid", "p_action" "text", "p_admin_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_report public.content_reports%ROWTYPE;
  v_note TEXT := NULLIF(trim(COALESCE(p_admin_note, '')), '');
  v_deleted_post RECORD;
  v_live_session RECORD;
  v_restricted_until TIMESTAMPTZ := NOW() + INTERVAL '7 days';
  v_live_mute_until TIMESTAMPTZ := NOW() + INTERVAL '1 hour';
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_admin_id
      AND is_admin = TRUE
  ) THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  SELECT *
    INTO v_report
    FROM public.content_reports
   WHERE id = p_report_id
   FOR UPDATE;

  IF v_report.id IS NULL THEN
    RETURN jsonb_build_object('error', 'report_not_found');
  END IF;

  IF p_action = 'remove_post' THEN
    IF v_report.target_type <> 'post' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    DELETE FROM public.posts p
     WHERE p.id = v_report.target_id
     RETURNING p.id, p.author_id, p.media_url, p.thumbnail_url
      INTO v_deleted_post;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'post_not_found');
    END IF;
  ELSIF p_action = 'ban_profile' THEN
    IF v_report.target_type <> 'profile' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    UPDATE public.profiles
       SET is_banned = TRUE
     WHERE id = v_report.target_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'profile_not_found');
    END IF;
  ELSIF p_action = 'restrict_profile' THEN
    IF v_report.target_type <> 'profile' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    UPDATE public.profiles
       SET is_restricted = TRUE,
           restricted_until = GREATEST(COALESCE(restricted_until, v_restricted_until), v_restricted_until)
     WHERE id = v_report.target_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'profile_not_found');
    END IF;
  ELSIF p_action = 'shadowban_profile' THEN
    IF v_report.target_type <> 'profile' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    UPDATE public.profiles
       SET is_shadow_banned = TRUE
     WHERE id = v_report.target_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'profile_not_found');
    END IF;
  ELSIF p_action = 'mute_live_host' THEN
    IF v_report.target_type <> 'live' THEN
      RETURN jsonb_build_object('error', 'action_target_mismatch');
    END IF;

    SELECT id, host_id
      INTO v_live_session
      FROM public.live_sessions
     WHERE id = v_report.target_id;

    IF v_live_session.id IS NULL THEN
      RETURN jsonb_build_object('error', 'live_session_not_found');
    END IF;

    INSERT INTO public.live_chat_timeouts (session_id, user_id, until_at, reason)
    VALUES (v_live_session.id, v_live_session.host_id, v_live_mute_until, COALESCE(v_note, 'admin_moderation'))
    ON CONFLICT (session_id, user_id) DO UPDATE
      SET until_at = GREATEST(public.live_chat_timeouts.until_at, EXCLUDED.until_at),
          reason = COALESCE(EXCLUDED.reason, public.live_chat_timeouts.reason);
  ELSE
    RETURN jsonb_build_object('error', 'unsupported_action');
  END IF;

  UPDATE public.content_reports
     SET status = 'actioned',
         admin_note = v_note,
         reviewed_by = v_admin_id,
         reviewed_at = NOW()
   WHERE id = p_report_id;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    v_admin_id,
    'moderation.enforcement.' || p_action,
    v_report.target_type,
    v_report.target_id,
    jsonb_build_object(
      'report_id', v_report.id,
      'reason', v_report.reason,
      'reporter_id', v_report.reporter_id,
      'admin_note_present', v_note IS NOT NULL,
      'restricted_until', CASE WHEN p_action = 'restrict_profile' THEN v_restricted_until ELSE NULL END,
      'live_mute_until', CASE WHEN p_action = 'mute_live_host' THEN v_live_mute_until ELSE NULL END
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'action', p_action,
    'report_id', p_report_id
  );
END;
$$;


ALTER FUNCTION "public"."admin_enforce_content_report"("p_report_id" "uuid", "p_action" "text", "p_admin_note" "text") OWNER TO "postgres";

--
-- Name: admin_get_payout_requests("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_get_payout_requests"("p_status" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "creator_id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "diamonds_amount" bigint, "euro_amount" numeric, "iban" "text", "paypal_email" "text", "note" "text", "status" "text", "admin_note" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Admin-Zugriff';
  END IF;
  RETURN QUERY
    SELECT
      pr.id, pr.creator_id,
      p.username, p.display_name, p.avatar_url,
      pr.diamonds_amount, pr.euro_amount,
      pr.iban, pr.paypal_email, pr.note,
      pr.status, pr.admin_note, pr.created_at
    FROM payout_requests pr
    JOIN profiles p ON p.id = pr.creator_id
    WHERE (p_status IS NULL OR pr.status = p_status)
    ORDER BY pr.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."admin_get_payout_requests"("p_status" "text") OWNER TO "postgres";

--
-- Name: admin_get_seller_balances(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_get_seller_balances"() RETURNS TABLE("seller_id" "uuid", "username" "text", "avatar_url" "text", "diamond_balance" bigint, "total_earned" bigint, "pending_orders" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id                                                                      AS seller_id,
    p.username,
    p.avatar_url,
    COALESCE(w.diamonds, 0)                                                   AS diamond_balance,
    COALESCE(SUM(o.total_coins) FILTER (WHERE o.status = 'completed'), 0)    AS total_earned,
    COUNT(o.id)              FILTER (WHERE o.status = 'pending')              AS pending_orders
  FROM public.profiles p
  JOIN public.orders   o  ON o.seller_id = p.id
  LEFT JOIN public.coins_wallets w ON w.user_id = p.id
  WHERE public.can_creator_ops()
  GROUP BY p.id, p.username, p.avatar_url, w.diamonds
  ORDER BY diamond_balance DESC;
$$;


ALTER FUNCTION "public"."admin_get_seller_balances"() OWNER TO "postgres";

--
-- Name: admin_list_support_threads("text", integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_list_support_threads"("p_status" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "source" "text", "user_id" "uuid", "username" "text", "subject" "text", "status" "text", "priority" "text", "last_message_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    t.id,
    t.source,
    t.user_id,
    p.username,
    t.subject,
    t.status,
    t.priority,
    t.last_message_at,
    t.created_at
  FROM public.admin_support_threads t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  WHERE public.has_admin_console_access()
    AND (p_status IS NULL OR t.status = p_status)
  ORDER BY t.last_message_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
$$;


ALTER FUNCTION "public"."admin_list_support_threads"("p_status" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";

--
-- Name: admin_record_user_action("uuid", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_record_user_action"("p_target_user_id" "uuid", "p_action" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  IF p_target_user_id IS NULL OR p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    v_actor,
    trim(p_action),
    'profile',
    p_target_user_id,
    COALESCE(p_metadata, '{}'::JSONB)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$;


ALTER FUNCTION "public"."admin_record_user_action"("p_target_user_id" "uuid", "p_action" "text", "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: admin_region_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_region_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_total_profiles BIGINT := 0;
  v_total_active BIGINT := 0;
  v_total_new BIGINT := 0;
  v_total_posts BIGINT := 0;
  v_total_views BIGINT := 0;
  v_total_reports BIGINT := 0;
  v_regions JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.can_operate() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  WITH recent AS (
    SELECT *
    FROM public.admin_region_daily_metrics
    WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
  ),
  by_country AS (
    SELECT
      country_code,
      MAX(country_name) AS country_name,
      MAX(total_profiles) AS total_profiles,
      SUM(active_users) AS active_users_30d,
      SUM(new_registrations) AS new_registrations_30d,
      SUM(posts) AS posts_30d,
      SUM(views) AS views_30d,
      SUM(reports) AS reports_30d,
      MAX(metric_date) AS latest_metric_date
    FROM recent
    GROUP BY country_code
  )
  SELECT
    COALESCE(SUM(total_profiles), 0),
    COALESCE(SUM(active_users_30d), 0),
    COALESCE(SUM(new_registrations_30d), 0),
    COALESCE(SUM(posts_30d), 0),
    COALESCE(SUM(views_30d), 0),
    COALESCE(SUM(reports_30d), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'country_code', country_code,
          'country_name', country_name,
          'total_profiles', total_profiles,
          'active_users_30d', active_users_30d,
          'new_registrations_30d', new_registrations_30d,
          'posts_30d', posts_30d,
          'views_30d', views_30d,
          'reports_30d', reports_30d,
          'latest_metric_date', latest_metric_date
        )
        ORDER BY GREATEST(total_profiles, active_users_30d) DESC, views_30d DESC
      ),
      '[]'::JSONB
    )
  INTO v_total_profiles, v_total_active, v_total_new, v_total_posts, v_total_views, v_total_reports, v_regions
  FROM by_country;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'summary', jsonb_build_object(
      'total_profiles', v_total_profiles,
      'active_users_30d', v_total_active,
      'new_registrations_30d', v_total_new,
      'posts_30d', v_total_posts,
      'views_30d', v_total_views,
      'reports_30d', v_total_reports
    ),
    'regions', COALESCE(v_regions, '[]'::JSONB)
  );
END;
$$;


ALTER FUNCTION "public"."admin_region_snapshot"() OWNER TO "postgres";

--
-- Name: admin_remove_post("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_remove_post"("p_post_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_reason   TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_deleted  RECORD;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_admin_id AND is_admin = TRUE
  ) THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  DELETE FROM public.posts p
   WHERE p.id = p_post_id
   RETURNING p.id, p.author_id INTO v_deleted;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'post_not_found');
  END IF;

  UPDATE public.content_reports
     SET status      = 'actioned',
         reviewed_by = v_admin_id,
         reviewed_at = NOW()
   WHERE target_type = 'post'
     AND target_id   = p_post_id
     AND status      = 'pending';

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, metadata
  )
  VALUES (
    v_admin_id,
    'moderation.remove_post.direct',
    'post',
    v_deleted.id,
    jsonb_build_object('author_id', v_deleted.author_id, 'reason', v_reason)
  );

  RETURN jsonb_build_object('success', TRUE, 'post_id', v_deleted.id);
END;
$$;


ALTER FUNCTION "public"."admin_remove_post"("p_post_id" "uuid", "p_reason" "text") OWNER TO "postgres";

--
-- Name: admin_reply_support_thread("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_reply_support_thread"("p_thread_id" "uuid", "p_body" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.can_moderate() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 OR length(p_body) > 4000 THEN
    RETURN jsonb_build_object('error', 'invalid_body');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_support_threads WHERE id = p_thread_id) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  INSERT INTO public.admin_support_messages (thread_id, sender_type, sender_id, body, read_at)
  VALUES (p_thread_id, 'admin', v_actor, trim(p_body), NOW());

  UPDATE public.admin_support_threads
     SET last_message_at = NOW(),
         status = CASE WHEN status = 'resolved' THEN 'pending' ELSE status END
   WHERE id = p_thread_id;

  -- Nutzer benachrichtigen (defensiv — die Antwort darf nie an einer fehlenden
  -- Notification scheitern). Push feuert automatisch via trg_push_notification.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    SELECT t.user_id, v_actor, 'support_reply', left(trim(p_body), 140)
      FROM public.admin_support_threads t
     WHERE t.id = p_thread_id
       AND t.user_id IS NOT NULL
       AND t.user_id <> v_actor;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (v_actor, 'support.reply', 'support_thread', p_thread_id,
          jsonb_build_object('body_length', length(trim(p_body))));

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."admin_reply_support_thread"("p_thread_id" "uuid", "p_body" "text") OWNER TO "postgres";

--
-- Name: admin_resolve_content_report("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_resolve_content_report"("p_report_id" "uuid", "p_status" "text", "p_admin_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_report public.content_reports%ROWTYPE;
  v_actor_roles JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT public.can_moderate() THEN
    RETURN jsonb_build_object('error', 'not_moderator');
  END IF;

  IF p_status NOT IN ('reviewed', 'actioned', 'dismissed') THEN
    RETURN jsonb_build_object('error', 'invalid_status');
  END IF;

  SELECT public.current_user_admin_roles() INTO v_actor_roles;

  UPDATE public.content_reports
     SET status = p_status,
         admin_note = NULLIF(trim(COALESCE(p_admin_note, '')), ''),
         reviewed_at = NOW(),
         reviewed_by = v_actor
   WHERE id = p_report_id
   RETURNING * INTO v_report;

  IF v_report.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    v_actor,
    'moderation.report.' || p_status,
    v_report.target_type,
    v_report.target_id,
    jsonb_build_object(
      'report_id', v_report.id,
      'reason', v_report.reason,
      'reporter_id', v_report.reporter_id,
      'actor_roles', v_actor_roles,
      'admin_note_present', COALESCE(p_admin_note, '') <> ''
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."admin_resolve_content_report"("p_report_id" "uuid", "p_status" "text", "p_admin_note" "text") OWNER TO "postgres";

--
-- Name: admin_resolve_support_thread("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_resolve_support_thread"("p_thread_id" "uuid", "p_status" "text" DEFAULT 'resolved'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_status TEXT := COALESCE(NULLIF(trim(p_status), ''), 'resolved');
BEGIN
  IF v_actor IS NULL OR NOT public.can_moderate() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF v_status NOT IN ('resolved', 'closed', 'pending', 'open') THEN
    RETURN jsonb_build_object('error', 'invalid_status');
  END IF;

  UPDATE public.admin_support_threads
     SET status = v_status,
         resolved_at = CASE WHEN v_status IN ('resolved', 'closed') THEN NOW() ELSE NULL END,
         resolved_by = CASE WHEN v_status IN ('resolved', 'closed') THEN v_actor ELSE NULL END
   WHERE id = p_thread_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    v_actor,
    'support.thread.' || v_status,
    'support_thread',
    p_thread_id,
    '{}'::JSONB
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."admin_resolve_support_thread"("p_thread_id" "uuid", "p_status" "text") OWNER TO "postgres";

--
-- Name: admin_search_users("text", integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_search_users"("p_query" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 30, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "is_verified" boolean, "is_admin" boolean, "is_moderator" boolean, "is_operator" boolean, "is_creator_ops" boolean, "is_banned" boolean, "is_restricted" boolean, "restricted_until" timestamp with time zone, "is_shadow_banned" boolean, "women_only_verified" boolean, "is_creator" boolean, "created_at" timestamp with time zone, "post_count" bigint, "follower_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.is_verified,
    p.is_admin,
    COALESCE(p.is_moderator, FALSE),
    COALESCE(p.is_operator, FALSE),
    COALESCE(p.is_creator_ops, FALSE),
    COALESCE(p.is_banned, FALSE),
    COALESCE(p.is_restricted, FALSE),
    p.restricted_until,
    COALESCE(p.is_shadow_banned, FALSE),
    COALESCE(p.women_only_verified, FALSE),
    COALESCE(p.is_creator, FALSE),
    p.created_at,
    COALESCE((SELECT COUNT(*) FROM public.posts WHERE author_id = p.id), 0) AS post_count,
    COALESCE((SELECT COUNT(*) FROM public.follows WHERE following_id = p.id), 0) AS follower_count
  FROM public.profiles p
  WHERE public.is_admin()
    AND (p_query = '' OR p.username ILIKE '%' || p_query || '%' OR p.display_name ILIKE '%' || p_query || '%')
  ORDER BY p.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."admin_search_users"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";

--
-- Name: admin_sidebar_badges_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_sidebar_badges_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_pending_reports BIGINT := 0;
  v_reports_over_sla BIGINT := 0;
  v_open_support BIGINT := 0;
  v_support_over_sla BIGINT := 0;
  v_campaigns_active BIGINT := 0;
  v_campaigns_failed BIGINT := 0;
  v_r2_errors BIGINT := 0;
  v_public_video_missing_thumb BIGINT := 0;
BEGIN
  IF NOT public.has_admin_console_access() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT COUNT(*)
    INTO v_pending_reports
    FROM public.content_reports
   WHERE status = 'pending';

  SELECT COUNT(*)
    INTO v_reports_over_sla
    FROM public.content_reports
   WHERE status = 'pending'
     AND created_at < v_generated_at - INTERVAL '24 hours';

  IF to_regclass('public.admin_support_threads') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.admin_support_threads
      WHERE status IN ('open', 'pending')
    $sql$ INTO v_open_support;

    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.admin_support_threads
      WHERE status IN ('open', 'pending')
        AND created_at < NOW() - INTERVAL '24 hours'
    $sql$ INTO v_support_over_sla;
  END IF;

  SELECT COUNT(*)
    INTO v_campaigns_active
    FROM public.admin_campaigns
   WHERE status = 'active';

  SELECT COUNT(*)
    INTO v_campaigns_failed
    FROM public.admin_campaigns
   WHERE status = 'failed';

  IF to_regclass('public.r2_delete_queue') IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_r2_errors
      FROM public.r2_delete_queue
     WHERE status = 'error';
  END IF;

  SELECT COUNT(*)
    INTO v_public_video_missing_thumb
    FROM public.posts
   WHERE privacy = 'public'
     AND media_type = 'video'
     AND thumbnail_url IS NULL;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'reports', jsonb_build_object(
      'pending', v_pending_reports,
      'over_sla', v_reports_over_sla
    ),
    'support', jsonb_build_object(
      'open', v_open_support,
      'over_sla', v_support_over_sla
    ),
    'campaigns', jsonb_build_object(
      'active', v_campaigns_active,
      'failed', v_campaigns_failed,
      'status', 'ready'
    ),
    'security', jsonb_build_object(
      'critical', v_reports_over_sla + v_support_over_sla + v_r2_errors + v_public_video_missing_thumb,
      'r2_errors', v_r2_errors,
      'video_missing_thumbnail', v_public_video_missing_thumb
    )
  );
END;
$_$;


ALTER FUNCTION "public"."admin_sidebar_badges_snapshot"() OWNER TO "postgres";

--
-- Name: admin_support_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_support_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_oldest_open_age_seconds NUMERIC;
BEGIN
  IF NOT public.has_admin_console_access() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT EXTRACT(EPOCH FROM (v_generated_at - MIN(created_at)))
    INTO v_oldest_open_age_seconds
    FROM public.admin_support_threads
   WHERE status IN ('open', 'pending');

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'sla_hours', 24,
    'threads', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.admin_support_threads),
      'open', (SELECT COUNT(*) FROM public.admin_support_threads WHERE status = 'open'),
      'pending', (SELECT COUNT(*) FROM public.admin_support_threads WHERE status = 'pending'),
      'resolved_7d', (
        SELECT COUNT(*)
        FROM public.admin_support_threads
        WHERE resolved_at >= v_generated_at - INTERVAL '7 days'
      ),
      'over_sla', (
        SELECT COUNT(*)
        FROM public.admin_support_threads
        WHERE status IN ('open', 'pending')
          AND created_at < v_generated_at - INTERVAL '24 hours'
      ),
      'oldest_open_age_seconds', v_oldest_open_age_seconds,
      'by_priority', COALESCE((
        SELECT jsonb_object_agg(priority, count)
        FROM (
          SELECT priority, COUNT(*) AS count
          FROM public.admin_support_threads
          WHERE status IN ('open', 'pending')
          GROUP BY priority
          ORDER BY priority
        ) grouped
      ), '{}'::jsonb)
    ),
    'latest', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'subject', t.subject,
          'status', t.status,
          'priority', t.priority,
          'source', t.source,
          'user_id', t.user_id,
          'username', p.username,
          'last_message_at', t.last_message_at,
          'age_seconds', EXTRACT(EPOCH FROM (v_generated_at - t.created_at))
        )
        ORDER BY t.last_message_at DESC
      )
      FROM (
        SELECT *
        FROM public.admin_support_threads
        WHERE status IN ('open', 'pending')
        ORDER BY last_message_at DESC
        LIMIT 5
      ) t
      LEFT JOIN public.profiles p ON p.id = t.user_id
    ), '[]'::jsonb)
  );
END;
$$;


ALTER FUNCTION "public"."admin_support_snapshot"() OWNER TO "postgres";

--
-- Name: admin_update_payout_status("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_update_payout_status"("p_request_id" "uuid", "p_status" "text", "p_admin_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Admin-Zugriff';
  END IF;
  UPDATE payout_requests
  SET
    status       = p_status,
    admin_note   = COALESCE(p_admin_note, admin_note),
    processed_at = CASE WHEN p_status IN ('paid', 'rejected') THEN now() ELSE processed_at END
  WHERE id = p_request_id;
END;
$$;


ALTER FUNCTION "public"."admin_update_payout_status"("p_request_id" "uuid", "p_status" "text", "p_admin_note" "text") OWNER TO "postgres";

--
-- Name: admin_user_detail_snapshot("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_user_detail_snapshot"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $_$
DECLARE
  v_identity JSONB := '{}'::JSONB;
  v_audit JSONB := '[]'::JSONB;
  v_mfa_enabled BOOLEAN := NULL;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_user');
  END IF;

  IF to_regclass('auth.mfa_factors') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM auth.mfa_factors
        WHERE user_id = $1
          AND status = 'verified'
      )
    $sql$
    INTO v_mfa_enabled
    USING p_user_id;
  END IF;

  SELECT jsonb_build_object(
    'email', au.email,
    'email_confirmed_at', au.email_confirmed_at,
    'phone', au.phone,
    'phone_confirmed_at', au.phone_confirmed_at,
    'last_sign_in_at', au.last_sign_in_at,
    'confirmed_at', au.confirmed_at,
    'banned_until', au.banned_until,
    'mfa_enabled', v_mfa_enabled
  )
    INTO v_identity
    FROM auth.users au
   WHERE au.id = p_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action', al.action,
        'target_type', al.target_type,
        'target_id', al.target_id,
        'metadata', al.metadata,
        'created_at', al.created_at,
        'actor_id', al.actor_id,
        'actor_username', actor.username,
        'actor_display_name', actor.display_name
      )
      ORDER BY al.created_at DESC
    ),
    '[]'::JSONB
  )
    INTO v_audit
    FROM (
      SELECT *
      FROM public.admin_audit_log
      WHERE target_id = p_user_id
         OR metadata->>'user_id' = p_user_id::TEXT
         OR metadata->>'target_user_id' = p_user_id::TEXT
         OR metadata->>'reporter_id' = p_user_id::TEXT
      ORDER BY created_at DESC
      LIMIT 20
    ) al
    LEFT JOIN public.profiles actor ON actor.id = al.actor_id;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'identity', COALESCE(v_identity, '{}'::JSONB),
    'audit', COALESCE(v_audit, '[]'::JSONB)
  );
END;
$_$;


ALTER FUNCTION "public"."admin_user_detail_snapshot"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: admin_user_directory_page("text", "text", "text", "text", "text", "text", integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_user_directory_page"("p_query" "text" DEFAULT ''::"text", "p_status" "text" DEFAULT 'all'::"text", "p_role" "text" DEFAULT 'all'::"text", "p_verification" "text" DEFAULT 'all'::"text", "p_activity" "text" DEFAULT 'all'::"text", "p_risk" "text" DEFAULT 'all'::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "is_verified" boolean, "is_admin" boolean, "is_moderator" boolean, "is_operator" boolean, "is_creator_ops" boolean, "is_banned" boolean, "is_restricted" boolean, "restricted_until" timestamp with time zone, "is_shadow_banned" boolean, "women_only_verified" boolean, "is_creator" boolean, "created_at" timestamp with time zone, "post_count" bigint, "follower_count" bigint, "comment_count" bigint, "report_count" bigint, "last_activity_at" timestamp with time zone, "risk_level" "text", "total_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
  WITH post_counts AS (
    SELECT author_id AS user_id, COUNT(*)::BIGINT AS post_count
    FROM public.posts
    WHERE author_id IS NOT NULL
    GROUP BY author_id
  ),
  comment_counts AS (
    SELECT user_id, COUNT(*)::BIGINT AS comment_count
    FROM public.comments
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ),
  follower_counts AS (
    SELECT following_id AS user_id, COUNT(*)::BIGINT AS follower_count
    FROM public.follows
    WHERE following_id IS NOT NULL
    GROUP BY following_id
  ),
  report_counts AS (
    SELECT target_id AS user_id, COUNT(*)::BIGINT AS report_count
    FROM public.content_reports
    WHERE target_type = 'profile'
    GROUP BY target_id
  ),
  activity_events AS (
    SELECT author_id AS user_id, created_at FROM public.posts WHERE author_id IS NOT NULL
    UNION ALL
    SELECT user_id, created_at FROM public.comments WHERE user_id IS NOT NULL
    UNION ALL
    SELECT user_id, created_at FROM public.likes WHERE user_id IS NOT NULL
    UNION ALL
    SELECT user_id, created_at FROM public.bookmarks WHERE user_id IS NOT NULL
    UNION ALL
    SELECT follower_id AS user_id, created_at FROM public.follows WHERE follower_id IS NOT NULL
  ),
  last_activity AS (
    SELECT user_id, MAX(created_at) AS last_activity_at
    FROM activity_events
    GROUP BY user_id
  ),
  enriched AS (
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      COALESCE(p.is_verified, FALSE) AS is_verified,
      COALESCE(p.is_admin, FALSE) AS is_admin,
      COALESCE(p.is_moderator, FALSE) AS is_moderator,
      COALESCE(p.is_operator, FALSE) AS is_operator,
      COALESCE(p.is_creator_ops, FALSE) AS is_creator_ops,
      COALESCE(p.is_banned, FALSE) AS is_banned,
      COALESCE(p.is_restricted, FALSE) AS is_restricted,
      p.restricted_until,
      COALESCE(p.is_shadow_banned, FALSE) AS is_shadow_banned,
      COALESCE(p.women_only_verified, FALSE) AS women_only_verified,
      COALESCE(p.is_creator, FALSE) AS is_creator,
      p.created_at,
      COALESCE(pc.post_count, 0) AS post_count,
      COALESCE(fc.follower_count, 0) AS follower_count,
      COALESCE(cc.comment_count, 0) AS comment_count,
      COALESCE(rc.report_count, 0) AS report_count,
      la.last_activity_at,
      CASE
        WHEN COALESCE(p.is_banned, FALSE)
          OR COALESCE(p.is_shadow_banned, FALSE)
          OR COALESCE(rc.report_count, 0) >= 3 THEN 'high'
        WHEN COALESCE(p.is_restricted, FALSE)
          OR COALESCE(rc.report_count, 0) > 0 THEN 'medium'
        ELSE 'low'
      END AS risk_level,
      au.email
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    LEFT JOIN post_counts pc ON pc.user_id = p.id
    LEFT JOIN follower_counts fc ON fc.user_id = p.id
    LEFT JOIN comment_counts cc ON cc.user_id = p.id
    LEFT JOIN report_counts rc ON rc.user_id = p.id
    LEFT JOIN last_activity la ON la.user_id = p.id
    WHERE public.is_admin()
      AND (
        COALESCE(p_query, '') = ''
        OR p.username ILIKE '%' || p_query || '%'
        OR p.display_name ILIKE '%' || p_query || '%'
        OR p.id::TEXT ILIKE '%' || p_query || '%'
        OR au.email ILIKE '%' || p_query || '%'
      )
  ),
  filtered AS (
    SELECT *
    FROM enriched
    WHERE
      (p_status = 'all'
        OR (p_status = 'banned' AND is_banned)
        OR (p_status = 'restricted' AND (is_restricted OR is_shadow_banned))
        OR (p_status = 'active' AND NOT is_banned AND NOT is_restricted AND NOT is_shadow_banned))
      AND (p_role = 'all'
        OR (p_role = 'admin' AND is_admin)
        OR (p_role = 'moderator' AND is_moderator)
        OR (p_role = 'operator' AND is_operator)
        OR (p_role = 'creator_ops' AND is_creator_ops)
        OR (p_role = 'creator' AND is_creator AND NOT is_admin AND NOT is_moderator AND NOT is_operator AND NOT is_creator_ops)
        OR (p_role = 'user' AND NOT is_admin AND NOT is_moderator AND NOT is_operator AND NOT is_creator_ops AND NOT is_creator))
      AND (p_verification = 'all'
        OR (p_verification = 'verified' AND is_verified)
        OR (p_verification = 'unverified' AND NOT is_verified))
      AND (p_activity = 'all'
        OR (p_activity = 'active_30d' AND last_activity_at >= NOW() - INTERVAL '30 days')
        OR (p_activity = 'inactive_30d' AND (last_activity_at IS NULL OR last_activity_at < NOW() - INTERVAL '30 days')))
      AND (p_risk = 'all' OR risk_level = p_risk)
  )
  SELECT
    filtered.id,
    filtered.username,
    filtered.display_name,
    filtered.avatar_url,
    filtered.is_verified,
    filtered.is_admin,
    filtered.is_moderator,
    filtered.is_operator,
    filtered.is_creator_ops,
    filtered.is_banned,
    filtered.is_restricted,
    filtered.restricted_until,
    filtered.is_shadow_banned,
    filtered.women_only_verified,
    filtered.is_creator,
    filtered.created_at,
    filtered.post_count,
    filtered.follower_count,
    filtered.comment_count,
    filtered.report_count,
    filtered.last_activity_at,
    filtered.risk_level,
    COUNT(*) OVER ()::BIGINT AS total_count
  FROM filtered
  ORDER BY filtered.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;


ALTER FUNCTION "public"."admin_user_directory_page"("p_query" "text", "p_status" "text", "p_role" "text", "p_verification" "text", "p_activity" "text", "p_risk" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";

--
-- Name: announce_preorder_round("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."announce_preorder_round"("p_product_id" "uuid", "p_message" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_msg     text;
  v_count   int := 0;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','product_not_found'); END IF;

  IF v_product.seller_id <> v_caller AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  v_msg := COALESCE(
    NULLIF(btrim(p_message), ''),
    'Sammelbestellung läuft! 🌸 „' || v_product.title
      || '" wird gerade gesammelt — jetzt sichern, solange das Fenster offen ist.'
  );

  WITH audience AS (
    SELECT user_id AS uid FROM public.product_preorders
      WHERE product_id = p_product_id AND status IN ('interested','notified')
    UNION
    SELECT user_id AS uid FROM public.saved_products
      WHERE product_id = p_product_id
  ),
  ins AS (
    INSERT INTO public.notifications
      (recipient_id, sender_id, type, comment_text, product_name, product_id)
    SELECT a.uid, v_caller, 'preorder_round_open', v_msg, v_product.title, p_product_id
      FROM audience a
     WHERE a.uid <> v_caller
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  RETURN jsonb_build_object('success', true, 'notified', v_count);
EXCEPTION WHEN OTHERS THEN
  -- Echten Fehler zurückgeben statt hart zu scheitern (Diagnose + kein Crash).
  RETURN jsonb_build_object('error', 'exception', 'detail', SQLERRM);
END $$;


ALTER FUNCTION "public"."announce_preorder_round"("p_product_id" "uuid", "p_message" "text") OWNER TO "postgres";

--
-- Name: approve_cohost("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."approve_cohost"("p_session_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_host       uuid := auth.uid();
  v_slot       int;
  v_active_cnt int;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
     WHERE id = p_session_id
       AND host_id = v_host
       AND status  = 'active'
  ) THEN
    RAISE EXCEPTION 'Nicht Host dieser aktiven Session'
      USING ERRCODE = '42501';
  END IF;

  -- Phase 5: Block-Check
  IF public.is_cohost_blocked(v_host, p_user_id) THEN
    RAISE EXCEPTION 'User ist blockiert — erst entblocken in den Einstellungen'
      USING ERRCODE = '42501', HINT = 'blocked';
  END IF;

  -- Phase 3: Kapazitäts-Check. Max 8 aktive Co-Hosts pro Session
  -- (9 Streams inkl. Host = TikTok Multi-Guest Limit).
  SELECT COUNT(*) INTO v_active_cnt
    FROM public.live_cohosts
   WHERE session_id = p_session_id
     AND revoked_at IS NULL;

  IF v_active_cnt >= 8 AND NOT EXISTS (
    -- Ausnahme: User ist schon drin (Update-Path bei Re-Approve)
    SELECT 1 FROM public.live_cohosts
     WHERE session_id = p_session_id
       AND user_id = p_user_id
       AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Max. 8 Co-Hosts pro Session erreicht'
      USING ERRCODE = '22023', HINT = 'capacity';
  END IF;

  -- Kleinster freier slot_index finden (0..7).
  -- generate_series liefert 0..7, LEFT JOIN zeigt freie Slots als NULL.
  SELECT s.idx INTO v_slot
    FROM generate_series(0, 7) AS s(idx)
    LEFT JOIN public.live_cohosts lc
      ON lc.session_id = p_session_id
     AND lc.slot_index = s.idx
     AND lc.revoked_at IS NULL
   WHERE lc.user_id IS NULL OR lc.user_id = p_user_id
   ORDER BY s.idx
   LIMIT 1;

  IF v_slot IS NULL THEN
    v_slot := 0; -- fallback (sollte nie passieren wegen Kapazitäts-Check oben)
  END IF;

  INSERT INTO public.live_cohosts (session_id, user_id, invited_by, slot_index)
  VALUES (p_session_id, p_user_id, v_host, v_slot)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET invited_by  = EXCLUDED.invited_by,
        approved_at = now(),
        revoked_at  = NULL,
        slot_index  = EXCLUDED.slot_index;
END;
$$;


ALTER FUNCTION "public"."approve_cohost"("p_session_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: approve_women_only("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."approve_women_only"("p_user" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  PERFORM set_config('app.woz_bypass', 'on', true);
  UPDATE profiles
     SET women_only_verified = true, verification_level = 2, gender = 'female'
   WHERE id = p_user;

  INSERT INTO women_only_requests (user_id, status, method, reviewed_at, reviewed_by)
       VALUES (p_user, 'approved', 'admin', now(), v_uid)
  ON CONFLICT (user_id) DO UPDATE
       SET status = 'approved', reviewed_at = now(), reviewed_by = v_uid, note = NULL;

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES (v_uid, 'woz_approve', 'profile', p_user, '{}'::jsonb);

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."approve_women_only"("p_user" "uuid") OWNER TO "postgres";

--
-- Name: archive_expired_stories(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."archive_expired_stories"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.stories
  SET archived = true
  WHERE archived = false
    AND created_at < now() - interval '24 hours';
END;
$$;


ALTER FUNCTION "public"."archive_expired_stories"() OWNER TO "postgres";

--
-- Name: assign_preorder_round(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."assign_preorder_round"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE v_round uuid;
BEGIN
  IF NEW.status = 'interested' THEN
    SELECT id INTO v_round
      FROM public.preorder_rounds
      WHERE product_id = NEW.product_id AND status = 'open'
      ORDER BY created_at DESC LIMIT 1;
    NEW.round_id := v_round;  -- NULL wenn keine offene Runde
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_preorder_round"() OWNER TO "postgres";

--
-- Name: auto_score_post(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."auto_score_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tags       TEXT[];
  v_explore    FLOAT := 0.5;   -- Default: mittig
  v_brain      FLOAT := 0.5;   -- Default: mittig
  v_tag        TEXT;
  v_e_sum      FLOAT := 0.0;
  v_b_sum      FLOAT := 0.0;
  v_count      INT   := 0;
BEGIN
  -- Tags normalisiert
  v_tags := COALESCE(NEW.tags, '{}');

  -- Score nur berechnen wenn Tags vorhanden
  IF array_length(v_tags, 1) IS NULL OR array_length(v_tags, 1) = 0 THEN
    NEW.score_explore := 0.5;
    NEW.score_brain   := 0.5;
    RETURN NEW;
  END IF;

  -- Tag-Mapping: (explore_score, brain_score)
  -- explore: 1.0 = viral/visual, 0.0 = nischig/ruhig
  -- brain:   1.0 = informativ, 0.0 = entertainment
  FOREACH v_tag IN ARRAY v_tags LOOP
    v_tag := LOWER(v_tag);
    CASE v_tag
      WHEN 'vibes'        THEN v_e_sum := v_e_sum + 0.8; v_b_sum := v_b_sum + 0.2;
      WHEN 'music'        THEN v_e_sum := v_e_sum + 0.85; v_b_sum := v_b_sum + 0.25;
      WHEN 'fashion'      THEN v_e_sum := v_e_sum + 0.95; v_b_sum := v_b_sum + 0.1;
      WHEN 'art'          THEN v_e_sum := v_e_sum + 0.7;  v_b_sum := v_b_sum + 0.45;
      WHEN 'food'         THEN v_e_sum := v_e_sum + 0.8;  v_b_sum := v_b_sum + 0.3;
      WHEN 'travel'       THEN v_e_sum := v_e_sum + 0.9;  v_b_sum := v_b_sum + 0.35;
      WHEN 'life'         THEN v_e_sum := v_e_sum + 0.7;  v_b_sum := v_b_sum + 0.3;
      WHEN 'meme'         THEN v_e_sum := v_e_sum + 0.9;  v_b_sum := v_b_sum + 0.1;
      WHEN 'fitness'      THEN v_e_sum := v_e_sum + 0.65; v_b_sum := v_b_sum + 0.55;
      WHEN 'photography'  THEN v_e_sum := v_e_sum + 0.85; v_b_sum := v_b_sum + 0.4;
      WHEN 'coding'       THEN v_e_sum := v_e_sum + 0.3;  v_b_sum := v_b_sum + 0.95;
      WHEN 'tech'         THEN v_e_sum := v_e_sum + 0.4;  v_b_sum := v_b_sum + 0.9;
      WHEN 'ai'           THEN v_e_sum := v_e_sum + 0.45; v_b_sum := v_b_sum + 0.95;
      WHEN 'design'       THEN v_e_sum := v_e_sum + 0.65; v_b_sum := v_b_sum + 0.7;
      WHEN 'architecture' THEN v_e_sum := v_e_sum + 0.55; v_b_sum := v_b_sum + 0.8;
      WHEN 'gaming'       THEN v_e_sum := v_e_sum + 0.7;  v_b_sum := v_b_sum + 0.4;
      WHEN 'lifestyle'    THEN v_e_sum := v_e_sum + 0.75; v_b_sum := v_b_sum + 0.3;
      WHEN 'nature'       THEN v_e_sum := v_e_sum + 0.75; v_b_sum := v_b_sum + 0.4;
      ELSE
        -- Unbekannte Tags: mittig
        v_e_sum := v_e_sum + 0.5;
        v_b_sum := v_b_sum + 0.5;
    END CASE;
    v_count := v_count + 1;
  END LOOP;

  -- Durchschnitt der Tags
  IF v_count > 0 THEN
    v_explore := v_e_sum / v_count;
    v_brain   := v_b_sum / v_count;
  END IF;

  -- ONLY set if not already set by caller
  NEW.score_explore := COALESCE(NEW.score_explore, v_explore);
  NEW.score_brain   := COALESCE(NEW.score_brain,   v_brain);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_score_post"() OWNER TO "postgres";

--
-- Name: berkat_server_time(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."berkat_server_time"() RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE
    AS $$ SELECT now() $$;


ALTER FUNCTION "public"."berkat_server_time"() OWNER TO "postgres";

--
-- Name: block_cohost("uuid", "text", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."block_cohost"("p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text", "p_duration_hours" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_host    uuid := auth.uid();
  v_expires timestamptz;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_host = p_user_id THEN
    RAISE EXCEPTION 'Kann dich nicht selbst blockieren' USING ERRCODE = '22023';
  END IF;

  IF p_duration_hours IS NOT NULL THEN
    v_expires := now() + make_interval(hours => p_duration_hours);
  END IF;

  INSERT INTO public.live_cohost_blocks (host_id, blocked_user_id, reason, expires_at)
  VALUES (v_host, p_user_id, p_reason, v_expires)
  ON CONFLICT (host_id, blocked_user_id) DO UPDATE
    SET reason     = COALESCE(EXCLUDED.reason, live_cohost_blocks.reason),
        expires_at = EXCLUDED.expires_at,
        created_at = now();
END;
$$;


ALTER FUNCTION "public"."block_cohost"("p_user_id" "uuid", "p_reason" "text", "p_duration_hours" integer) OWNER TO "postgres";

--
-- Name: block_user("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."block_user"("p_blocked_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR p_blocked_id = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT DO NOTHING;

  -- Bestehende Follows in BEIDE Richtungen entfernen.
  DELETE FROM follows
   WHERE (follower_id = auth.uid()   AND following_id = p_blocked_id)
      OR (follower_id = p_blocked_id AND following_id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."block_user"("p_blocked_id" "uuid") OWNER TO "postgres";

--
-- Name: bump_product_sold_count("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."bump_product_sold_count"("p_product_id" "uuid", "p_qty" integer) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.products
     SET sold_count = sold_count + GREATEST(COALESCE(p_qty, 1), 0)
   WHERE id = p_product_id;
$$;


ALTER FUNCTION "public"."bump_product_sold_count"("p_product_id" "uuid", "p_qty" integer) OWNER TO "postgres";

--
-- Name: buy_now_live_auction("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."buy_now_live_auction"("p_auction_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a       public.live_auctions;
  v_uid   uuid := auth.uid();
  v_cart  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.buy_now_cents IS NULL THEN
    RAISE EXCEPTION 'no_buy_now' USING ERRCODE = '22023';
  END IF;
  IF a.status NOT IN ('scheduled', 'running') THEN
    RAISE EXCEPTION 'auction_closed' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;
  -- Sobald jemand über dem Sofortkaufpreis bietet, ist der Sofortkauf weg.
  IF a.current_bid_cents IS NOT NULL AND a.current_bid_cents >= a.buy_now_cents THEN
    RAISE EXCEPTION 'buy_now_gone' USING ERRCODE = '22023';
  END IF;

  v_cart := public.ensure_auction_cart(v_uid, a.seller_id);

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (a.id, v_uid, a.buy_now_cents);

  UPDATE public.live_auctions
     SET status            = 'sold',
         current_bid_cents = a.buy_now_cents,
         current_bidder_id = v_uid,
         winner_id         = v_uid,
         bid_count         = a.bid_count + 1,
         settled_at        = now(),
         ends_at           = now(),
         cart_id           = v_cart
   WHERE id = a.id;

  RETURN jsonb_build_object(
    'auction_id', a.id,
    'status',     'sold',
    'winner_id',  v_uid,
    'cart_id',    v_cart,
    'paid_cents', a.buy_now_cents
  );
END $$;


ALTER FUNCTION "public"."buy_now_live_auction"("p_auction_id" "uuid") OWNER TO "postgres";

--
-- Name: buy_product("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."buy_product"("p_product_id" "uuid", "p_quantity" integer DEFAULT 1) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_buyer_id       UUID := auth.uid();
  v_product        public.products%ROWTYPE;
  v_unit_price     INTEGER;
  v_cost           INTEGER;
  v_buyer_coins    INTEGER;
  v_diamond_credit INTEGER;
  v_order_id       UUID;
BEGIN
  -- Quantity-Guard: verhindert negative/absurde Mengen VOR jeder Rechnung.
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 999 THEN
    RETURN jsonb_build_object('error', 'bad_quantity');
  END IF;

  SELECT * INTO v_product FROM public.products
  WHERE id = p_product_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'product_not_found');
  END IF;

  IF v_product.seller_id = v_buyer_id THEN
    RETURN jsonb_build_object('error', 'cannot_buy_own');
  END IF;

  IF v_product.stock >= 0 AND v_product.stock < p_quantity THEN
    RETURN jsonb_build_object('error', 'out_of_stock');
  END IF;

  -- v1.26.3: Angebotspreis hat Vorrang wenn gesetzt.
  v_unit_price := COALESCE(v_product.sale_price_coins, v_product.price_coins);
  v_cost       := v_unit_price * p_quantity;

  -- FOR UPDATE: sperrt die Käufer-Wallet bis zum Transaktions-Ende, damit
  -- parallele Käufe serialisiert werden (kein TOCTOU-Race, kein negativer
  -- Saldo via CHECK-Constraint-Fehler). Parität mit send_gift/send_creator_tip.
  SELECT coins INTO v_buyer_coins
    FROM public.coins_wallets
   WHERE user_id = v_buyer_id
   FOR UPDATE;

  IF v_buyer_coins IS NULL THEN
    RETURN jsonb_build_object('error', 'no_wallet');
  END IF;

  IF v_buyer_coins < v_cost THEN
    RETURN jsonb_build_object('error', 'insufficient_coins');
  END IF;

  UPDATE public.coins_wallets
     SET coins = coins - v_cost
   WHERE user_id = v_buyer_id;

  v_diamond_credit := GREATEST(1, ROUND(v_cost * 0.125));
  INSERT INTO public.coins_wallets (user_id, coins, diamonds)
       VALUES (v_product.seller_id, 0, v_diamond_credit)
  ON CONFLICT (user_id)
  DO UPDATE SET diamonds = coins_wallets.diamonds + v_diamond_credit;

  INSERT INTO public.orders
    (buyer_id, seller_id, product_id, quantity, total_coins, status)
  VALUES
    (v_buyer_id, v_product.seller_id, p_product_id, p_quantity, v_cost, 'pending')
  RETURNING id INTO v_order_id;

  UPDATE public.products
     SET sold_count = sold_count + p_quantity,
         stock      = CASE WHEN stock >= 0 THEN stock - p_quantity ELSE stock END
   WHERE id = p_product_id;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, comment_text)
  VALUES
    (v_product.seller_id, v_buyer_id, 'gift',
     format('%s × %s gekauft (%s Coins)', p_quantity, v_product.title, v_cost));

  RETURN jsonb_build_object(
    'success',     true,
    'order_id',    v_order_id,
    'new_balance', v_buyer_coins - v_cost
  );
END;
$$;


ALTER FUNCTION "public"."buy_product"("p_product_id" "uuid", "p_quantity" integer) OWNER TO "postgres";

--
-- Name: calculate_vibe_scores(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."calculate_vibe_scores"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_brain   FLOAT := 0;
  v_explore FLOAT := 0;
  v_count   INT   := 0;
  v_tag     TEXT;
  tag_brain   FLOAT;
  tag_explore FLOAT;

  -- Caption-Signal
  v_cap_brain   FLOAT;
  v_cap_explore FLOAT;
BEGIN

  -- ── SCHRITT 1: Tag-Scores berechnen (wie bisher) ─────────────────────────
  IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
    FOREACH v_tag IN ARRAY NEW.tags LOOP
      v_tag := lower(trim(v_tag));
      CASE v_tag
        WHEN 'tech'         THEN tag_brain := 0.92; tag_explore := 0.22;
        WHEN 'science'      THEN tag_brain := 0.90; tag_explore := 0.30;
        WHEN 'architecture' THEN tag_brain := 0.72; tag_explore := 0.55;
        WHEN 'design'       THEN tag_brain := 0.68; tag_explore := 0.62;
        WHEN 'art'          THEN tag_brain := 0.42; tag_explore := 0.88;
        WHEN 'photography'  THEN tag_brain := 0.38; tag_explore := 0.78;
        WHEN 'film'         THEN tag_brain := 0.45; tag_explore := 0.72;
        WHEN 'travel'       THEN tag_brain := 0.32; tag_explore := 0.92;
        WHEN 'nature'       THEN tag_brain := 0.30; tag_explore := 0.82;
        WHEN 'adventure'    THEN tag_brain := 0.28; tag_explore := 0.90;
        WHEN 'music'        THEN tag_brain := 0.35; tag_explore := 0.65;
        WHEN 'dance'        THEN tag_brain := 0.25; tag_explore := 0.68;
        WHEN 'comedy'       THEN tag_brain := 0.18; tag_explore := 0.58;
        WHEN 'food'         THEN tag_brain := 0.22; tag_explore := 0.48;
        WHEN 'fashion'      THEN tag_brain := 0.20; tag_explore := 0.52;
        WHEN 'beauty'       THEN tag_brain := 0.18; tag_explore := 0.50;
        WHEN 'sport'        THEN tag_brain := 0.28; tag_explore := 0.42;
        WHEN 'fitness'      THEN tag_brain := 0.32; tag_explore := 0.38;
        WHEN 'gaming'       THEN tag_brain := 0.40; tag_explore := 0.55;
        WHEN 'mindfulness'  THEN tag_brain := 0.62; tag_explore := 0.70;
        WHEN 'motivation'   THEN tag_brain := 0.55; tag_explore := 0.60;
        WHEN 'business'     THEN tag_brain := 0.80; tag_explore := 0.35;
        ELSE tag_brain := 0.50; tag_explore := 0.50;
      END CASE;
      v_brain   := v_brain   + tag_brain;
      v_explore := v_explore + tag_explore;
      v_count   := v_count   + 1;
    END LOOP;
  END IF;

  -- ── SCHRITT 2: Caption-Scores berechnen (NEU) ─────────────────────────────
  SELECT c_brain, c_explore
  INTO   v_cap_brain, v_cap_explore
  FROM   public._caption_to_scores(NEW.caption)
  LIMIT  1;

  -- ── SCHRITT 3: Blending ───────────────────────────────────────────────────
  IF v_count > 0 AND v_cap_brain IS NOT NULL THEN
    -- Beide Signale vorhanden: 70% Tags + 30% Caption
    NEW.score_brain   := ROUND(((v_brain   / v_count) * 0.70 + v_cap_brain   * 0.30)::NUMERIC, 2);
    NEW.score_explore := ROUND(((v_explore / v_count) * 0.70 + v_cap_explore * 0.30)::NUMERIC, 2);

  ELSIF v_count > 0 THEN
    -- Nur Tag-Signal
    NEW.score_brain   := ROUND((v_brain   / v_count)::NUMERIC, 2);
    NEW.score_explore := ROUND((v_explore / v_count)::NUMERIC, 2);

  ELSIF v_cap_brain IS NOT NULL THEN
    -- Nur Caption-Signal (bisher: immer 0.5/0.5 — jetzt korrekt!)
    NEW.score_brain   := ROUND(v_cap_brain::NUMERIC,   2);
    NEW.score_explore := ROUND(v_cap_explore::NUMERIC, 2);

  ELSE
    -- Kein Signal → neutral
    NEW.score_brain   := 0.50;
    NEW.score_explore := 0.50;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_vibe_scores"() OWNER TO "postgres";

--
-- Name: can_creator_ops(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."can_creator_ops"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (
      SELECT is_admin OR is_creator_ops
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    FALSE
  );
$$;


ALTER FUNCTION "public"."can_creator_ops"() OWNER TO "postgres";

--
-- Name: can_moderate(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."can_moderate"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (
      SELECT is_admin OR is_moderator
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    FALSE
  );
$$;


ALTER FUNCTION "public"."can_moderate"() OWNER TO "postgres";

--
-- Name: can_operate(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."can_operate"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (
      SELECT is_admin OR is_operator
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    FALSE
  );
$$;


ALTER FUNCTION "public"."can_operate"() OWNER TO "postgres";

--
-- Name: cancel_duet_invite("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cancel_duet_invite"("p_invite_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_invite public.live_duet_invites%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_invite FROM public.live_duet_invites WHERE id = p_invite_id;
  IF v_invite.id IS NULL THEN RETURN; END IF;

  -- Sender = host bei host-to-viewer; invitee bei viewer-to-host
  IF v_invite.direction = 'host-to-viewer' AND v_caller <> v_invite.host_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;
  IF v_invite.direction = 'viewer-to-host' AND v_caller <> v_invite.invitee_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_duet_invites
     SET status = 'cancelled', responded_at = NOW()
   WHERE id = p_invite_id AND status = 'pending';
END;
$$;


ALTER FUNCTION "public"."cancel_duet_invite"("p_invite_id" "uuid") OWNER TO "postgres";

--
-- Name: cancel_live_auction("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cancel_live_auction"("p_auction_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a     public.live_auctions;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF a.status NOT IN ('scheduled', 'running') THEN
    RAISE EXCEPTION 'auction_closed' USING ERRCODE = '22023';
  END IF;
  IF a.bid_count > 0 THEN
    RAISE EXCEPTION 'has_bids' USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_auctions
     SET status = 'cancelled', settled_at = now(), ends_at = now()
   WHERE id = a.id;

  RETURN jsonb_build_object('auction_id', a.id, 'status', 'cancelled');
END $$;


ALTER FUNCTION "public"."cancel_live_auction"("p_auction_id" "uuid") OWNER TO "postgres";

--
-- Name: cancel_product_order("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cancel_product_order"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order  public.product_orders%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_order.buyer_id <> v_caller THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('error','already_paid');
  END IF;
  IF v_order.status <> 'payment_requested' THEN
    RETURN jsonb_build_object('error','not_cancellable');
  END IF;

  UPDATE public.product_orders
     SET status = 'cancelled', updated_at = now()
   WHERE id = p_order_id;

  IF v_order.preorder_id IS NOT NULL THEN
    DELETE FROM public.product_preorders WHERE id = v_order.preorder_id;
  END IF;

  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    VALUES (v_order.seller_id, v_caller, 'order_cancelled', 'Eine Bestellung wurde storniert.');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END $$;


ALTER FUNCTION "public"."cancel_product_order"("p_order_id" "uuid") OWNER TO "postgres";

--
-- Name: cancel_scheduled_live("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cancel_scheduled_live"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.scheduled_lives
     SET status = 'cancelled'
   WHERE id = p_id
     AND host_id = v_caller
     AND status IN ('scheduled','reminded');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Live nicht gefunden oder nicht mehr abbrechbar'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


ALTER FUNCTION "public"."cancel_scheduled_live"("p_id" "uuid") OWNER TO "postgres";

--
-- Name: cancel_scheduled_post("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cancel_scheduled_post"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  UPDATE public.scheduled_posts
     SET status = 'cancelled'
   WHERE id = p_id AND author_id = v_caller AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Post nicht gefunden oder nicht mehr abbrechbar'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


ALTER FUNCTION "public"."cancel_scheduled_post"("p_id" "uuid") OWNER TO "postgres";

--
-- Name: check_ai_image_rate_limit("uuid", "public"."ai_image_purpose"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."check_ai_image_rate_limit"("p_user_id" "uuid", "p_purpose" "public"."ai_image_purpose") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_feature_enabled BOOLEAN;
  v_platform_cents  INT;
  v_platform_cap    CONSTANT INT := 5000;  -- $50 = 5000 Cents, 30-Tage-Fenster
  v_count_day       INT;
  v_count_week      INT;
BEGIN
  -- Gate 0: Feature-Flag
  SELECT public.is_feature_enabled('ai_image_enabled') INTO v_feature_enabled;
  IF NOT v_feature_enabled THEN
    RETURN 'feature_disabled';
  END IF;

  -- Gate 1: Platform-Budget (global über alle User, 30-Tage-Rolling)
  -- Wichtig: wir summieren ALLE Rows, auch fehlgeschlagene mit cost_cents=0,
  -- die zählen im Default nicht mit. Successful Runs haben cost_cents>=4.
  SELECT COALESCE(SUM(cost_cents), 0) INTO v_platform_cents
    FROM public.ai_image_generations
   WHERE created_at > NOW() - INTERVAL '30 days';
  IF v_platform_cents >= v_platform_cap THEN
    RETURN 'platform_budget_exhausted';
  END IF;

  -- Gate 2: User-Daily (3 pro rollendem 24h-Fenster)
  SELECT COUNT(*) INTO v_count_day
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '24 hours';
  IF v_count_day >= 3 THEN
    RETURN 'rate_limit_day';
  END IF;

  -- Gate 3: User-Weekly (10 pro rollendem 7d-Fenster)
  SELECT COUNT(*) INTO v_count_week
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '7 days';
  IF v_count_week >= 10 THEN
    RETURN 'rate_limit_week';
  END IF;

  RETURN 'ok';
END;
$_$;


ALTER FUNCTION "public"."check_ai_image_rate_limit"("p_user_id" "uuid", "p_purpose" "public"."ai_image_purpose") OWNER TO "postgres";

--
-- Name: checkout_auction_cart("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."checkout_auction_cart"("p_cart_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  c           public.auction_carts;
  v_uid       uuid := auth.uid();
  v_total     bigint;
  v_items     int;
  v_title     text;
  v_order_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.auction_carts WHERE id = p_cart_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cart_not_found' USING ERRCODE = '22023';
  END IF;
  IF c.buyer_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Idempotenz VOR der Zustandsprüfung. Ein Korb in der Kasse ist nicht mehr
  -- `open`; wer eine abgebrochene Zahlung nachholt, muss trotzdem wieder zu
  -- seiner Bestellung finden.
  SELECT id INTO v_order_id
    FROM public.product_orders
   WHERE cart_id = p_cart_id AND status = 'payment_requested'
   LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  IF c.status <> 'open' THEN
    RAISE EXCEPTION 'cart_closed' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(current_bid_cents), 0), COUNT(*)
    INTO v_total, v_items
    FROM public.live_auctions
   WHERE cart_id = p_cart_id AND status = 'sold';

  IF v_items = 0 OR v_total <= 0 THEN
    RAISE EXCEPTION 'cart_empty' USING ERRCODE = '22023';
  END IF;

  SELECT CASE
           WHEN v_items = 1 THEN MIN(title)
           ELSE format('%s Artikel aus der Live-Show', v_items)
         END
    INTO v_title
    FROM public.live_auctions
   WHERE cart_id = p_cart_id AND status = 'sold';

  INSERT INTO public.product_orders (
    buyer_id, seller_id, product_id, cart_id, title,
    quantity, unit_price_eur, amount_eur, currency, status, payment_requested_at
  ) VALUES (
    v_uid, c.seller_id, NULL, p_cart_id, v_title,
    1, (v_total::numeric / 100), (v_total::numeric / 100), 'eur',
    'payment_requested', now()
  )
  RETURNING id INTO v_order_id;

  -- Ab hier nimmt dieser Korb nichts mehr auf. Was danach gewonnen wird,
  -- landet in einem frischen Korb und wird eine eigene Bestellung.
  UPDATE public.auction_carts
     SET status = 'checkout_pending'
   WHERE id = p_cart_id;

  RETURN v_order_id;
END $$;


ALTER FUNCTION "public"."checkout_auction_cart"("p_cart_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "checkout_auction_cart"("p_cart_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."checkout_auction_cart"("p_cart_id" "uuid") IS 'Berkat: macht aus einem Sammelkorb genau eine Bestellung und friert ihn dabei ein. Idempotent.';


--
-- Name: claim_referral("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."claim_referral"("p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_ref uuid;
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Schon attribuiert → nichts tun (idempotent, kein Überschreiben).
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_me AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('success', true, 'already', true);
  END IF;

  SELECT id INTO v_ref
    FROM public.profiles
   WHERE lower(username) = lower(btrim(p_code));

  IF v_ref IS NULL OR v_ref = v_me THEN
    RETURN jsonb_build_object('error', 'invalid_code');
  END IF;

  UPDATE public.profiles
     SET referred_by = v_ref
   WHERE id = v_me AND referred_by IS NULL;

  RETURN jsonb_build_object('success', true, 'referrer', v_ref);
END $$;


ALTER FUNCTION "public"."claim_referral"("p_code" "text") OWNER TO "postgres";

--
-- Name: classify_post_moderation("text", "text"[], "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."classify_post_moderation"("p_caption" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_media_type" "text" DEFAULT NULL::"text", "p_media_url" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_text TEXT := lower(
    COALESCE(p_caption, '') || ' ' ||
    COALESCE(array_to_string(p_tags, ' '), '') || ' ' ||
    COALESCE(p_media_type, '') || ' ' ||
    COALESCE(p_media_url, '')
  );
  v_reasons TEXT[] := ARRAY[]::TEXT[];
  v_confidence NUMERIC := 0;
BEGIN
  IF v_text ~ '(free[[:space:]-]*money|cashapp|whatsapp|telegram|airdrop|crypto[[:space:]-]*(profit|pump|signal)|double[[:space:]-]*your[[:space:]-]*money|work[[:space:]-]*from[[:space:]-]*home|only[[:space:]-]*fans|bit\.ly|t\.me/|wa\.me/)' THEN
    v_reasons := array_append(v_reasons, 'auto_spam');
    v_confidence := greatest(v_confidence, 0.75);
  END IF;

  IF v_text ~ '(nude|nudity|nsfw|porn|xxx|sex[[:space:]-]*(chat|video|cam)|explicit|18\+|adult[[:space:]-]*content)' THEN
    v_reasons := array_append(v_reasons, 'auto_nsfw');
    v_confidence := greatest(v_confidence, 0.8);
  END IF;

  IF v_text ~ '(giveaway|investment|forex|loan|casino|betting|jackpot|guaranteed[[:space:]-]*(profit|return)|send[[:space:]-]*me[[:space:]-]*(money|crypto))' THEN
    v_reasons := array_append(v_reasons, 'auto_scam');
    v_confidence := greatest(v_confidence, 0.7);
  END IF;

  RETURN jsonb_build_object(
    'flagged', cardinality(v_reasons) > 0,
    'reasons', COALESCE(to_jsonb(v_reasons), '[]'::jsonb),
    'confidence', v_confidence,
    'classifier', 'keyword-v1'
  );
END;
$$;


ALTER FUNCTION "public"."classify_post_moderation"("p_caption" "text", "p_tags" "text"[], "p_media_type" "text", "p_media_url" "text") OWNER TO "postgres";

--
-- Name: close_cart_on_order_paid(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."close_cart_on_order_paid"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'paid'
     AND OLD.status IS DISTINCT FROM 'paid'
     AND NEW.cart_id IS NOT NULL THEN
    UPDATE public.auction_carts
       SET status = 'checked_out'
     WHERE id = NEW.cart_id
       AND status IN ('open', 'checkout_pending');
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."close_cart_on_order_paid"() OWNER TO "postgres";

--
-- Name: close_preorder_round("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."close_preorder_round"("p_round_id" "uuid", "p_status" "text" DEFAULT 'closed'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_round public.preorder_rounds%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_status NOT IN ('closed', 'arrived') THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_status');
  END IF;

  SELECT * INTO v_round FROM preorder_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'round_not_found');
  END IF;
  IF v_round.seller_id <> v_uid AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_seller');
  END IF;

  UPDATE preorder_rounds
    SET status = p_status, closed_at = COALESCE(closed_at, now())
    WHERE id = p_round_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."close_preorder_round"("p_round_id" "uuid", "p_status" "text") OWNER TO "postgres";

--
-- Name: confirm_order_delivered("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."confirm_order_delivered"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order  public.product_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_order.buyer_id <> v_caller THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  IF v_order.status <> 'shipped' THEN
    RETURN jsonb_build_object('error','not_shipped');
  END IF;

  UPDATE public.product_orders SET status = 'delivered', delivered_at = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END $$;


ALTER FUNCTION "public"."confirm_order_delivered"("p_order_id" "uuid") OWNER TO "postgres";

--
-- Name: cost_health_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cost_health_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_month_start TIMESTAMPTZ := DATE_TRUNC('month', NOW());
  v_snapshot JSONB;
BEGIN
  WITH events AS (
    SELECT author_id AS user_id, created_at, 'post'::TEXT AS event_type FROM public.posts
    UNION ALL SELECT user_id, created_at, 'like' FROM public.likes
    UNION ALL SELECT user_id, created_at, 'comment' FROM public.comments
    UNION ALL SELECT user_id, created_at, 'bookmark' FROM public.bookmarks
    UNION ALL SELECT follower_id AS user_id, created_at, 'follow' FROM public.follows
    UNION ALL SELECT user_id, viewed_at AS created_at, 'view' FROM public.post_views_log
  ),
  audience AS (
    SELECT COUNT(DISTINCT user_id) AS mau
    FROM events
    WHERE created_at >= NOW() - INTERVAL '30 days'
  ),
  ai AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= v_month_start) AS generations_month,
      COALESCE(SUM(cost_cents) FILTER (WHERE created_at >= v_month_start), 0) AS cost_cents_month,
      COUNT(*) FILTER (WHERE created_at >= v_month_start AND error IS NOT NULL) AS errors_month,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_month_start) AS creators_month
    FROM public.ai_image_generations
  ),
  uploads AS (
    SELECT
      COUNT(*) FILTER (WHERE media_url IS NOT NULL AND created_at >= v_month_start) AS media_uploads_month,
      COUNT(*) FILTER (WHERE thumbnail_url IS NOT NULL AND created_at >= v_month_start) AS thumbnail_uploads_month,
      COUNT(*) FILTER (WHERE media_type = 'video' AND created_at >= v_month_start) AS video_posts_month,
      COUNT(*) FILTER (WHERE media_type = 'image' AND created_at >= v_month_start) AS image_posts_month,
      COUNT(*) FILTER (WHERE media_url IS NOT NULL OR thumbnail_url IS NOT NULL) AS referenced_media_objects
    FROM public.posts
  ),
  live AS (
    SELECT
      COUNT(*) FILTER (WHERE started_at >= v_month_start) AS sessions_month,
      COALESCE(
        SUM(
          GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) / 60
        ) FILTER (WHERE started_at >= v_month_start),
        0
      ) AS minutes_month,
      COALESCE(MAX(peak_viewers) FILTER (WHERE started_at >= v_month_start), 0) AS peak_viewers_month
    FROM public.live_sessions
  ),
  recordings AS (
    SELECT
      COUNT(*) FILTER (WHERE started_at >= v_month_start) AS recordings_month,
      COALESCE(SUM(duration_secs) FILTER (WHERE started_at >= v_month_start), 0) / 60.0 AS recording_minutes_month
    FROM public.live_recordings
  ),
  edge_db AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= v_month_start) AS r2_queue_rows_month,
      COUNT(*) FILTER (WHERE created_at >= v_month_start AND status = 'error') AS r2_queue_errors_month
    FROM public.r2_delete_queue
  ),
  db_activity AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'view' AND created_at >= v_month_start) AS post_views_month,
      COUNT(*) FILTER (WHERE event_type = 'post' AND created_at >= v_month_start) AS posts_month,
      COUNT(*) FILTER (WHERE event_type = 'comment' AND created_at >= v_month_start) AS comments_month,
      COUNT(*) FILTER (WHERE event_type = 'like' AND created_at >= v_month_start) AS likes_month,
      COUNT(*) FILTER (WHERE event_type = 'bookmark' AND created_at >= v_month_start) AS bookmarks_month,
      COUNT(*) FILTER (WHERE event_type = 'follow' AND created_at >= v_month_start) AS follows_month
    FROM events
  )
  SELECT JSONB_BUILD_OBJECT(
    'generated_at', NOW(),
    'month_start', v_month_start,
    'audience', JSONB_BUILD_OBJECT(
      'mau', COALESCE(audience.mau, 0)
    ),
    'ai', JSONB_BUILD_OBJECT(
      'image_generations_month', COALESCE(ai.generations_month, 0),
      'cost_cents_month', COALESCE(ai.cost_cents_month, 0),
      'errors_month', COALESCE(ai.errors_month, 0),
      'creators_month', COALESCE(ai.creators_month, 0)
    ),
    'media', JSONB_BUILD_OBJECT(
      'media_uploads_month', COALESCE(uploads.media_uploads_month, 0),
      'thumbnail_uploads_month', COALESCE(uploads.thumbnail_uploads_month, 0),
      'image_posts_month', COALESCE(uploads.image_posts_month, 0),
      'video_posts_month', COALESCE(uploads.video_posts_month, 0),
      'referenced_media_objects', COALESCE(uploads.referenced_media_objects, 0)
    ),
    'live', JSONB_BUILD_OBJECT(
      'sessions_month', COALESCE(live.sessions_month, 0),
      'minutes_month', ROUND(COALESCE(live.minutes_month, 0)::NUMERIC, 2),
      'peak_viewers_month', COALESCE(live.peak_viewers_month, 0),
      'recordings_month', COALESCE(recordings.recordings_month, 0),
      'recording_minutes_month', ROUND(COALESCE(recordings.recording_minutes_month, 0)::NUMERIC, 2)
    ),
    'edge_db_proxies', JSONB_BUILD_OBJECT(
      'r2_queue_rows_month', COALESCE(edge_db.r2_queue_rows_month, 0),
      'r2_queue_errors_month', COALESCE(edge_db.r2_queue_errors_month, 0),
      'post_views_month', COALESCE(db_activity.post_views_month, 0),
      'posts_month', COALESCE(db_activity.posts_month, 0),
      'comments_month', COALESCE(db_activity.comments_month, 0),
      'likes_month', COALESCE(db_activity.likes_month, 0),
      'bookmarks_month', COALESCE(db_activity.bookmarks_month, 0),
      'follows_month', COALESCE(db_activity.follows_month, 0)
    ),
    'unit_economics', JSONB_BUILD_OBJECT(
      'tracked_cost_cents_month', COALESCE(ai.cost_cents_month, 0),
      'tracked_cost_cents_per_mau',
        CASE WHEN COALESCE(audience.mau, 0) = 0 THEN NULL
        ELSE ROUND((ai.cost_cents_month::NUMERIC / audience.mau::NUMERIC), 2)
        END,
      'ai_cost_cents_per_generation',
        CASE WHEN COALESCE(ai.generations_month, 0) = 0 THEN NULL
        ELSE ROUND((ai.cost_cents_month::NUMERIC / ai.generations_month::NUMERIC), 2)
        END
    )
  )
  INTO v_snapshot
  FROM audience, ai, uploads, live, recordings, edge_db, db_activity;

  RETURN v_snapshot;
END;
$$;


ALTER FUNCTION "public"."cost_health_snapshot"() OWNER TO "postgres";

--
-- Name: create_duet_invite("uuid", "uuid", "text", integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_duet_invite"("p_session_id" "uuid", "p_invitee_id" "uuid", "p_layout" "text" DEFAULT 'side-by-side'::"text", "p_battle_duration" integer DEFAULT NULL::integer, "p_message" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_host        UUID;
  v_session_status TEXT;
  v_direction   TEXT;
  v_invite_id   UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Session + Host laden
  SELECT host_id, status INTO v_host, v_session_status
    FROM public.live_sessions WHERE id = p_session_id;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_session_status <> 'active' THEN
    RAISE EXCEPTION 'Session ist nicht aktiv' USING ERRCODE = '22023';
  END IF;

  -- Richtung bestimmen
  IF v_caller = v_host THEN
    -- Host lädt Viewer ein
    IF p_invitee_id = v_host THEN
      RAISE EXCEPTION 'Host kann sich nicht selbst einladen' USING ERRCODE = '22023';
    END IF;
    v_direction := 'host-to-viewer';
  ELSIF v_caller = p_invitee_id THEN
    -- Viewer fragt Host um Duett an (invitee_id = Viewer-ID = caller)
    v_direction := 'viewer-to-host';
  ELSE
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;

  -- Block-Check: wenn Host den Viewer geblockt hat, kein Invite möglich
  IF public.is_cohost_blocked(v_host, p_invitee_id) THEN
    RAISE EXCEPTION 'User ist für Duette geblockt' USING ERRCODE = '42501';
  END IF;

  -- Alte pending Invites expiren (damit unique-index nicht knallt)
  UPDATE public.live_duet_invites
     SET status = 'expired', responded_at = NOW()
   WHERE session_id = p_session_id
     AND invitee_id = p_invitee_id
     AND status = 'pending';

  -- Invite anlegen
  INSERT INTO public.live_duet_invites (
    session_id, host_id, invitee_id, direction,
    layout, battle_duration, message
  ) VALUES (
    p_session_id, v_host, p_invitee_id, v_direction,
    COALESCE(p_layout, 'side-by-side'),
    CASE WHEN p_layout = 'battle' THEN COALESCE(p_battle_duration, 60) ELSE NULL END,
    p_message
  )
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;


ALTER FUNCTION "public"."create_duet_invite"("p_session_id" "uuid", "p_invitee_id" "uuid", "p_layout" "text", "p_battle_duration" integer, "p_message" "text") OWNER TO "postgres";

--
-- Name: create_live_auction("uuid", "text", integer, integer, integer, "text", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_live_auction"("p_session_id" "uuid", "p_title" "text", "p_start_price_cents" integer DEFAULT 100, "p_min_increment_cents" integer DEFAULT 100, "p_buy_now_cents" integer DEFAULT NULL::integer, "p_image_url" "text" DEFAULT NULL::"text", "p_product_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_host   uuid;
  v_next   int;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT host_id INTO v_host FROM public.live_sessions WHERE id = p_session_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;

  -- Anlegen darf nur der Host. Moderatoren dürfen starten (siehe unten),
  -- aber nicht bestimmen, was verkauft wird — das ist die Ware des Hosts.
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_start_price_cents <= 0 OR p_min_increment_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_price' USING ERRCODE = '22023';
  END IF;
  IF p_buy_now_cents IS NOT NULL AND p_buy_now_cents <= p_start_price_cents THEN
    RAISE EXCEPTION 'buy_now_below_start' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(MAX(sort_index), 0) + 1 INTO v_next
    FROM public.live_auctions WHERE session_id = p_session_id;

  INSERT INTO public.live_auctions (
    session_id, seller_id, product_id, title, image_url,
    start_price_cents, min_increment_cents, buy_now_cents, sort_index
  ) VALUES (
    p_session_id, v_uid, p_product_id, btrim(p_title), p_image_url,
    p_start_price_cents, p_min_increment_cents, p_buy_now_cents, v_next
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;


ALTER FUNCTION "public"."create_live_auction"("p_session_id" "uuid", "p_title" "text", "p_start_price_cents" integer, "p_min_increment_cents" integer, "p_buy_now_cents" integer, "p_image_url" "text", "p_product_id" "uuid") OWNER TO "postgres";

--
-- Name: create_live_giveaway("uuid", "text", "text", boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_live_giveaway"("p_session_id" "uuid", "p_title" "text", "p_image_url" "text" DEFAULT NULL::"text", "p_requires_follow" boolean DEFAULT true) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_host uuid;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT host_id INTO v_host FROM public.live_sessions WHERE id = p_session_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.live_giveaways
     WHERE session_id = p_session_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'giveaway_already_open' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_giveaways (session_id, host_id, title, image_url, requires_follow)
  VALUES (p_session_id, v_uid, btrim(p_title), p_image_url, p_requires_follow)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;


ALTER FUNCTION "public"."create_live_giveaway"("p_session_id" "uuid", "p_title" "text", "p_image_url" "text", "p_requires_follow" boolean) OWNER TO "postgres";

--
-- Name: create_post("text", "text", "text", "text", "text"[], "uuid", boolean, "text", double precision, "text", boolean, boolean, boolean, boolean, integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_post"("p_caption" "text" DEFAULT NULL::"text", "p_media_url" "text" DEFAULT NULL::"text", "p_media_type" "text" DEFAULT 'image'::"text", "p_thumbnail_url" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_guild_id" "uuid" DEFAULT NULL::"uuid", "p_is_guild_post" boolean DEFAULT false, "p_audio_url" "text" DEFAULT NULL::"text", "p_audio_volume" double precision DEFAULT NULL::double precision, "p_privacy" "text" DEFAULT 'public'::"text", "p_allow_comments" boolean DEFAULT true, "p_allow_download" boolean DEFAULT false, "p_allow_duet" boolean DEFAULT true, "p_women_only" boolean DEFAULT false, "p_cover_time_ms" integer DEFAULT NULL::integer, "p_aspect_ratio" "text" DEFAULT 'portrait'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_post_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.posts (
    author_id,
    caption,
    media_url,
    media_type,
    thumbnail_url,
    tags,
    guild_id,
    is_guild_post,
    audio_url,
    audio_volume,
    privacy,
    allow_comments,
    allow_download,
    allow_duet,
    women_only,
    cover_time_ms,
    aspect_ratio
  )
  VALUES (
    v_user_id,
    NULLIF(BTRIM(p_caption), ''),
    p_media_url,
    COALESCE(p_media_type, 'image'),
    p_thumbnail_url,
    COALESCE(p_tags, '{}'::TEXT[]),
    p_guild_id,
    COALESCE(p_is_guild_post, FALSE),
    p_audio_url,
    p_audio_volume,
    COALESCE(p_privacy, 'public'),
    COALESCE(p_allow_comments, TRUE),
    COALESCE(p_allow_download, FALSE),
    COALESCE(p_allow_duet, TRUE),
    COALESCE(p_women_only, FALSE),
    p_cover_time_ms,
    COALESCE(p_aspect_ratio, 'portrait')
  )
  RETURNING id INTO v_post_id;

  RETURN v_post_id;
END;
$$;


ALTER FUNCTION "public"."create_post"("p_caption" "text", "p_media_url" "text", "p_media_type" "text", "p_thumbnail_url" "text", "p_tags" "text"[], "p_guild_id" "uuid", "p_is_guild_post" boolean, "p_audio_url" "text", "p_audio_volume" double precision, "p_privacy" "text", "p_allow_comments" boolean, "p_allow_download" boolean, "p_allow_duet" boolean, "p_women_only" boolean, "p_cover_time_ms" integer, "p_aspect_ratio" "text") OWNER TO "postgres";

--
-- Name: create_preorder_round("uuid", integer, timestamp with time zone, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_preorder_round"("p_product_id" "uuid", "p_target_qty" integer, "p_closes_at" timestamp with time zone, "p_title" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_title   text;
  v_round   public.preorder_rounds%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;
  IF v_product.seller_id <> v_uid AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_seller');
  END IF;
  IF v_product.sale_mode IS DISTINCT FROM 'preorder' OR NOT v_product.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_preorder_product');
  END IF;
  IF p_target_qty IS NULL OR p_target_qty < 1 OR p_target_qty > 9999 THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_target');
  END IF;
  IF p_closes_at IS NULL OR p_closes_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_deadline');
  END IF;

  v_title := COALESCE(NULLIF(trim(p_title), ''), left('Sammelbestellung: ' || v_product.title, 80));

  -- Vorgänger-Runde still schließen (Unique-Index erlaubt nur eine offene).
  UPDATE preorder_rounds
    SET status = 'closed', closed_at = now()
    WHERE product_id = p_product_id AND status = 'open';

  INSERT INTO preorder_rounds (product_id, seller_id, title, target_qty, closes_at)
    VALUES (p_product_id, v_product.seller_id, v_title, p_target_qty, p_closes_at)
    RETURNING * INTO v_round;

  -- Bestehendes aktives Interesse adoptieren: Wer schon vorgemerkt hat,
  -- wartet auf genau diese Bestell-Runde → zählt ab Sekunde 1 im Fortschritt.
  UPDATE product_preorders
    SET round_id = v_round.id
    WHERE product_id = p_product_id AND status IN ('interested', 'notified');

  RETURN jsonb_build_object('success', true, 'round_id', v_round.id);
END;
$$;


ALTER FUNCTION "public"."create_preorder_round"("p_product_id" "uuid", "p_target_qty" integer, "p_closes_at" timestamp with time zone, "p_title" "text") OWNER TO "postgres";

--
-- Name: create_report("text", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_report"("p_target_type" "text", "p_target_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_reporter UUID := auth.uid();
  v_existing UUID;
BEGIN
  IF v_reporter IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF p_target_type NOT IN ('post', 'profile', 'comment', 'live', 'product') THEN
    RETURN jsonb_build_object('error', 'invalid_target_type');
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 OR length(p_reason) > 120 THEN
    RETURN jsonb_build_object('error', 'invalid_reason');
  END IF;

  SELECT id
    INTO v_existing
    FROM public.content_reports
   WHERE reporter_id = v_reporter
     AND target_type = p_target_type
     AND target_id = p_target_id
     AND reason = p_reason
     AND status IN ('pending', 'reviewed', 'actioned')
     AND created_at >= NOW() - INTERVAL '30 days'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'report_id', v_existing);
  END IF;

  INSERT INTO public.content_reports (reporter_id, target_type, target_id, reason)
  VALUES (v_reporter, p_target_type, p_target_id, trim(p_reason))
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'report_id', v_existing);
END;
$$;


ALTER FUNCTION "public"."create_report"("p_target_type" "text", "p_target_id" "uuid", "p_reason" "text") OWNER TO "postgres";

--
-- Name: create_support_thread("text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_support_thread"("p_subject" "text", "p_body" "text", "p_source" "text" DEFAULT 'manual'::"text", "p_priority" "text" DEFAULT 'medium'::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_thread_id UUID;
  v_source TEXT := COALESCE(NULLIF(trim(p_source), ''), 'manual');
  v_priority TEXT := COALESCE(NULLIF(trim(p_priority), ''), 'medium');
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF v_source NOT IN ('dm', 'report', 'payment', 'system', 'manual', 'activation') THEN
    RETURN jsonb_build_object('error', 'invalid_source');
  END IF;

  IF v_priority NOT IN ('low', 'medium', 'high') THEN
    RETURN jsonb_build_object('error', 'invalid_priority');
  END IF;

  IF p_subject IS NULL OR length(trim(p_subject)) = 0 OR length(p_subject) > 160 THEN
    RETURN jsonb_build_object('error', 'invalid_subject');
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 OR length(p_body) > 4000 THEN
    RETURN jsonb_build_object('error', 'invalid_body');
  END IF;

  INSERT INTO public.admin_support_threads (
    source,
    user_id,
    subject,
    priority,
    metadata
  )
  VALUES (
    v_source,
    v_actor,
    trim(p_subject),
    v_priority,
    COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING id INTO v_thread_id;

  INSERT INTO public.admin_support_messages (
    thread_id,
    sender_type,
    sender_id,
    body
  )
  VALUES (
    v_thread_id,
    'user',
    v_actor,
    trim(p_body)
  );

  -- Admins benachrichtigen (defensiv — Thread-Erstellung darf nie an einer
  -- fehlenden Notification scheitern). Push feuert automatisch via
  -- trg_push_notification. Nicht sich selbst pingen, falls ein Admin testet.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    SELECT p.id, v_actor, 'support_new', left(trim(p_subject), 140)
      FROM public.profiles p
     WHERE p.is_admin = true
       AND p.id <> v_actor;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'thread_id', v_thread_id);
END;
$$;


ALTER FUNCTION "public"."create_support_thread"("p_subject" "text", "p_body" "text", "p_source" "text", "p_priority" "text", "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: create_user_wallet(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_user_wallet"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.coins_wallets (user_id, coins, diamonds, total_gifted)
  VALUES (new.id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_user_wallet skipped: % (state: %)', SQLERRM, SQLSTATE;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."create_user_wallet"() OWNER TO "postgres";

--
-- Name: creator_activation_recovery_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."creator_activation_recovery_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin() OR public.can_operate() OR public.can_creator_ops()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH posts_30d AS (
    SELECT id, author_id, created_at
    FROM public.posts
    WHERE created_at >= NOW() - INTERVAL '30 days'
      AND COALESCE(privacy, 'public') <> 'private'
  ),
  posts_7d AS (
    SELECT id, author_id, created_at
    FROM public.posts
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND COALESCE(privacy, 'public') <> 'private'
  ),
  engagement_30d AS (
    SELECT
      p.id AS post_id,
      p.author_id,
      (
        SELECT COUNT(*)
        FROM public.likes l
        WHERE l.post_id = p.id
          AND l.created_at >= p.created_at
      ) AS likes,
      (
        SELECT COUNT(*)
        FROM public.comments c
        WHERE c.post_id = p.id
          AND c.created_at >= p.created_at
      ) AS comments,
      (
        SELECT COUNT(*)
        FROM public.bookmarks b
        WHERE b.post_id = p.id
          AND b.created_at >= p.created_at
      ) AS bookmarks,
      (
        SELECT COUNT(*)
        FROM public.post_views_log v
        WHERE v.post_id = p.id
          AND v.viewed_at >= p.created_at
      ) AS views,
      (
        SELECT COUNT(*)
        FROM public.follows f
        WHERE f.following_id = p.author_id
          AND f.created_at >= p.created_at
      ) AS follows
    FROM posts_30d p
  ),
  creator_rollup AS (
    SELECT
      p.author_id,
      COUNT(*) AS posts_30d,
      MAX(p.created_at) AS latest_post_at,
      COALESCE(SUM(e.likes), 0) AS likes,
      COALESCE(SUM(e.comments), 0) AS comments,
      COALESCE(SUM(e.bookmarks), 0) AS bookmarks,
      COALESCE(SUM(e.views), 0) AS views,
      COALESCE(SUM(e.follows), 0) AS follows
    FROM posts_30d p
    LEFT JOIN engagement_30d e ON e.post_id = p.id
    GROUP BY p.author_id
  ),
  summary AS (
    SELECT jsonb_build_object(
      'new_users_30d', (
        SELECT COUNT(*)
        FROM public.profiles
        WHERE created_at >= NOW() - INTERVAL '30 days'
      ),
      'users_without_first_post_30d', (
        SELECT COUNT(*)
        FROM public.profiles pr
        WHERE pr.created_at >= NOW() - INTERVAL '30 days'
          AND NOT EXISTS (
            SELECT 1 FROM public.posts po WHERE po.author_id = pr.id
          )
      ),
      'posts_7d', (SELECT COUNT(*) FROM posts_7d),
      'posts_30d', (SELECT COUNT(*) FROM posts_30d),
      'active_creators_7d', (SELECT COUNT(DISTINCT author_id) FROM posts_7d),
      'creators_with_posts_30d', (SELECT COUNT(*) FROM creator_rollup),
      'creators_with_zero_engagement_30d', (
        SELECT COUNT(*)
        FROM creator_rollup
        WHERE likes + comments + bookmarks + follows = 0
      ),
      'posts_with_meaningful_engagement_30d', (
        SELECT COUNT(*)
        FROM engagement_30d
        WHERE likes + comments + bookmarks + follows > 0
      ),
      'views_30d', (SELECT COALESCE(SUM(views), 0) FROM engagement_30d),
      'meaningful_engagement_30d', (
        SELECT COALESCE(SUM(likes + comments + bookmarks + follows), 0)
        FROM engagement_30d
      )
    ) AS data
  ),
  need_first_post AS (
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) AS data
    FROM (
      SELECT jsonb_build_object(
        'profile_id', pr.id,
        'user_id', LEFT(pr.id::TEXT, 8),
        'username', pr.username,
        'display_name', pr.display_name,
        'created_at', pr.created_at,
        'days_since_signup', FLOOR(EXTRACT(EPOCH FROM (NOW() - pr.created_at)) / 86400)
      ) AS row_data
      FROM public.profiles pr
      WHERE pr.created_at >= NOW() - INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM public.posts po WHERE po.author_id = pr.id
        )
      ORDER BY pr.created_at DESC
      LIMIT 12
    ) rows
  ),
  need_engagement AS (
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) AS data
    FROM (
      SELECT jsonb_build_object(
        'profile_id', cr.author_id,
        'user_id', LEFT(cr.author_id::TEXT, 8),
        'username', pr.username,
        'display_name', pr.display_name,
        'posts_30d', cr.posts_30d,
        'latest_post_at', cr.latest_post_at,
        'views', cr.views,
        'likes', cr.likes,
        'comments', cr.comments,
        'bookmarks', cr.bookmarks,
        'follows', cr.follows
      ) AS row_data
      FROM creator_rollup cr
      JOIN public.profiles pr ON pr.id = cr.author_id
      WHERE cr.likes + cr.comments + cr.bookmarks + cr.follows = 0
      ORDER BY cr.latest_post_at DESC
      LIMIT 12
    ) rows
  )
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'summary', summary.data,
    'need_first_post', need_first_post.data,
    'need_engagement', need_engagement.data,
    'next_actions', jsonb_build_array(
      'Guide new users without first post to create one public post',
      'Review creators with posts but no meaningful engagement',
      'Seed engagement loops through comments, follows, saves, or creator prompts',
      'Pause non-activation features while weekly active creators stays at 0'
    )
  )
  INTO v_snapshot
  FROM summary, need_first_post, need_engagement;

  RETURN v_snapshot;
END;
$$;


ALTER FUNCTION "public"."creator_activation_recovery_snapshot"() OWNER TO "postgres";

--
-- Name: credit_coins("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."credit_coins"("p_user_id" "uuid", "p_coins" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
begin
  -- Wallet erstellen falls nicht vorhanden, dann Coins addieren
  insert into coins_wallets (user_id, coins, updated_at)
  values (p_user_id, p_coins, now())
  on conflict (user_id) do update
    set coins      = coins_wallets.coins + excluded.coins,
        updated_at = now();
end;
$$;


ALTER FUNCTION "public"."credit_coins"("p_user_id" "uuid", "p_coins" integer) OWNER TO "postgres";

--
-- Name: current_user_admin_roles(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."current_user_admin_roles"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'is_admin', COALESCE(p.is_admin, FALSE),
    'is_moderator', COALESCE(p.is_moderator, FALSE),
    'is_operator', COALESCE(p.is_operator, FALSE),
    'is_creator_ops', COALESCE(p.is_creator_ops, FALSE)
  )
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_admin_roles"() OWNER TO "postgres";

--
-- Name: decay_dwell_scores(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."decay_dwell_scores"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.posts
  SET dwell_time_score = ROUND((dwell_time_score * 0.90)::NUMERIC, 4)
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND dwell_time_score > 0.05;

  RAISE NOTICE 'Score decay applied at %', NOW();
END;
$$;


ALTER FUNCTION "public"."decay_dwell_scores"() OWNER TO "postgres";

--
-- Name: delete_ai_image_generations("uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."delete_ai_image_generations"("p_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_deleted INT;
BEGIN
  WITH d AS (
    DELETE FROM public.ai_image_generations
     WHERE id = ANY(p_ids)
       AND consumed_at IS NULL  -- Paranoid-Check: consumed Rows bleiben intakt
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM d;
  RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."delete_ai_image_generations"("p_ids" "uuid"[]) OWNER TO "postgres";

--
-- Name: delete_own_account(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."delete_own_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."delete_own_account"() OWNER TO "postgres";

--
-- Name: delete_post("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."delete_post"("p_post_id" "uuid") RETURNS TABLE("author_id" "uuid", "media_url" "text", "thumbnail_url" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  DELETE FROM public.posts p
   WHERE p.id = p_post_id
     AND p.author_id = auth.uid()
  RETURNING p.author_id, p.media_url, p.thumbnail_url;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or not owned by user';
  END IF;
END;
$$;


ALTER FUNCTION "public"."delete_post"("p_post_id" "uuid") OWNER TO "postgres";

--
-- Name: delete_post_draft("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."delete_post_draft"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.post_drafts WHERE id = p_id AND author_id = v_caller;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
END;
$$;


ALTER FUNCTION "public"."delete_post_draft"("p_id" "uuid") OWNER TO "postgres";

--
-- Name: draw_live_giveaway("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."draw_live_giveaway"("p_giveaway_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  g        public.live_giveaways;
  v_uid    uuid := auth.uid();
  v_winner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO g FROM public.live_giveaways WHERE id = p_giveaway_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'giveaway_not_found' USING ERRCODE = '22023';
  END IF;
  IF g.host_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF g.status <> 'open' THEN
    RAISE EXCEPTION 'giveaway_closed' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_winner
    FROM public.live_giveaway_entries
   WHERE giveaway_id = p_giveaway_id
   ORDER BY random()
   LIMIT 1;

  UPDATE public.live_giveaways
     SET status    = 'drawn',
         winner_id = v_winner,
         drawn_at  = now()
   WHERE id = p_giveaway_id;

  RETURN jsonb_build_object(
    'giveaway_id', p_giveaway_id,
    'winner_id',   v_winner,
    'entry_count', g.entry_count
  );
END $$;


ALTER FUNCTION "public"."draw_live_giveaway"("p_giveaway_id" "uuid") OWNER TO "postgres";

--
-- Name: end_live_session("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."end_live_session"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  UPDATE public.live_sessions
  SET status = 'ended', ended_at = NOW(), viewer_count = 0
  WHERE id = p_session_id AND host_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."end_live_session"("p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: enforce_comment_not_blocked(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_comment_not_blocked"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND public.users_blocked(NEW.user_id, v_author) THEN
    RAISE EXCEPTION 'blocked' USING HINT = 'blocked';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_comment_not_blocked"() OWNER TO "postgres";

--
-- Name: enforce_conversation_not_blocked(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_conversation_not_blocked"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF public.users_blocked(NEW.participant_1, NEW.participant_2) THEN
    RAISE EXCEPTION 'blocked' USING HINT = 'blocked';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_conversation_not_blocked"() OWNER TO "postgres";

--
-- Name: enforce_follow_not_blocked(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_follow_not_blocked"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF public.users_blocked(NEW.follower_id, NEW.following_id) THEN
    RAISE EXCEPTION 'blocked' USING HINT = 'blocked';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_follow_not_blocked"() OWNER TO "postgres";

--
-- Name: enforce_message_not_blocked(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_message_not_blocked"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  p1 uuid;
  p2 uuid;
BEGIN
  SELECT participant_1, participant_2 INTO p1, p2
    FROM conversations WHERE id = NEW.conversation_id;
  IF p1 IS NOT NULL AND public.users_blocked(p1, p2) THEN
    RAISE EXCEPTION 'blocked' USING HINT = 'blocked';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_message_not_blocked"() OWNER TO "postgres";

--
-- Name: enforce_sale_mode_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_sale_mode_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.sale_mode IS DISTINCT FROM 'coins' THEN
    IF NOT (COALESCE(public.is_admin(), false) OR auth.role() = 'service_role') THEN
      NEW.sale_mode := 'coins';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_sale_mode_admin"() OWNER TO "postgres";

--
-- Name: enforce_single_owner_push_token(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_single_owner_push_token"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.push_token IS NOT NULL
     AND NEW.push_token IS DISTINCT FROM OLD.push_token THEN
    UPDATE public.profiles
       SET push_token = NULL
     WHERE push_token = NEW.push_token
       AND id <> NEW.id;
    DELETE FROM public.push_tokens
     WHERE token = NEW.push_token
       AND user_id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_single_owner_push_token"() OWNER TO "postgres";

--
-- Name: enforce_single_owner_push_tokens_row(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_single_owner_push_tokens_row"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.push_tokens
   WHERE token = NEW.token
     AND user_id <> NEW.user_id;
  UPDATE public.profiles
     SET push_token = NULL
   WHERE push_token = NEW.token
     AND id <> NEW.user_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_single_owner_push_tokens_row"() OWNER TO "postgres";

--
-- Name: enqueue_automated_post_moderation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enqueue_automated_post_moderation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_result JSONB;
  v_reason TEXT;
  v_confidence NUMERIC;
BEGIN
  v_result := public.classify_post_moderation(NEW.caption, NEW.tags, NEW.media_type, NEW.media_url);

  IF COALESCE((v_result->>'flagged')::BOOLEAN, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_confidence := COALESCE((v_result->>'confidence')::NUMERIC, 0);

  FOR v_reason IN
    SELECT jsonb_array_elements_text(v_result->'reasons')
  LOOP
    INSERT INTO public.moderation_auto_flags (
      target_type,
      target_id,
      reason,
      confidence,
      signals
    )
    SELECT
      'post',
      NEW.id,
      v_reason,
      v_confidence,
      v_result
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.moderation_auto_flags existing
      WHERE existing.target_type = 'post'
        AND existing.target_id = NEW.id
        AND existing.reason = v_reason
        AND existing.created_at >= NOW() - INTERVAL '30 days'
    );

    INSERT INTO public.content_reports (
      reporter_id,
      target_type,
      target_id,
      reason,
      admin_note
    )
    SELECT
      NULL,
      'post',
      NEW.id,
      v_reason,
      'Automated moderation signal: ' || (v_result->>'classifier') || ', confidence=' || v_confidence::TEXT
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.content_reports existing
      WHERE existing.reporter_id IS NULL
        AND existing.target_type = 'post'
        AND existing.target_id = NEW.id
        AND existing.reason = v_reason
        AND existing.status IN ('pending', 'reviewed', 'actioned')
        AND existing.created_at >= NOW() - INTERVAL '30 days'
    );
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enqueue_automated_post_moderation"() OWNER TO "postgres";

--
-- Name: enqueue_r2_media_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enqueue_r2_media_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.media_url IS NOT NULL OR OLD.thumbnail_url IS NOT NULL THEN
    INSERT INTO public.r2_delete_queue (
      post_id,
      author_id,
      media_url,
      thumbnail_url
    )
    VALUES (
      OLD.id,
      OLD.author_id,
      OLD.media_url,
      OLD.thumbnail_url
    );
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."enqueue_r2_media_delete"() OWNER TO "postgres";

--
-- Name: ensure_auction_cart("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ensure_auction_cart"("p_buyer_id" "uuid", "p_seller_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cart_id uuid;
BEGIN
  -- Abgelaufene Körbe erst schließen, sonst kollidiert der Unique-Index.
  UPDATE public.auction_carts
     SET status = 'expired'
   WHERE buyer_id = p_buyer_id
     AND seller_id = p_seller_id
     AND status = 'open'
     AND closes_at <= now();

  SELECT id INTO v_cart_id
    FROM public.auction_carts
   WHERE buyer_id = p_buyer_id
     AND seller_id = p_seller_id
     AND status = 'open'
   LIMIT 1;

  IF v_cart_id IS NOT NULL THEN
    RETURN v_cart_id;
  END IF;

  INSERT INTO public.auction_carts (buyer_id, seller_id)
  VALUES (p_buyer_id, p_seller_id)
  RETURNING id INTO v_cart_id;

  RETURN v_cart_id;
END $$;


ALTER FUNCTION "public"."ensure_auction_cart"("p_buyer_id" "uuid", "p_seller_id" "uuid") OWNER TO "postgres";

--
-- Name: enter_live_giveaway("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enter_live_giveaway"("p_giveaway_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  g     public.live_giveaways;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO g FROM public.live_giveaways WHERE id = p_giveaway_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'giveaway_not_found' USING ERRCODE = '22023';
  END IF;
  IF g.status <> 'open' THEN
    RAISE EXCEPTION 'giveaway_closed' USING ERRCODE = '22023';
  END IF;
  IF g.host_id = v_uid THEN
    RAISE EXCEPTION 'host_cannot_enter' USING ERRCODE = '42501';
  END IF;

  IF g.requires_follow AND NOT EXISTS (
    SELECT 1 FROM public.follows
     WHERE follower_id = v_uid AND following_id = g.host_id
  ) THEN
    RAISE EXCEPTION 'follow_required' USING ERRCODE = '42501';
  END IF;

  -- Doppelte Teilnahme ist keine Fehlbedienung, sondern ein zweiter Tipp.
  INSERT INTO public.live_giveaway_entries (giveaway_id, user_id)
  VALUES (p_giveaway_id, v_uid)
  ON CONFLICT DO NOTHING;

  SELECT * INTO g FROM public.live_giveaways WHERE id = p_giveaway_id;

  RETURN jsonb_build_object('giveaway_id', g.id, 'entry_count', g.entry_count, 'entered', true);
END $$;


ALTER FUNCTION "public"."enter_live_giveaway"("p_giveaway_id" "uuid") OWNER TO "postgres";

--
-- Name: expire_duet_invites(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."expire_duet_invites"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_count INT;
BEGIN
  UPDATE public.live_duet_invites
     SET status = 'expired', responded_at = NOW()
   WHERE status = 'pending' AND expires_at <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."expire_duet_invites"() OWNER TO "postgres";

--
-- Name: expire_stale_scheduled_lives(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."expire_stale_scheduled_lives"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE public.scheduled_lives
       SET status = 'expired'
     WHERE status IN ('scheduled','reminded')
       AND scheduled_at < NOW() - INTERVAL '2 hours'
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_count FROM expired;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."expire_stale_scheduled_lives"() OWNER TO "postgres";

--
-- Name: express_product_interest("uuid", integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."express_product_interest"("p_product_id" "uuid", "p_quantity" integer DEFAULT 1, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_seller uuid;
  v_title  text;
  v_active boolean;
  v_mode   text;
  v_qty    int := GREATEST(1, LEAST(COALESCE(p_quantity, 1), 999));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT seller_id, title, is_active, sale_mode
    INTO v_seller, v_title, v_active, v_mode
  FROM public.products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;
  IF NOT v_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_inactive');
  END IF;
  IF v_mode <> 'preorder' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_preorder');
  END IF;
  IF v_seller = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_preorder_own');
  END IF;

  INSERT INTO public.product_preorders (product_id, user_id, quantity, note, status)
  VALUES (p_product_id, v_uid, v_qty, NULLIF(p_note, ''), 'interested')
  ON CONFLICT (product_id, user_id) DO UPDATE
    SET quantity   = EXCLUDED.quantity,
        note       = EXCLUDED.note,
        status     = 'interested',
        updated_at = now();

  -- Verkäufer benachrichtigen (best-effort — Notification darf den Insert nie kippen).
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, product_name)
    VALUES (v_seller, v_uid, 'preorder_interest', v_title);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."express_product_interest"("p_product_id" "uuid", "p_quantity" integer, "p_note" "text") OWNER TO "postgres";

--
-- Name: finalize_battle("uuid", "uuid", integer, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."finalize_battle"("p_session_id" "uuid", "p_guest_id" "uuid", "p_host_score" integer, "p_guest_score" integer, "p_duration_secs" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_host        uuid := auth.uid();
  v_winner      text;
  v_id          uuid;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Guards
  IF p_host_score < 0 OR p_guest_score < 0 OR p_duration_secs < 0 THEN
    RAISE EXCEPTION 'Scores und Dauer müssen >= 0 sein' USING ERRCODE = '22023';
  END IF;

  IF v_host = p_guest_id THEN
    RAISE EXCEPTION 'Host und Guest können nicht identisch sein' USING ERRCODE = '22023';
  END IF;

  -- Nur der Host der Session darf finalisieren
  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
     WHERE id = p_session_id
       AND host_id = v_host
  ) THEN
    RAISE EXCEPTION 'Nicht Host dieser Session' USING ERRCODE = '42501';
  END IF;

  -- Winner berechnen (Ties = draw)
  v_winner := CASE
    WHEN p_host_score > p_guest_score THEN 'host'
    WHEN p_guest_score > p_host_score THEN 'guest'
    ELSE 'draw'
  END;

  -- Idempotent: wenn das Battle für diese Session+Paarung schon existiert,
  -- einfach zurückgeben (verhindert Duplikate bei Retry/Netzwerk-Wackler).
  SELECT id INTO v_id
    FROM public.live_battle_history
   WHERE session_id = p_session_id
     AND host_id    = v_host
     AND guest_id   = p_guest_id
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.live_battle_history (
    session_id, host_id, guest_id,
    host_score, guest_score, winner, duration_secs
  )
  VALUES (
    p_session_id, v_host, p_guest_id,
    p_host_score, p_guest_score, v_winner, p_duration_secs
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."finalize_battle"("p_session_id" "uuid", "p_guest_id" "uuid", "p_host_score" integer, "p_guest_score" integer, "p_duration_secs" integer) OWNER TO "postgres";

--
-- Name: fn_notify_seller_on_save(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."fn_notify_seller_on_save"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_seller uuid;
  v_title  text;
BEGIN
  SELECT seller_id, title INTO v_seller, v_title
    FROM public.products WHERE id = NEW.product_id;

  -- Kein Seller (gelöscht) oder eigenes Produkt → kein Ping.
  IF v_seller IS NULL OR v_seller = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, product_name, product_id)
  VALUES
    (v_seller, NEW.user_id, 'product_saved', v_title, NEW.product_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ein Merken darf NIE an der Benachrichtigung scheitern.
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."fn_notify_seller_on_save"() OWNER TO "postgres";

--
-- Name: fn_send_push_on_notification(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."fn_send_push_on_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor TEXT;
  v_title TEXT;
  v_body  TEXT;
  v_data  jsonb;
BEGIN
  -- Self-Notification nie pushen.
  IF NEW.recipient_id = NEW.sender_id THEN RETURN NEW; END IF;

  -- Typen mit eigenem Direkt-Push (notify_on_like/comment/follow/dm) hier
  -- überspringen → sonst Doppel-Push.
  IF NEW.type IN ('like', 'comment', 'follow', 'follow_request', 'dm') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(username, 'Jemand') INTO v_actor
    FROM public.profiles WHERE id = NEW.sender_id;

  CASE NEW.type
    WHEN 'live' THEN
      v_title := '🔴 Live auf Serlo';
      v_body  := v_actor || ' ist jetzt LIVE!' || COALESCE(' — ' || NEW.comment_text, '');
    WHEN 'live_invite' THEN
      v_title := '🎥 Live-Einladung';
      v_body  := v_actor || ' hat dich in sein Live eingeladen!';
    WHEN 'scheduled_live_reminder' THEN
      v_title := '🔔 Gleich live';
      v_body  := COALESCE(v_actor || ' startet in 15 Min: „' || NEW.comment_text || '"',
                          v_actor || ' geht in 15 Minuten live!');
    WHEN 'gift' THEN
      v_title := COALESCE(NEW.gift_emoji, '🎁') || ' Geschenk erhalten';
      v_body  := v_actor || ' hat dir ' || COALESCE(NEW.gift_emoji, '🎁') || ' '
                 || COALESCE(NEW.gift_name, 'ein Geschenk') || ' geschickt!';
    WHEN 'new_order' THEN
      v_title := '🛍️ Neuer Verkauf!';
      v_body  := COALESCE(v_actor || ' hat „' || NEW.product_name || '" gekauft',
                          v_actor || ' hat ein Produkt gekauft');
    WHEN 'preorder_interest' THEN
      v_title := '🌸 Neue Vorbestellung';
      v_body  := COALESCE(v_actor || ' hat „' || NEW.product_name || '" vorbestellt',
                          v_actor || ' hat ein Produkt vorbestellt');
    WHEN 'product_saved' THEN
      v_title := '🔖 Produkt gemerkt';
      v_body  := COALESCE(v_actor || ' hat „' || NEW.product_name || '" gemerkt',
                          v_actor || ' hat dein Produkt gemerkt');
    WHEN 'preorder_round_open' THEN
      v_title := '🌸 Sammelbestellung läuft';
      v_body  := COALESCE(NEW.comment_text,
                          '„' || NEW.product_name || '" wird gerade gesammelt — jetzt sichern!',
                          'Eine Sammelbestellung ist offen — jetzt sichern!');
    -- Berkat-Zuschlag. Ohne eigenen Zweig fällt er in den ELSE unten und
    -- käme als 'Neue Aktivität auf Serlo' an — falsche Marke, kein Anlass.
    WHEN 'auction_won' THEN
      v_title := '🎉 Zuschlag — du hast gewonnen!';
      v_body  := COALESCE(NEW.comment_text, 'Dein Artikel liegt im Sammelkorb');
    WHEN 'order_payment_requested' THEN
      v_title := '💶 Zeit zu bezahlen';
      v_body  := COALESCE(NEW.comment_text, 'Deine Vorbestellung ist da — jetzt bezahlen 🌸');
    WHEN 'order_payment_reminder' THEN
      -- Zwei Marken, ein Typ. Serlo erinnert an eine Vorbestellung, Berkat an
      -- einen Sammelkorb, dessen Fenster zuläuft. „Dein Parfüm wartet" wäre in
      -- einer Auktions-App schlicht falsch.
      IF COALESCE(NEW.app, 'serlo') = 'berkat' THEN
        v_title := '⏳ Dein Sammelkorb wartet';
        v_body  := COALESCE(NEW.comment_text, 'Kurz bezahlen — sonst schließt das Fenster');
      ELSE
        v_title := '🌸 Dein Parfüm wartet';
        v_body  := COALESCE(NEW.comment_text, 'Kurz bezahlen — dann geht deine Vorbestellung raus 🌸');
      END IF;
    WHEN 'order_paid' THEN
      v_title := '💶 Bestellung bezahlt';
      v_body  := v_actor || ' hat bezahlt — bitte versenden 📦';
    WHEN 'order_shipped' THEN
      v_title := '📦 Unterwegs';
      v_body  := COALESCE(NEW.comment_text, 'Dein Parfüm ist unterwegs 📦');
    WHEN 'order_cancelled' THEN
      v_title := '🚫 Bestellung storniert';
      v_body  := v_actor || ' hat eine Bestellung storniert';
    WHEN 'order_address_updated' THEN
      v_title := '📍 Adresse geändert';
      v_body  := v_actor || ' hat die Lieferadresse aktualisiert';
    WHEN 'order_review' THEN
      v_title := '⭐ Neue Bewertung';
      v_body  := COALESCE(NEW.comment_text, v_actor || ' hat dich bewertet');
    WHEN 'order_dispute' THEN
      v_title := '⚠️ Problem gemeldet';
      v_body  := COALESCE(NEW.comment_text, 'Ein Problem mit einer Bestellung wurde gemeldet');
    ELSE
      v_title := 'Neue Aktivität auf Serlo';
      v_body  := COALESCE(NEW.comment_text, '');
  END CASE;

  v_data := jsonb_build_object(
    'type',      NEW.type,
    'postId',    NEW.post_id,
    'sessionId', NEW.session_id,
    'senderId',  NEW.sender_id,
    'productId', NEW.product_id
  );

  PERFORM public.send_push_to_user(
    p_user_id := NEW.recipient_id,
    p_title   := v_title,
    p_body    := v_body,
    p_data    := v_data,
    -- Ziel-App: entscheidet, welche Geräte angesprochen werden.
    p_app     := COALESCE(NEW.app, 'serlo')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Push darf den auslösenden INSERT niemals scheitern lassen.
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_send_push_on_notification"() OWNER TO "postgres";

--
-- Name: generate_download_url("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."generate_download_url"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_order      public.orders%ROWTYPE;
  v_product    public.products%ROWTYPE;
  v_file_path  TEXT;
BEGIN
  -- Bestellung laden + Zugriffsprüfung (nur Käufer oder Seller)
  SELECT * INTO v_order
    FROM public.orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'order_not_found');
  END IF;

  IF v_order.buyer_id != v_caller_id AND v_order.seller_id != v_caller_id THEN
    RETURN jsonb_build_object('error', 'access_denied');
  END IF;

  IF v_order.status = 'cancelled' OR v_order.status = 'refunded' THEN
    RETURN jsonb_build_object('error', 'order_cancelled');
  END IF;

  -- Produkt laden
  SELECT * INTO v_product FROM public.products WHERE id = v_order.product_id;

  IF v_product.category != 'digital' THEN
    RETURN jsonb_build_object('error', 'not_digital_product');
  END IF;

  IF v_product.file_url IS NULL THEN
    RETURN jsonb_build_object('error', 'no_file_attached');
  END IF;

  -- file_url auf Supabase Storage Pfad parsen
  -- Erwartet Format: https://<project>.supabase.co/storage/v1/object/public/digital-products/<path>
  v_file_path := regexp_replace(
    v_product.file_url,
    '^.*/digital-products/',
    ''
  );

  -- Download-URL in orders.download_url speichern (optional, für Audit)
  -- Die eigentliche Signed URL wird vom Client via supabase.storage.createSignedUrl erzeugt
  -- Diese RPC gibt den storage path zurück → Client erzeugt signed URL
  RETURN jsonb_build_object(
    'success',    true,
    'order_id',   p_order_id,
    'file_path',  v_file_path,
    'bucket',     'digital-products',
    'expires_in', 3600  -- 1 Stunde
  );
END;
$$;


ALTER FUNCTION "public"."generate_download_url"("p_order_id" "uuid") OWNER TO "postgres";

--
-- Name: get_active_poll("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_active_poll"("p_session_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH p AS (
    SELECT id, question, options, created_at, closed_at
      FROM public.live_polls
     WHERE session_id = p_session_id
       AND closed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1
  ),
  t AS (
    SELECT option_index, vote_count
      FROM public.live_poll_tallies
     WHERE poll_id = (SELECT id FROM p)
  )
  SELECT
    CASE WHEN NOT EXISTS (SELECT 1 FROM p) THEN NULL
    ELSE jsonb_build_object(
      'id',         (SELECT id FROM p),
      'question',   (SELECT question FROM p),
      'options',    (SELECT options FROM p),
      'created_at', (SELECT created_at FROM p),
      'tallies',    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('option_index', option_index, 'vote_count', vote_count)) FROM t),
        '[]'::jsonb
      )
    )
    END
$$;


ALTER FUNCTION "public"."get_active_poll"("p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: get_active_preorder_round(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_active_preorder_round"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_round public.preorder_rounds%ROWTYPE;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_round
    FROM preorder_rounds
    WHERE status = 'open'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'id',                v_round.id,
    'product_id',        v_round.product_id,
    'title',             v_round.title,
    'target_qty',        v_round.target_qty,
    'closes_at',         v_round.closes_at,
    'status',            v_round.status,
    'reserved_qty',      COALESCE((
      SELECT SUM(pp.quantity) FROM product_preorders pp
      WHERE pp.round_id = v_round.id AND pp.status <> 'cancelled'
    ), 0),
    'participant_count', COALESCE((
      SELECT COUNT(*) FROM product_preorders pp
      WHERE pp.round_id = v_round.id AND pp.status <> 'cancelled'
    ), 0),
    'me_joined',         EXISTS (
      SELECT 1 FROM product_preorders pp
      WHERE pp.round_id = v_round.id AND pp.user_id = v_uid AND pp.status <> 'cancelled'
    ),
    'participants',      COALESCE((
      SELECT jsonb_agg(jsonb_build_object('username', pr.username, 'avatar_url', pr.avatar_url))
      FROM (
        SELECT pp.user_id FROM product_preorders pp
        WHERE pp.round_id = v_round.id AND pp.status <> 'cancelled'
        ORDER BY pp.created_at DESC LIMIT 3
      ) latest
      JOIN profiles pr ON pr.id = latest.user_id
    ), '[]'::jsonb),
    'product',           (
      SELECT jsonb_build_object(
        'id', p.id, 'title', p.title, 'cover_url', p.cover_url, 'price_eur', p.price_eur
      ) FROM products p WHERE p.id = v_round.product_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_active_preorder_round"() OWNER TO "postgres";

--
-- Name: get_active_preorder_round_public(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_active_preorder_round_public"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_round  public.preorder_rounds%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_round
    FROM preorder_rounds
    WHERE status = 'open'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'id',                v_round.id,
    'product_id',        v_round.product_id,
    'title',             v_round.title,
    'target_qty',        v_round.target_qty,
    'closes_at',         v_round.closes_at,
    'status',            v_round.status,
    'reserved_qty',      COALESCE((
      SELECT SUM(pp.quantity) FROM product_preorders pp
      WHERE pp.round_id = v_round.id AND pp.status <> 'cancelled'
    ), 0),
    'participant_count', COALESCE((
      SELECT COUNT(*) FROM product_preorders pp
      WHERE pp.round_id = v_round.id AND pp.status <> 'cancelled'
    ), 0),
    'product',           (
      SELECT jsonb_build_object(
        'id', p.id, 'title', p.title, 'cover_url', p.cover_url, 'price_eur', p.price_eur
      ) FROM products p WHERE p.id = v_round.product_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_active_preorder_round_public"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: shop_banners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."shop_banners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag" "text",
    "title" "text" NOT NULL,
    "subtitle" "text",
    "image_url" "text",
    "bg_color" "text" DEFAULT '#3a2a1a'::"text" NOT NULL,
    "link" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "advertiser_label" "text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "impression_count" bigint DEFAULT 0 NOT NULL,
    "click_count" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tag_ru" "text",
    "title_ru" "text",
    "subtitle_ru" "text",
    CONSTRAINT "shop_banners_title_len" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 80))),
    CONSTRAINT "shop_banners_window" CHECK ((("ends_at" IS NULL) OR ("starts_at" IS NULL) OR ("ends_at" > "starts_at")))
);


ALTER TABLE "public"."shop_banners" OWNER TO "postgres";

--
-- Name: COLUMN "shop_banners"."tag_ru"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."shop_banners"."tag_ru" IS 'Russische Variante von tag (NULL → Fallback auf tag)';


--
-- Name: COLUMN "shop_banners"."title_ru"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."shop_banners"."title_ru" IS 'Russische Variante von title (NULL → Fallback auf title)';


--
-- Name: COLUMN "shop_banners"."subtitle_ru"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."shop_banners"."subtitle_ru" IS 'Russische Variante von subtitle (NULL → Fallback auf subtitle)';


--
-- Name: get_active_shop_banners(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_active_shop_banners"() RETURNS SETOF "public"."shop_banners"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select *
  from public.shop_banners
  where active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >  now())
  order by sort_order asc, created_at desc
  limit 10;
$$;


ALTER FUNCTION "public"."get_active_shop_banners"() OWNER TO "postgres";

--
-- Name: get_active_web_push_subs("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_active_web_push_subs"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "endpoint" "text", "p256dh" "text", "auth" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Stale-Filter: 60 Tage. Browser invalidieren Subscriptions ungeprompted
  -- wenn der User die Site lange nicht besucht, wir wollen nicht an tote
  -- Endpoints senden (410 Gone / 404 vom Push-Service wäre Quota-Verlust).
  SELECT s.id, s.endpoint, s.p256dh, s.auth
    FROM public.web_push_subscriptions s
   WHERE s.user_id      = p_user_id
     AND s.last_seen_at > NOW() - INTERVAL '60 days';
$$;


ALTER FUNCTION "public"."get_active_web_push_subs"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: get_admin_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_admin_stats"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN public.has_admin_console_access() THEN jsonb_build_object(
      'total_users',         (SELECT COUNT(*) FROM public.profiles),
      'new_users_7d',        (SELECT COUNT(*) FROM public.profiles WHERE created_at >= NOW() - INTERVAL '7 days'),
      'total_posts',         (SELECT COUNT(*) FROM public.posts),
      'active_lives',        (SELECT COUNT(*) FROM public.live_sessions WHERE status = 'live'),
      'total_orders',        (SELECT COUNT(*) FROM public.orders),
      'total_revenue',       COALESCE((SELECT SUM(total_coins) FROM public.orders WHERE status IN ('completed', 'delivered')), 0),
      'pending_reports',     (SELECT COUNT(*) FROM public.content_reports WHERE status = 'pending')
    )
    ELSE jsonb_build_object('error', 'not_authorized')
  END;
$$;


ALTER FUNCTION "public"."get_admin_stats"() OWNER TO "postgres";

--
-- Name: get_ai_image_daily_report(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_ai_image_daily_report"("p_since" timestamp with time zone DEFAULT ("now"() - '1 day'::interval)) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_total_requests    INT;
  v_successful        INT;
  v_failed            INT;
  v_total_cents       INT;
  v_unique_users      INT;
  v_platform_30d      INT;
  v_platform_cap      CONSTANT INT := 5000;
  v_by_purpose        JSONB;
  v_top_users         JSONB;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE error IS NULL),
         COUNT(*) FILTER (WHERE error IS NOT NULL),
         COALESCE(SUM(cost_cents), 0),
         COUNT(DISTINCT user_id)
    INTO v_total_requests, v_successful, v_failed, v_total_cents, v_unique_users
    FROM public.ai_image_generations
   WHERE created_at >= p_since;

  SELECT COALESCE(SUM(cost_cents), 0) INTO v_platform_30d
    FROM public.ai_image_generations
   WHERE created_at > NOW() - INTERVAL '30 days';

  SELECT COALESCE(jsonb_object_agg(purpose::TEXT, cnt), '{}'::jsonb)
    INTO v_by_purpose
    FROM (
      SELECT purpose, COUNT(*) AS cnt
        FROM public.ai_image_generations
       WHERE created_at >= p_since
       GROUP BY purpose
    ) s;

  -- Top-5 Nutzer — hilft Missbrauchs-Pattern früh zu erkennen.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', user_id, 'count', cnt)), '[]'::jsonb)
    INTO v_top_users
    FROM (
      SELECT user_id, COUNT(*) AS cnt
        FROM public.ai_image_generations
       WHERE created_at >= p_since
       GROUP BY user_id
       ORDER BY cnt DESC
       LIMIT 5
    ) s;

  RETURN jsonb_build_object(
    'since',                  p_since,
    'total_requests',         v_total_requests,
    'successful',             v_successful,
    'failed',                 v_failed,
    'total_cents',            v_total_cents,
    'total_dollars',          ROUND(v_total_cents::numeric / 100, 2),
    'unique_users',           v_unique_users,
    'platform_30d_cents',     v_platform_30d,
    'platform_30d_dollars',   ROUND(v_platform_30d::numeric / 100, 2),
    'platform_cap_cents',     v_platform_cap,
    'platform_pct_used',      ROUND((v_platform_30d::numeric / v_platform_cap) * 100, 1),
    'by_purpose',             v_by_purpose,
    'top_users',              v_top_users
  );
END;
$$;


ALTER FUNCTION "public"."get_ai_image_daily_report"("p_since" timestamp with time zone) OWNER TO "postgres";

--
-- Name: get_ai_image_user_quota("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_ai_image_user_quota"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count_day         INT;
  v_count_week        INT;
  v_platform_cents    INT;
  v_platform_cap      CONSTANT INT := 5000;
  v_limit_day         CONSTANT INT := 3;
  v_limit_week        CONSTANT INT := 10;
  v_feature_enabled   BOOLEAN;
BEGIN
  -- Strikter Identity-Check: der Caller darf nur seine eigene Quota abfragen.
  -- SECURITY DEFINER läuft sonst als Owner und würde sonst fremde User-Quotas
  -- leaken. `auth.uid()` im Aufruferkontext = JWT-Subject.
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT public.is_feature_enabled('ai_image_enabled') INTO v_feature_enabled;

  SELECT COUNT(*) INTO v_count_day
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '24 hours';

  SELECT COUNT(*) INTO v_count_week
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND created_at > NOW() - INTERVAL '7 days';

  SELECT COALESCE(SUM(cost_cents), 0) INTO v_platform_cents
    FROM public.ai_image_generations
   WHERE created_at > NOW() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'used_today',             v_count_day,
    'limit_day',              v_limit_day,
    'remaining_today',        GREATEST(v_limit_day - v_count_day, 0),
    'used_week',              v_count_week,
    'limit_week',             v_limit_week,
    'remaining_week',         GREATEST(v_limit_week - v_count_week, 0),
    'platform_cap_reached',   v_platform_cents >= v_platform_cap,
    'feature_enabled',        v_feature_enabled
  );
END;
$$;


ALTER FUNCTION "public"."get_ai_image_user_quota"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: get_blocked_user_ids(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_blocked_user_ids"() RETURNS TABLE("user_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT blocked_id FROM user_blocks WHERE blocker_id = auth.uid()
  UNION
  SELECT blocker_id FROM user_blocks WHERE blocked_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_blocked_user_ids"() OWNER TO "postgres";

--
-- Name: get_conversations(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_conversations"() RETURNS TABLE("id" "uuid", "other_user_id" "uuid", "other_username" "text", "other_avatar_url" "text", "last_message" "text", "last_message_at" timestamp with time zone, "unread_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  WITH my_convs AS (
    -- Alle Konversationen des eingeloggten Users
    SELECT
      c.id,
      c.last_message_at,
      CASE WHEN c.participant_1 = auth.uid() THEN c.participant_2
           ELSE c.participant_1
      END AS other_user_id
    FROM conversations c
    WHERE c.participant_1 = auth.uid()
       OR c.participant_2 = auth.uid()
  ),

  last_msgs AS (
    -- Letzte Nachricht pro Konversation (1 Query für alle)
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content AS last_message
    FROM messages m
    WHERE m.conversation_id IN (SELECT id FROM my_convs)
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    -- Ungelesene Nachrichten pro Konversation (1 Query für alle)
    SELECT
      m.conversation_id,
      COUNT(*) AS unread_count
    FROM messages m
    WHERE m.conversation_id IN (SELECT id FROM my_convs)
      AND m.read = false
      AND m.sender_id != auth.uid()
    GROUP BY m.conversation_id
  )
  SELECT
    mc.id,
    mc.other_user_id,
    p.username       AS other_username,
    p.avatar_url     AS other_avatar_url,
    lm.last_message,
    mc.last_message_at,
    COALESCE(uc.unread_count, 0) AS unread_count
  FROM my_convs mc
  LEFT JOIN profiles        p  ON p.id  = mc.other_user_id
  LEFT JOIN last_msgs       lm ON lm.conversation_id = mc.id
  LEFT JOIN unread_counts   uc ON uc.conversation_id = mc.id
  ORDER BY mc.last_message_at DESC NULLS LAST;
$$;


ALTER FUNCTION "public"."get_conversations"() OWNER TO "postgres";

--
-- Name: get_creator_earnings("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_creator_earnings"("p_user_id" "uuid", "p_days" integer DEFAULT 28) RETURNS TABLE("diamonds_balance" bigint, "total_gifted" bigint, "period_gifts" bigint, "period_diamonds" bigint, "top_gift_name" "text", "top_gift_emoji" "text", "top_gifter_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  SELECT
    -- Wallet-Stand
    COALESCE((SELECT cw.diamonds FROM coins_wallets cw WHERE cw.user_id = p_user_id), 0)::BIGINT AS diamonds_balance,
    COALESCE((SELECT cw.total_gifted FROM coins_wallets cw WHERE cw.user_id = p_user_id), 0)::BIGINT AS total_gifted,

    -- Periode: Anzahl Gifts empfangen
    COUNT(gt.id)::BIGINT AS period_gifts,

    -- Periode: Diamonds verdient
    COALESCE(SUM(gt.diamond_value), 0)::BIGINT AS period_diamonds,

    -- Beliebtestes Gift im Zeitraum
    (
      SELECT gc.name FROM gift_transactions gt2
      JOIN gift_catalog gc ON gc.id = gt2.gift_id
      WHERE gt2.recipient_id = p_user_id AND gt2.created_at >= v_cutoff
      GROUP BY gc.id, gc.name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_gift_name,
    (
      SELECT gc.emoji FROM gift_transactions gt2
      JOIN gift_catalog gc ON gc.id = gt2.gift_id
      WHERE gt2.recipient_id = p_user_id AND gt2.created_at >= v_cutoff
      GROUP BY gc.id, gc.emoji
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_gift_emoji,

    -- Top-Sender Username
    (
      SELECT p.username FROM gift_transactions gt2
      JOIN profiles p ON p.id = gt2.sender_id
      WHERE gt2.recipient_id = p_user_id AND gt2.created_at >= v_cutoff
      GROUP BY p.id, p.username
      ORDER BY SUM(gt2.diamond_value) DESC
      LIMIT 1
    ) AS top_gifter_name

  FROM gift_transactions gt
  WHERE gt.recipient_id = p_user_id
    AND gt.created_at >= v_cutoff;
END;
$$;


ALTER FUNCTION "public"."get_creator_earnings"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";

--
-- Name: get_creator_engagement_hours("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_creator_engagement_hours"("p_user_id" "uuid", "p_days" integer DEFAULT 28) RETURNS TABLE("weekday" integer, "hour_of_day" integer, "engagement_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH events AS (
    -- Likes auf eigene Posts
    SELECT l.created_at
      FROM public.likes l
      JOIN public.posts p ON p.id = l.post_id
     WHERE p.author_id = p_user_id
       AND l.created_at >= NOW() - (p_days || ' days')::INTERVAL

    UNION ALL

    -- Comments auf eigene Posts
    SELECT c.created_at
      FROM public.comments c
      JOIN public.posts p ON p.id = c.post_id
     WHERE p.author_id = p_user_id
       AND c.created_at >= NOW() - (p_days || ' days')::INTERVAL
  )
  SELECT
    (EXTRACT(ISODOW FROM created_at AT TIME ZONE 'UTC')::INT - 1) AS weekday,
    EXTRACT(HOUR     FROM created_at AT TIME ZONE 'UTC')::INT     AS hour_of_day,
    COUNT(*)                                                       AS engagement_count
    FROM events
   GROUP BY weekday, hour_of_day;
$$;


ALTER FUNCTION "public"."get_creator_engagement_hours"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";

--
-- Name: get_creator_follower_growth("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_creator_follower_growth"("p_user_id" "uuid", "p_days" integer DEFAULT 28) RETURNS TABLE("day" "date", "new_followers" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(f.created_at)  AS day,
    COUNT(*)::BIGINT    AS new_followers
  FROM public.follows f
  WHERE f.following_id = p_user_id
    AND f.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(f.created_at)
  ORDER BY day ASC;
END;
$$;


ALTER FUNCTION "public"."get_creator_follower_growth"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";

--
-- Name: get_creator_gift_history("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_creator_gift_history"("p_user_id" "uuid", "p_limit" integer DEFAULT 10) RETURNS TABLE("gift_name" "text", "gift_emoji" "text", "diamond_value" integer, "sender_name" "text", "sender_avatar" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    gc.name         AS gift_name,
    gc.emoji        AS gift_emoji,
    gt.diamond_value,
    p.username      AS sender_name,
    p.avatar_url    AS sender_avatar,
    gt.created_at
  FROM gift_transactions gt
  JOIN gift_catalog gc ON gc.id = gt.gift_id
  JOIN profiles p ON p.id = gt.sender_id
  WHERE gt.recipient_id = p_user_id
  ORDER BY gt.created_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_creator_gift_history"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";

--
-- Name: get_creator_overview("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_creator_overview"("p_user_id" "uuid", "p_days" integer DEFAULT 28) RETURNS TABLE("total_views" bigint, "total_likes" bigint, "total_comments" bigint, "prev_views" bigint, "prev_likes" bigint, "prev_comments" bigint, "total_followers" bigint, "new_followers" bigint, "prev_followers" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_cutoff      TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
  v_prev_cutoff TIMESTAMPTZ := NOW() - (p_days * 2 || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  SELECT
    -- Aktuelle Periode
    COALESCE(SUM(p.view_count), 0)::BIGINT AS total_views,
    (
      SELECT COUNT(*)::BIGINT FROM public.likes l
      WHERE l.post_id IN (SELECT id FROM public.posts WHERE author_id = p_user_id)
        AND l.created_at >= v_cutoff
    ) AS total_likes,
    (
      SELECT COUNT(*)::BIGINT FROM public.comments c
      WHERE c.post_id IN (SELECT id FROM public.posts WHERE author_id = p_user_id)
        AND c.created_at >= v_cutoff
        AND c.parent_id IS NULL
    ) AS total_comments,

    -- Vorherige Periode (für Trend-Pfeile)
    COALESCE(SUM(CASE WHEN p.created_at BETWEEN v_prev_cutoff AND v_cutoff THEN p.view_count ELSE 0 END), 0)::BIGINT AS prev_views,
    (
      SELECT COUNT(*)::BIGINT FROM public.likes l
      WHERE l.post_id IN (SELECT id FROM public.posts WHERE author_id = p_user_id)
        AND l.created_at BETWEEN v_prev_cutoff AND v_cutoff
    ) AS prev_likes,
    (
      SELECT COUNT(*)::BIGINT FROM public.comments c
      WHERE c.post_id IN (SELECT id FROM public.posts WHERE author_id = p_user_id)
        AND c.created_at BETWEEN v_prev_cutoff AND v_cutoff
        AND c.parent_id IS NULL
    ) AS prev_comments,

    -- Follower gesamt
    (SELECT COUNT(*)::BIGINT FROM public.follows WHERE following_id = p_user_id) AS total_followers,
    (SELECT COUNT(*)::BIGINT FROM public.follows WHERE following_id = p_user_id AND created_at >= v_cutoff) AS new_followers,
    (SELECT COUNT(*)::BIGINT FROM public.follows WHERE following_id = p_user_id AND created_at BETWEEN v_prev_cutoff AND v_cutoff) AS prev_followers

  FROM public.posts p
  WHERE p.author_id = p_user_id
    AND p.created_at >= v_cutoff;
END;
$$;


ALTER FUNCTION "public"."get_creator_overview"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";

--
-- Name: get_creator_top_posts("uuid", "text", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_creator_top_posts"("p_user_id" "uuid", "p_sort" "text" DEFAULT 'views'::"text", "p_limit" integer DEFAULT 5) RETURNS TABLE("post_id" "uuid", "caption" "text", "media_url" "text", "media_type" "text", "thumbnail_url" "text", "view_count" integer, "like_count" bigint, "comment_count" bigint, "created_at" timestamp with time zone, "rank" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH post_metrics AS (
    SELECT
      p.id                                                         AS post_id,
      p.caption,
      p.media_url,
      p.media_type,
      p.thumbnail_url,
      COALESCE(p.view_count, 0)                                    AS view_count,
      COALESCE(l.like_count, 0)                                    AS like_count,
      COALESCE(c.comment_count, 0)                                 AS comment_count,
      p.created_at
    FROM public.posts p
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS like_count
      FROM public.likes
      GROUP BY post_id
    ) l ON l.post_id = p.id
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS comment_count
      FROM public.comments
      WHERE parent_id IS NULL
      GROUP BY post_id
    ) c ON c.post_id = p.id
    WHERE p.author_id = p_user_id
  ),
  ranked AS (
    SELECT
      pm.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE p_sort
            WHEN 'likes'    THEN pm.like_count
            WHEN 'comments' THEN pm.comment_count
            ELSE pm.view_count
          END DESC
      ) AS rank
    FROM post_metrics pm
  )
  SELECT
    r.post_id, r.caption, r.media_url, r.media_type, r.thumbnail_url,
    r.view_count::INT, r.like_count, r.comment_count, r.created_at, r.rank
  FROM ranked r
  WHERE r.rank <= p_limit
  ORDER BY r.rank;
END;
$$;


ALTER FUNCTION "public"."get_creator_top_posts"("p_user_id" "uuid", "p_sort" "text", "p_limit" integer) OWNER TO "postgres";

--
-- Name: get_creator_watch_time_estimate("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_creator_watch_time_estimate"("p_user_id" "uuid", "p_days" integer DEFAULT 28) RETURNS TABLE("total_seconds_est" bigint, "total_views" bigint, "avg_seconds_per_view" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    (COALESCE(SUM(view_count), 0) * 8)::BIGINT                              AS total_seconds_est,
    COALESCE(SUM(view_count), 0)::BIGINT                                    AS total_views,
    CASE WHEN COALESCE(SUM(view_count), 0) > 0 THEN 8::NUMERIC ELSE 0 END   AS avg_seconds_per_view
    FROM public.posts
   WHERE author_id = p_user_id
     AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
$$;


ALTER FUNCTION "public"."get_creator_watch_time_estimate"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";

--
-- Name: get_experiment_params(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_experiment_params"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_experiment_params"() OWNER TO "postgres";

--
-- Name: get_experiment_stats("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_experiment_stats"("p_experiment_name" "text") RETURNS TABLE("variant" "text", "user_count" bigint, "avg_dwell_score" double precision, "avg_like_action" double precision, "avg_post_score" double precision)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_experiment_stats"("p_experiment_name" "text") OWNER TO "postgres";

--
-- Name: get_follow_counts("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_follow_counts"("target_user_id" "uuid") RETURNS TABLE("followers" bigint, "following" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
begin
  return query select
    (select count(*) from public.follows where following_id = target_user_id),
    (select count(*) from public.follows where follower_id  = target_user_id);
end;
$$;


ALTER FUNCTION "public"."get_follow_counts"("target_user_id" "uuid") OWNER TO "postgres";

--
-- Name: get_guild_feed(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_guild_feed"("result_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "author_id" "uuid", "caption" "text", "media_url" "text", "media_type" "text", "thumbnail_url" "text", "tags" "text"[], "created_at" timestamp with time zone, "username" "text", "avatar_url" "text", "author_guild_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  my_guild_id uuid;
BEGIN
  SELECT me.guild_id INTO my_guild_id
  FROM public.profiles me WHERE me.id = auth.uid();

  IF my_guild_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.author_id, p.caption, p.media_url, p.media_type,
    p.thumbnail_url, p.tags, p.created_at, pr.username, pr.avatar_url,
    pr.guild_id AS author_guild_id
  FROM public.posts p
  INNER JOIN public.profiles pr ON pr.id = p.author_id
  WHERE pr.guild_id = my_guild_id   -- kein privacy filter: Guild ist geschlossener Raum
  ORDER BY p.created_at DESC
  LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."get_guild_feed"("result_limit" integer) OWNER TO "postgres";

--
-- Name: get_guild_leaderboard("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_guild_leaderboard"("p_guild_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_top_posts   JSONB;
  v_top_members JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(t)) INTO v_top_posts
  FROM (
    SELECT
      p.id, p.caption, p.media_url, p.media_type, p.thumbnail_url,
      COALESCE(p.dwell_time_score, 0) AS dwell_time_score,
      ROUND((COALESCE(p.dwell_time_score, 0) * 30)::numeric, 1) AS avg_seconds,
      ROUND((COALESCE(p.dwell_time_score, 0) * 100)::numeric, 0) AS completion_pct,
      p.created_at,
      pr.id AS author_id, pr.username AS author_username, pr.avatar_url AS author_avatar
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    WHERE pr.guild_id::text = p_guild_id
      AND p.created_at > NOW() - INTERVAL '7 days'
    ORDER BY p.dwell_time_score DESC NULLS LAST, p.created_at DESC
    LIMIT 10
  ) t;
  SELECT jsonb_agg(row_to_json(t)) INTO v_top_members
  FROM (
    SELECT
      pr.id, pr.username, pr.avatar_url,
      COUNT(p.id) AS post_count,
      ROUND(AVG(COALESCE(p.dwell_time_score, 0))::numeric, 3) AS avg_dwell_score,
      ROUND((AVG(COALESCE(p.dwell_time_score, 0)) * 100)::numeric, 0) AS avg_completion_pct,
      MAX(COALESCE(p.dwell_time_score, 0)) AS best_score
    FROM public.profiles pr
    JOIN public.posts p ON p.author_id = pr.id
    WHERE pr.guild_id::text = p_guild_id
      AND p.created_at > NOW() - INTERVAL '7 days'
    GROUP BY pr.id, pr.username, pr.avatar_url
    HAVING COUNT(p.id) > 0
    ORDER BY avg_dwell_score DESC NULLS LAST
    LIMIT 10
  ) t;
  RETURN jsonb_build_object(
    'top_posts',   COALESCE(v_top_posts,   '[]'::jsonb),
    'top_members', COALESCE(v_top_members, '[]'::jsonb)
  );
END;
$$;


ALTER FUNCTION "public"."get_guild_leaderboard"("p_guild_id" "text") OWNER TO "postgres";

--
-- Name: get_guild_leaderboard("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_guild_leaderboard"("p_guild_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_top_posts   JSONB;
  v_top_members JSONB;
BEGIN

  SELECT jsonb_agg(row_to_json(t)) INTO v_top_posts
  FROM (
    SELECT
      p.id, p.caption, p.media_url, p.media_type, p.thumbnail_url,
      COALESCE(p.dwell_time_score, 0) AS dwell_time_score,
      ROUND((COALESCE(p.dwell_time_score, 0) * 30)::numeric, 1) AS avg_seconds,
      ROUND((COALESCE(p.dwell_time_score, 0) * 100)::numeric, 0) AS completion_pct,
      p.created_at,
      pr.id AS author_id, pr.username AS author_username, pr.avatar_url AS author_avatar
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    WHERE pr.guild_id = p_guild_id
      AND p.created_at > NOW() - INTERVAL '30 days'
    ORDER BY p.dwell_time_score DESC NULLS LAST, p.created_at DESC
    LIMIT 10
  ) t;

  SELECT jsonb_agg(row_to_json(t)) INTO v_top_members
  FROM (
    SELECT
      pr.id, pr.username, pr.avatar_url,
      COUNT(p.id) AS post_count,
      ROUND(AVG(COALESCE(p.dwell_time_score, 0))::numeric, 3) AS avg_dwell_score,
      ROUND((AVG(COALESCE(p.dwell_time_score, 0)) * 100)::numeric, 0) AS avg_completion_pct,
      MAX(COALESCE(p.dwell_time_score, 0)) AS best_score
    FROM public.profiles pr
    JOIN public.posts p ON p.author_id = pr.id
    WHERE pr.guild_id = p_guild_id
      AND p.created_at > NOW() - INTERVAL '30 days'
    GROUP BY pr.id, pr.username, pr.avatar_url
    HAVING COUNT(p.id) > 0
    ORDER BY avg_dwell_score DESC NULLS LAST
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'top_posts',   COALESCE(v_top_posts,   '[]'::jsonb),
    'top_members', COALESCE(v_top_members, '[]'::jsonb)
  );
END;
$$;


ALTER FUNCTION "public"."get_guild_leaderboard"("p_guild_id" "uuid") OWNER TO "postgres";

--
-- Name: get_live_session_audience("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_live_session_audience"("p_session_id" "uuid", "p_limit" integer DEFAULT 24) RETURNS TABLE("user_id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "is_verified" boolean, "joined_at" timestamp with time zone, "is_moderator" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    v.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_verified, FALSE) AS is_verified,
    v.joined_at,
    EXISTS (
      SELECT 1
      FROM public.live_moderators m
      WHERE m.session_id = v.session_id
        AND m.user_id = v.user_id
    ) AS is_moderator
  FROM public.live_session_viewers v
  JOIN public.live_sessions s
    ON s.id = v.session_id
  JOIN public.profiles p
    ON p.id = v.user_id
  WHERE v.session_id = p_session_id
    AND s.status = 'active'
    AND auth.uid() IS NOT NULL
  ORDER BY v.joined_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100);
$$;


ALTER FUNCTION "public"."get_live_session_audience"("p_session_id" "uuid", "p_limit" integer) OWNER TO "postgres";

--
-- Name: FUNCTION "get_live_session_audience"("p_session_id" "uuid", "p_limit" integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."get_live_session_audience"("p_session_id" "uuid", "p_limit" integer) IS 'Limited active live-room audience snapshot for authenticated viewers. Returns public profile fields only.';


--
-- Name: get_my_coin_order_history(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_my_coin_order_history"("p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "tier_id" "text", "coins" integer, "bonus_coins" integer, "price_cents" integer, "currency" "text", "status" "public"."coin_order_status", "invoice_url" "text", "receipt_url" "text", "paid_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  return query
    select o.id, o.tier_id, o.coins, o.bonus_coins, o.price_cents, o.currency,
           o.status, o.invoice_url, o.receipt_url, o.paid_at, o.created_at
    from web_coin_orders o
    where o.user_id = auth.uid()
    order by o.created_at desc
    limit least(p_limit, 200)
    offset p_offset;
end $$;


ALTER FUNCTION "public"."get_my_coin_order_history"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";

--
-- Name: get_my_ingress_credentials("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_my_ingress_credentials"("p_session_id" "uuid") RETURNS TABLE("ingress_url" "text", "ingress_stream_key" "text", "ingress_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Nur authenticated User
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Nur der Host darf seine eigenen Credentials lesen
  RETURN QUERY
    SELECT s.ingress_url, s.ingress_stream_key, s.ingress_type
    FROM public.live_sessions s
    WHERE s.id = p_session_id
      AND s.host_id = auth.uid()
      AND s.ingress_id IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."get_my_ingress_credentials"("p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: get_my_preorder_summary(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_my_preorder_summary"() RETURNS TABLE("product_id" "uuid", "title" "text", "cover_url" "text", "interested_count" bigint, "total_quantity" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.id, p.title, p.cover_url,
         count(pp.id)                       AS interested_count,
         COALESCE(sum(pp.quantity), 0)::bigint AS total_quantity
  FROM public.products p
  LEFT JOIN public.product_preorders pp
    ON pp.product_id = p.id AND pp.status IN ('interested', 'notified')
  WHERE p.seller_id = auth.uid() AND p.sale_mode = 'preorder'
  GROUP BY p.id, p.title, p.cover_url
  ORDER BY interested_count DESC, p.created_at DESC;
$$;


ALTER FUNCTION "public"."get_my_preorder_summary"() OWNER TO "postgres";

--
-- Name: get_my_referral_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_my_referral_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::int FROM public.profiles WHERE referred_by = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_referral_count"() OWNER TO "postgres";

--
-- Name: get_my_whip_ingress(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_my_whip_ingress"() RETURNS TABLE("ingress_id" "text", "ingress_url" "text", "stream_key" "text", "room_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
    SELECT w.ingress_id, w.ingress_url, w.stream_key, w.room_name
    FROM   user_whip_ingresses w
    WHERE  w.user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_my_whip_ingress"() OWNER TO "postgres";

--
-- Name: get_my_women_only_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_my_women_only_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_verified boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'none', 'verified', false);
  END IF;
  SELECT women_only_verified INTO v_verified FROM profiles WHERE id = v_uid;
  SELECT status INTO v_status FROM women_only_requests WHERE user_id = v_uid;
  RETURN jsonb_build_object(
    'status', COALESCE(v_status, 'none'),
    'verified', COALESCE(v_verified, false)
  );
END;
$$;


ALTER FUNCTION "public"."get_my_women_only_status"() OWNER TO "postgres";

--
-- Name: get_order_rating("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_order_rating"("p_user_id" "uuid") RETURNS TABLE("seller_avg" numeric, "seller_count" bigint, "buyer_avg" numeric, "buyer_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    round(avg(rating) FILTER (WHERE reviewer_role = 'buyer'), 2),
    count(*)          FILTER (WHERE reviewer_role = 'buyer'),
    round(avg(rating) FILTER (WHERE reviewer_role = 'seller'), 2),
    count(*)          FILTER (WHERE reviewer_role = 'seller')
  FROM public.order_reviews
  WHERE reviewee_id = p_user_id;
$$;


ALTER FUNCTION "public"."get_order_rating"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: get_post_comment_counts("uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_post_comment_counts"("p_post_ids" "uuid"[]) RETURNS TABLE("post_id" "uuid", "cnt" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT c.post_id, COUNT(*)::bigint
  FROM public.comments c
  WHERE c.post_id = ANY(p_post_ids)
  GROUP BY c.post_id;
$$;


ALTER FUNCTION "public"."get_post_comment_counts"("p_post_ids" "uuid"[]) OWNER TO "postgres";

--
-- Name: get_post_comments_web("uuid", integer, "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_post_comments_web"("p_post_id" "uuid", "p_limit" integer DEFAULT 30, "p_viewer_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "post_id" "uuid", "user_id" "uuid", "parent_id" "uuid", "body" "text", "like_count" bigint, "liked_by_me" boolean, "reply_count" bigint, "created_at" timestamp with time zone, "author_id" "uuid", "author_username" "text", "author_display_name" "text", "author_avatar_url" "text", "author_verified" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH base AS (
    SELECT
      c.id,
      c.post_id,
      c.user_id,
      c.parent_id,
      c.text AS body,
      c.created_at
    FROM public.comments c
    WHERE c.post_id = p_post_id
      AND c.parent_id IS NULL
    ORDER BY c.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100)
  ),
  like_counts AS (
    SELECT cl.comment_id, COUNT(*)::bigint AS like_count
    FROM public.comment_likes cl
    JOIN base b ON b.id = cl.comment_id
    GROUP BY cl.comment_id
  ),
  viewer_likes AS (
    SELECT cl.comment_id
    FROM public.comment_likes cl
    JOIN base b ON b.id = cl.comment_id
    WHERE p_viewer_id IS NOT NULL
      AND cl.user_id = p_viewer_id
  ),
  reply_counts AS (
    SELECT r.parent_id AS comment_id, COUNT(*)::bigint AS reply_count
    FROM public.comments r
    JOIN base b ON b.id = r.parent_id
    GROUP BY r.parent_id
  )
  SELECT
    b.id,
    b.post_id,
    b.user_id,
    b.parent_id,
    COALESCE(b.body, '') AS body,
    COALESCE(lc.like_count, 0) AS like_count,
    (vl.comment_id IS NOT NULL) AS liked_by_me,
    COALESCE(rc.reply_count, 0) AS reply_count,
    b.created_at,
    p.id AS author_id,
    p.username AS author_username,
    p.display_name AS author_display_name,
    p.avatar_url AS author_avatar_url,
    COALESCE(p.is_verified, false) AS author_verified
  FROM base b
  JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN like_counts lc ON lc.comment_id = b.id
  LEFT JOIN viewer_likes vl ON vl.comment_id = b.id
  LEFT JOIN reply_counts rc ON rc.comment_id = b.id
  ORDER BY b.created_at DESC;
$$;


ALTER FUNCTION "public"."get_post_comments_web"("p_post_id" "uuid", "p_limit" integer, "p_viewer_id" "uuid") OWNER TO "postgres";

--
-- Name: get_post_like_counts("uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_post_like_counts"("p_post_ids" "uuid"[]) RETURNS TABLE("post_id" "uuid", "cnt" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT l.post_id, COUNT(*)::bigint
  FROM public.likes l
  WHERE l.post_id = ANY(p_post_ids)
  GROUP BY l.post_id;
$$;


ALTER FUNCTION "public"."get_post_like_counts"("p_post_ids" "uuid"[]) OWNER TO "postgres";

--
-- Name: get_product_preorders("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_product_preorders"("p_product_id" "uuid") RETURNS TABLE("user_id" "uuid", "username" "text", "avatar_url" "text", "quantity" integer, "note" "text", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT pp.user_id, pr.username, pr.avatar_url, pp.quantity, pp.note, pp.status, pp.created_at
  FROM public.product_preorders pp
  JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE pp.product_id = p_product_id
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = p_product_id
        AND (p.seller_id = auth.uid() OR COALESCE(public.is_admin(), false))
    )
  ORDER BY pp.created_at DESC;
$$;


ALTER FUNCTION "public"."get_product_preorders"("p_product_id" "uuid") OWNER TO "postgres";

--
-- Name: get_profile_posts_web("uuid", integer, integer, timestamp with time zone, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_profile_posts_web"("p_user_id" "uuid", "result_limit" integer DEFAULT 24, "result_offset" integer DEFAULT 0, "before_ts" timestamp with time zone DEFAULT NULL::timestamp with time zone, "sort_key" "text" DEFAULT 'newest'::"text") RETURNS TABLE("id" "uuid", "author_id" "uuid", "caption" "text", "media_url" "text", "media_type" "text", "thumbnail_url" "text", "view_count" bigint, "tags" "text"[], "allow_comments" boolean, "allow_duet" boolean, "women_only" boolean, "is_pinned" boolean, "aspect_ratio" "text", "created_at" timestamp with time zone, "like_count" bigint, "comment_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.author_id,
    p.caption,
    COALESCE(p.media_url, '') AS media_url,
    p.media_type,
    p.thumbnail_url,
    COALESCE(p.view_count, 0)::bigint AS view_count,
    COALESCE(p.tags, ARRAY[]::text[]) AS tags,
    COALESCE(p.allow_comments, true) AS allow_comments,
    COALESCE(p.allow_duet, true) AS allow_duet,
    COALESCE(p.women_only, false) AS women_only,
    COALESCE(p.is_pinned, false) AS is_pinned,
    COALESCE(p.aspect_ratio, 'portrait') AS aspect_ratio,
    p.created_at,
    COALESCE(p.like_count, 0)::bigint AS like_count,
    COALESCE(p.comment_count, 0)::bigint AS comment_count
  FROM public.posts p
  WHERE p.author_id = p_user_id
    AND COALESCE(p.privacy, 'public') = 'public'
    AND COALESCE(p.women_only, false) = false
    AND (
      before_ts IS NULL
      OR lower(COALESCE(sort_key, 'newest')) <> 'newest'
      OR p.created_at < before_ts
    )
  ORDER BY
    COALESCE(p.is_pinned, false) DESC,
    CASE
      WHEN lower(COALESCE(sort_key, 'newest')) = 'views'
      THEN COALESCE(p.view_count, 0)
    END DESC NULLS LAST,
    CASE
      WHEN lower(COALESCE(sort_key, 'newest')) = 'likes'
      THEN COALESCE(p.like_count, 0)
    END DESC NULLS LAST,
    p.created_at DESC,
    p.id DESC
  OFFSET greatest(0, COALESCE(result_offset, 0))
  LIMIT greatest(1, least(COALESCE(result_limit, 24), 100));
$$;


ALTER FUNCTION "public"."get_profile_posts_web"("p_user_id" "uuid", "result_limit" integer, "result_offset" integer, "before_ts" timestamp with time zone, "sort_key" "text") OWNER TO "postgres";

--
-- Name: get_public_discover_people_web(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_public_discover_people_web"("result_limit" integer DEFAULT 12) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "verified" boolean, "reason" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_verified, false) AS verified,
    'new'::text AS reason
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND COALESCE(p.is_private, false) = false
    AND COALESCE(p.is_banned, false) = false
    AND COALESCE(p.is_shadow_banned, false) = false
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 12), 100));
$$;


ALTER FUNCTION "public"."get_public_discover_people_web"("result_limit" integer) OWNER TO "postgres";

--
-- Name: get_public_explore_feed_web(integer, integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_public_explore_feed_web"("result_limit" integer DEFAULT 12, "result_offset" integer DEFAULT 0, "sort_key" "text" DEFAULT 'newest'::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "caption" "text", "video_url" "text", "media_type" "text", "thumbnail_url" "text", "view_count" bigint, "like_count" bigint, "comment_count" bigint, "hashtags" "text"[], "allow_comments" boolean, "allow_duet" boolean, "allow_download" boolean, "women_only" boolean, "privacy" "text", "aspect_ratio" "text", "audio_url" "text", "audio_volume" double precision, "created_at" timestamp with time zone, "author_id" "uuid", "author_username" "text", "author_display_name" "text", "author_avatar_url" "text", "author_verified" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH visible_posts AS MATERIALIZED (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      p.thumbnail_url,
      p.view_count,
      p.like_count,
      p.comment_count,
      p.tags,
      p.allow_comments,
      p.allow_duet,
      p.allow_download,
      p.privacy,
      p.aspect_ratio,
      p.audio_url,
      p.audio_volume,
      p.created_at
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    WHERE p.privacy = 'public'
      AND COALESCE(p.women_only, false) = false
      AND COALESCE(pr.is_banned, false) = false
      AND COALESCE(pr.is_shadow_banned, false) = false
    ORDER BY
      CASE
        WHEN lower(COALESCE(sort_key, 'newest')) = 'trending'
        THEN COALESCE(p.view_count, 0)
      END DESC NULLS LAST,
      p.created_at DESC,
      p.id DESC
    OFFSET greatest(0, COALESCE(result_offset, 0))
    LIMIT greatest(1, least(COALESCE(result_limit, 12), 100))
  )
  SELECT
    p.id,
    p.author_id AS user_id,
    p.caption,
    COALESCE(p.media_url, '') AS video_url,
    p.media_type,
    p.thumbnail_url,
    COALESCE(p.view_count, 0)::bigint AS view_count,
    COALESCE(p.like_count, 0)::bigint AS like_count,
    COALESCE(p.comment_count, 0)::bigint AS comment_count,
    COALESCE(p.tags, ARRAY[]::text[]) AS hashtags,
    COALESCE(p.allow_comments, true) AS allow_comments,
    COALESCE(p.allow_duet, true) AS allow_duet,
    COALESCE(p.allow_download, true) AS allow_download,
    false AS women_only,
    COALESCE(p.privacy, 'public') AS privacy,
    COALESCE(p.aspect_ratio, 'portrait') AS aspect_ratio,
    p.audio_url,
    p.audio_volume::double precision AS audio_volume,
    p.created_at,
    pr.id AS author_id,
    pr.username AS author_username,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    COALESCE(pr.is_verified, false) AS author_verified
  FROM visible_posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  ORDER BY
    CASE
      WHEN lower(COALESCE(sort_key, 'newest')) = 'trending'
      THEN COALESCE(p.view_count, 0)
    END DESC NULLS LAST,
    p.created_at DESC,
    p.id DESC;
$$;


ALTER FUNCTION "public"."get_public_explore_feed_web"("result_limit" integer, "result_offset" integer, "sort_key" "text") OWNER TO "postgres";

--
-- Name: get_public_feed_web(integer, timestamp with time zone, "uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_public_feed_web"("result_limit" integer DEFAULT 12, "before_ts" timestamp with time zone DEFAULT NULL::timestamp with time zone, "exclude_post_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS TABLE("id" "uuid", "user_id" "uuid", "caption" "text", "video_url" "text", "media_type" "text", "thumbnail_url" "text", "view_count" bigint, "like_count" bigint, "comment_count" bigint, "hashtags" "text"[], "allow_comments" boolean, "allow_duet" boolean, "allow_download" boolean, "women_only" boolean, "privacy" "text", "aspect_ratio" "text", "audio_url" "text", "audio_volume" double precision, "created_at" timestamp with time zone, "author_id" "uuid", "author_username" "text", "author_display_name" "text", "author_avatar_url" "text", "author_verified" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.author_id AS user_id,
    p.caption,
    COALESCE(p.media_url, '') AS video_url,
    p.media_type,
    p.thumbnail_url,
    COALESCE(p.view_count, 0)::bigint AS view_count,
    COALESCE(p.like_count, 0)::bigint AS like_count,
    COALESCE(p.comment_count, 0)::bigint AS comment_count,
    COALESCE(p.tags, ARRAY[]::text[]) AS hashtags,
    COALESCE(p.allow_comments, true) AS allow_comments,
    COALESCE(p.allow_duet, true) AS allow_duet,
    COALESCE(p.allow_download, true) AS allow_download,
    COALESCE(p.women_only, false) AS women_only,
    COALESCE(p.privacy, 'public') AS privacy,
    COALESCE(p.aspect_ratio, 'portrait') AS aspect_ratio,
    p.audio_url,
    p.audio_volume::double precision AS audio_volume,
    p.created_at,
    pr.id AS author_id,
    pr.username AS author_username,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    COALESCE(pr.is_verified, false) AS author_verified
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.privacy = 'public'
    AND COALESCE(pr.is_banned, false) = false
    AND COALESCE(pr.is_shadow_banned, false) = false
    AND (before_ts IS NULL OR p.created_at < before_ts)
    AND (
      COALESCE(cardinality(exclude_post_ids), 0) = 0
      OR p.id <> ALL(exclude_post_ids)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 12), 100));
$$;


ALTER FUNCTION "public"."get_public_feed_web"("result_limit" integer, "before_ts" timestamp with time zone, "exclude_post_ids" "uuid"[]) OWNER TO "postgres";

--
-- Name: get_public_feed_web_anon(integer, timestamp with time zone, "uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_public_feed_web_anon"("result_limit" integer DEFAULT 12, "before_ts" timestamp with time zone DEFAULT NULL::timestamp with time zone, "exclude_post_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS TABLE("id" "uuid", "user_id" "uuid", "caption" "text", "video_url" "text", "media_type" "text", "thumbnail_url" "text", "view_count" bigint, "like_count" bigint, "comment_count" bigint, "hashtags" "text"[], "allow_comments" boolean, "allow_duet" boolean, "allow_download" boolean, "women_only" boolean, "privacy" "text", "aspect_ratio" "text", "audio_url" "text", "audio_volume" double precision, "created_at" timestamp with time zone, "author_id" "uuid", "author_username" "text", "author_display_name" "text", "author_avatar_url" "text", "author_verified" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.author_id AS user_id,
    p.caption,
    COALESCE(p.media_url, '') AS video_url,
    p.media_type,
    p.thumbnail_url,
    COALESCE(p.view_count, 0)::bigint AS view_count,
    COALESCE(p.like_count, 0)::bigint AS like_count,
    COALESCE(p.comment_count, 0)::bigint AS comment_count,
    COALESCE(p.tags, ARRAY[]::text[]) AS hashtags,
    COALESCE(p.allow_comments, true) AS allow_comments,
    COALESCE(p.allow_duet, true) AS allow_duet,
    COALESCE(p.allow_download, true) AS allow_download,
    false AS women_only,
    COALESCE(p.privacy, 'public') AS privacy,
    COALESCE(p.aspect_ratio, 'portrait') AS aspect_ratio,
    p.audio_url,
    p.audio_volume::double precision AS audio_volume,
    p.created_at,
    pr.id AS author_id,
    pr.username AS author_username,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    COALESCE(pr.is_verified, false) AS author_verified
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.privacy = 'public'
    AND COALESCE(p.women_only, false) = false
    AND COALESCE(pr.is_banned, false) = false
    AND COALESCE(pr.is_shadow_banned, false) = false
    AND (before_ts IS NULL OR p.created_at < before_ts)
    AND (
      COALESCE(cardinality(exclude_post_ids), 0) = 0
      OR p.id <> ALL(exclude_post_ids)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 12), 100));
$$;


ALTER FUNCTION "public"."get_public_feed_web_anon"("result_limit" integer, "before_ts" timestamp with time zone, "exclude_post_ids" "uuid"[]) OWNER TO "postgres";

--
-- Name: get_public_feed_web_anon_first_page(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_public_feed_web_anon_first_page"("result_limit" integer DEFAULT 12) RETURNS TABLE("id" "uuid", "user_id" "uuid", "caption" "text", "video_url" "text", "media_type" "text", "thumbnail_url" "text", "view_count" bigint, "like_count" bigint, "comment_count" bigint, "hashtags" "text"[], "allow_comments" boolean, "allow_duet" boolean, "allow_download" boolean, "women_only" boolean, "privacy" "text", "aspect_ratio" "text", "audio_url" "text", "audio_volume" double precision, "created_at" timestamp with time zone, "author_id" "uuid", "author_username" "text", "author_display_name" "text", "author_avatar_url" "text", "author_verified" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH visible_posts AS MATERIALIZED (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      p.thumbnail_url,
      p.view_count,
      p.like_count,
      p.comment_count,
      p.tags,
      p.allow_comments,
      p.allow_duet,
      p.allow_download,
      p.privacy,
      p.aspect_ratio,
      p.audio_url,
      p.audio_volume,
      p.created_at
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    WHERE p.privacy = 'public'
      AND COALESCE(p.women_only, false) = false
      AND COALESCE(pr.is_banned, false) = false
      AND COALESCE(pr.is_shadow_banned, false) = false
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT greatest(1, least(COALESCE(result_limit, 12), 100))
  )
  SELECT
    p.id,
    p.author_id AS user_id,
    p.caption,
    COALESCE(p.media_url, '') AS video_url,
    p.media_type,
    p.thumbnail_url,
    COALESCE(p.view_count, 0)::bigint AS view_count,
    COALESCE(p.like_count, 0)::bigint AS like_count,
    COALESCE(p.comment_count, 0)::bigint AS comment_count,
    COALESCE(p.tags, ARRAY[]::text[]) AS hashtags,
    COALESCE(p.allow_comments, true) AS allow_comments,
    COALESCE(p.allow_duet, true) AS allow_duet,
    COALESCE(p.allow_download, true) AS allow_download,
    false AS women_only,
    COALESCE(p.privacy, 'public') AS privacy,
    COALESCE(p.aspect_ratio, 'portrait') AS aspect_ratio,
    p.audio_url,
    p.audio_volume::double precision AS audio_volume,
    p.created_at,
    pr.id AS author_id,
    pr.username AS author_username,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    COALESCE(pr.is_verified, false) AS author_verified
  FROM visible_posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  ORDER BY p.created_at DESC, p.id DESC;
$$;


ALTER FUNCTION "public"."get_public_feed_web_anon_first_page"("result_limit" integer) OWNER TO "postgres";

--
-- Name: get_public_post_web("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_public_post_web"("p_post_id" "uuid") RETURNS TABLE("id" "uuid", "author_id" "uuid", "caption" "text", "media_url" "text", "media_type" "text", "thumbnail_url" "text", "view_count" bigint, "tags" "text"[], "allow_comments" boolean, "allow_duet" boolean, "allow_download" boolean, "privacy" "text", "women_only" boolean, "aspect_ratio" "text", "audio_url" "text", "audio_volume" double precision, "created_at" timestamp with time zone, "like_count" bigint, "comment_count" bigint, "author_username" "text", "author_display_name" "text", "author_avatar_url" "text", "author_verified" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.author_id,
    p.caption,
    COALESCE(p.media_url, '') AS media_url,
    p.media_type,
    p.thumbnail_url,
    COALESCE(p.view_count, 0)::bigint AS view_count,
    COALESCE(p.tags, ARRAY[]::text[]) AS tags,
    COALESCE(p.allow_comments, true) AS allow_comments,
    COALESCE(p.allow_duet, true) AS allow_duet,
    COALESCE(p.allow_download, true) AS allow_download,
    COALESCE(p.privacy, 'public') AS privacy,
    COALESCE(p.women_only, false) AS women_only,
    COALESCE(p.aspect_ratio, 'portrait') AS aspect_ratio,
    p.audio_url,
    p.audio_volume,
    p.created_at,
    COALESCE(p.like_count, 0)::bigint AS like_count,
    COALESCE(p.comment_count, 0)::bigint AS comment_count,
    pr.username AS author_username,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    COALESCE(pr.is_verified, false) AS author_verified
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.id = p_post_id
    AND COALESCE(p.privacy, 'public') = 'public'
    AND COALESCE(p.women_only, false) = false
    AND COALESCE(pr.is_banned, false) = false
    AND COALESCE(pr.is_shadow_banned, false) = false
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_public_post_web"("p_post_id" "uuid") OWNER TO "postgres";

--
-- Name: get_public_profile_web("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_public_profile_web"("p_username" "text") RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "bio" "text", "is_verified" boolean, "is_private" boolean, "website" "text", "teip" "text", "follower_count" bigint, "following_count" bigint, "post_count" bigint, "is_live" boolean, "live_session_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH profile AS (
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.bio,
      COALESCE(p.is_verified, false) AS is_verified,
      COALESCE(p.is_private, false) AS is_private,
      p.website,
      p.teip
    FROM public.profiles p
    WHERE lower(p.username) = lower(p_username)
      AND COALESCE(p.is_banned, false) = false
      AND COALESCE(p.is_shadow_banned, false) = false
    LIMIT 1
  )
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.is_verified,
    p.is_private,
    p.website,
    p.teip,
    (SELECT count(*) FROM public.follows f WHERE f.following_id = p.id)::bigint AS follower_count,
    (SELECT count(*) FROM public.follows f WHERE f.follower_id = p.id)::bigint AS following_count,
    (
      SELECT count(*)
      FROM public.posts po
      WHERE po.author_id = p.id
        AND COALESCE(po.privacy, 'public') = 'public'
        AND COALESCE(po.women_only, false) = false
    )::bigint AS post_count,
    (live.id IS NOT NULL) AS is_live,
    live.id AS live_session_id
  FROM profile p
  LEFT JOIN LATERAL (
    SELECT ls.id
    FROM public.live_sessions ls
    WHERE ls.host_id = p.id
      AND ls.status = 'active'
      AND COALESCE(ls.women_only, false) = false
    ORDER BY ls.started_at DESC
    LIMIT 1
  ) live ON true;
$$;


ALTER FUNCTION "public"."get_public_profile_web"("p_username" "text") OWNER TO "postgres";

--
-- Name: get_public_shop_preview_products(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_public_shop_preview_products"("result_limit" integer DEFAULT 6) RETURNS TABLE("id" "uuid", "title" "text", "price_coins" integer, "sale_price_coins" integer, "cover_url" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.title,
    p.price_coins,
    p.sale_price_coins,
    p.cover_url
  FROM public.products p
  WHERE p.is_active = true
    AND p.women_only = false
  ORDER BY COALESCE(p.sold_count, 0) DESC, p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 6), 24));
$$;


ALTER FUNCTION "public"."get_public_shop_preview_products"("result_limit" integer) OWNER TO "postgres";

--
-- Name: get_saved_products(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_saved_products"("p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "seller_id" "uuid", "seller_username" "text", "seller_avatar" "text", "seller_verified" boolean, "title" "text", "description" "text", "category" "text", "price_coins" integer, "sale_price_coins" integer, "price_eur" numeric, "cover_url" "text", "image_urls" "text"[], "file_url" "text", "stock" integer, "sold_count" integer, "is_active" boolean, "women_only" boolean, "free_shipping" boolean, "location" "text", "created_at" timestamp with time zone, "avg_rating" numeric, "review_count" integer, "saved_at" timestamp with time zone, "sale_mode" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    p.id,
    p.seller_id,
    pr.username            AS seller_username,
    pr.avatar_url          AS seller_avatar,
    pr.is_verified         AS seller_verified,
    p.title,
    p.description,
    p.category,
    p.price_coins,
    p.sale_price_coins,
    p.price_eur,
    p.cover_url,
    p.image_urls,
    p.file_url,
    p.stock,
    p.sold_count,
    p.is_active,
    p.women_only,
    p.free_shipping,
    p.location,
    p.created_at,
    p.avg_rating,
    COALESCE(p.review_count, 0)  AS review_count,
    sp.created_at          AS saved_at,
    COALESCE(p.sale_mode, 'coins') AS sale_mode
  FROM public.saved_products sp
  JOIN public.products  p  ON p.id  = sp.product_id
  JOIN public.profiles  pr ON pr.id = p.seller_id
  WHERE sp.user_id = auth.uid()
    AND p.is_active = true
  ORDER BY sp.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."get_saved_products"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";

--
-- Name: get_shop_products("uuid", "text", integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_shop_products"("p_seller_id" "uuid" DEFAULT NULL::"uuid", "p_category" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 40, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "seller_id" "uuid", "seller_username" "text", "seller_avatar" "text", "seller_verified" boolean, "title" "text", "description" "text", "category" "text", "price_coins" integer, "sale_price_coins" integer, "price_eur" numeric, "cover_url" "text", "image_urls" "text"[], "file_url" "text", "stock" integer, "sold_count" integer, "is_active" boolean, "women_only" boolean, "free_shipping" boolean, "location" "text", "created_at" timestamp with time zone, "avg_rating" numeric, "review_count" integer, "sale_mode" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    p.id,
    p.seller_id,
    pr.username            AS seller_username,
    pr.avatar_url          AS seller_avatar,
    pr.is_verified         AS seller_verified,
    p.title,
    p.description,
    p.category,
    p.price_coins,
    p.sale_price_coins,
    p.price_eur,
    p.cover_url,
    p.image_urls,
    p.file_url,
    p.stock,
    p.sold_count,
    p.is_active,
    p.women_only,
    p.free_shipping,
    p.location,
    p.created_at,
    p.avg_rating,
    COALESCE(p.review_count, 0)  AS review_count,
    COALESCE(p.sale_mode, 'coins') AS sale_mode
  FROM public.products p
  JOIN public.profiles pr ON pr.id = p.seller_id
  WHERE p.is_active = true
    AND (p_seller_id IS NULL OR p.seller_id = p_seller_id)
    AND (p_category  IS NULL OR p.category  = p_category)
    AND (
      p.women_only = false
      OR (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND gender = 'female'
      ))
    )
  ORDER BY p.sold_count DESC, p.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."get_shop_products"("p_seller_id" "uuid", "p_category" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";

--
-- Name: get_trending_hashtags(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_trending_hashtags"("result_limit" integer DEFAULT 20) RETURNS TABLE("tag" "text", "post_count" bigint, "total_views" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH recent_posts AS (
    SELECT p.tags, p.view_count
    FROM public.posts p
    WHERE p.privacy = 'public'
      AND COALESCE(p.women_only, false) = false
      AND p.created_at >= now() - interval '7 days'
      AND p.tags IS NOT NULL
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 500
  ),
  normalized AS (
    SELECT
      lower(regexp_replace(trim(both from raw_tag), '^#', '')) AS tag,
      COALESCE(rp.view_count, 0)::bigint AS views
    FROM recent_posts rp
    CROSS JOIN LATERAL unnest(COALESCE(rp.tags, ARRAY[]::text[])) AS tags(raw_tag)
  )
  SELECT
    normalized.tag,
    count(*)::bigint AS post_count,
    COALESCE(sum(normalized.views), 0)::bigint AS total_views
  FROM normalized
  WHERE normalized.tag <> ''
  GROUP BY normalized.tag
  ORDER BY total_views DESC, post_count DESC, normalized.tag ASC
  LIMIT greatest(1, least(COALESCE(result_limit, 20), 100));
$$;


ALTER FUNCTION "public"."get_trending_hashtags"("result_limit" integer) OWNER TO "postgres";

--
-- Name: get_unread_shell_counts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_unread_shell_counts"() RETURNS TABLE("unread_dms" bigint, "unread_notifications" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH viewer AS (
    SELECT auth.uid() AS id
  )
  SELECT
    COALESCE((
      SELECT COUNT(*)
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      JOIN viewer v ON v.id IS NOT NULL
      WHERE m.read = false
        AND m.sender_id <> v.id
        AND (c.participant_1 = v.id OR c.participant_2 = v.id)
    ), 0)::bigint AS unread_dms,
    COALESCE((
      SELECT COUNT(*)
      FROM public.notifications n
      JOIN viewer v ON v.id IS NOT NULL
      WHERE n.recipient_id = v.id
        AND n.read = false
    ), 0)::bigint AS unread_notifications;
$$;


ALTER FUNCTION "public"."get_unread_shell_counts"() OWNER TO "postgres";

--
-- Name: get_user_variant("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_user_variant"("p_experiment_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_user_variant"("p_experiment_name" "text") OWNER TO "postgres";

--
-- Name: get_vibe_feed(double precision, double precision, integer, "text", boolean, "uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_vibe_feed"("explore_weight" double precision DEFAULT 0.5, "brain_weight" double precision DEFAULT 0.5, "result_limit" integer DEFAULT 20, "filter_tag" "text" DEFAULT NULL::"text", "include_seen" boolean DEFAULT false, "exclude_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS TABLE("id" "uuid", "author_id" "uuid", "caption" "text", "media_url" "text", "media_type" "text", "thumbnail_url" "text", "audio_url" "text", "dwell_time_score" double precision, "score_explore" double precision, "score_brain" double precision, "tags" "text"[], "guild_id" "uuid", "is_guild_post" boolean, "created_at" timestamp with time zone, "privacy" "text", "allow_comments" boolean, "allow_download" boolean, "allow_duet" boolean, "username" "text", "avatar_url" "text", "is_verified" boolean, "final_score" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_vibe_feed"("explore_weight" double precision, "brain_weight" double precision, "result_limit" integer, "filter_tag" "text", "include_seen" boolean, "exclude_ids" "uuid"[]) OWNER TO "postgres";

--
-- Name: get_women_only_requests("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_women_only_requests"("p_status" "text" DEFAULT 'pending'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(public.is_admin(), false) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'user_id',      r.user_id,
             'status',       r.status,
             'method',       r.method,
             'requested_at', r.requested_at,
             'reviewed_at',  r.reviewed_at,
             'note',         r.note,
             'username',     p.username,
             'display_name', p.display_name,
             'avatar_url',   p.avatar_url
           ) ORDER BY r.requested_at DESC)
    FROM women_only_requests r
    JOIN profiles p ON p.id = r.user_id
    WHERE p_status = 'all' OR r.status = p_status
  ), '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_women_only_requests"("p_status" "text") OWNER TO "postgres";

--
-- Name: gift_catalog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."gift_catalog" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text" NOT NULL,
    "coin_cost" integer NOT NULL,
    "diamond_value" integer NOT NULL,
    "lottie_url" "text",
    "color" "text",
    "sort_order" integer DEFAULT 0,
    "rarity" "text" DEFAULT 'common'::"text" NOT NULL,
    "season_tag" "text",
    "available_from" timestamp with time zone,
    "available_until" timestamp with time zone,
    CONSTRAINT "gift_catalog_coin_cost_check" CHECK (("coin_cost" > 0)),
    CONSTRAINT "gift_catalog_diamond_value_check" CHECK (("diamond_value" > 0)),
    CONSTRAINT "gift_catalog_rarity_check" CHECK (("rarity" = ANY (ARRAY['common'::"text", 'rare'::"text", 'epic'::"text", 'legendary'::"text"])))
);


ALTER TABLE "public"."gift_catalog" OWNER TO "postgres";

--
-- Name: gift_is_active("public"."gift_catalog"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."gift_is_active"("g" "public"."gift_catalog") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT
    (g.available_from  IS NULL OR g.available_from  <= NOW())
    AND (g.available_until IS NULL OR g.available_until > NOW())
$$;


ALTER FUNCTION "public"."gift_is_active"("g" "public"."gift_catalog") OWNER TO "postgres";

--
-- Name: grant_moderator("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."grant_moderator"("p_session_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_host UUID;
BEGIN
  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_host <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden_not_host' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_host THEN
    RAISE EXCEPTION 'cannot_mod_host' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_moderators (session_id, user_id, granted_by)
  VALUES (p_session_id, p_user_id, v_host)
  ON CONFLICT (session_id, user_id) DO NOTHING;
END $$;


ALTER FUNCTION "public"."grant_moderator"("p_session_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: guard_women_only_verified(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."guard_women_only_verified"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.women_only_verified IS DISTINCT FROM OLD.women_only_verified
     AND current_setting('app.woz_bypass', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'women_only_verified darf nur über die Freigabe-RPCs geändert werden';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_women_only_verified"() OWNER TO "postgres";

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_base text;
  v_try  int;
BEGIN
  v_base := btrim(COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''),
                           split_part(NEW.email, '@', 1)));
  IF v_base IS NULL OR v_base = '' THEN
    v_base := 'nutzer';
  END IF;

  FOR v_try IN 0..20 LOOP
    BEGIN
      INSERT INTO public.profiles (id, username)
      VALUES (NEW.id, CASE WHEN v_try = 0 THEN v_base ELSE v_base || v_try::text END);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      -- Kollidierte die Kennung, ist das Profil schon da und wir sind fertig.
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        RETURN NEW;
      END IF;
      -- Sonst war es der Name — nächster Versuch.
    END;
  END LOOP;

  -- Letzter Ausweg, garantiert eindeutig.
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, v_base || '-' || left(NEW.id::text, 8))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

--
-- Name: FUNCTION "handle_new_user"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Legt bei jeder Registrierung ein Profil an — für alle Wege: E-Mail, Google, Dashboard, Admin-API. Blockiert nie an einem belegten Namen.';


--
-- Name: has_admin_console_access(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."has_admin_console_access"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (
      SELECT is_admin OR is_moderator OR is_operator OR is_creator_ops
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    FALSE
  );
$$;


ALTER FUNCTION "public"."has_admin_console_access"() OWNER TO "postgres";

--
-- Name: heartbeat_live_session("uuid", integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."heartbeat_live_session"("p_session_id" "uuid", "p_viewer_count" integer DEFAULT NULL::integer, "p_peak_viewers" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  UPDATE public.live_sessions
  SET
    viewer_count = COALESCE(p_viewer_count, viewer_count),
    peak_viewers = GREATEST(peak_viewers, COALESCE(p_peak_viewers, peak_viewers))
    -- updated_at wird durch Trigger automatisch gesetzt
  WHERE id       = p_session_id
    AND host_id  = auth.uid()
    AND status   = 'active';
END;
$$;


ALTER FUNCTION "public"."heartbeat_live_session"("p_session_id" "uuid", "p_viewer_count" integer, "p_peak_viewers" integer) OWNER TO "postgres";

--
-- Name: incr_giveaway_entries(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."incr_giveaway_entries"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.live_giveaways
     SET entry_count = entry_count + 1
   WHERE id = NEW.giveaway_id;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."incr_giveaway_entries"() OWNER TO "postgres";

--
-- Name: incr_live_comment_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."incr_live_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE live_sessions
  SET comment_count = COALESCE(comment_count, 0) + 1
  WHERE id = NEW.session_id
    AND status = 'active';
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."incr_live_comment_count"() OWNER TO "postgres";

--
-- Name: increment_live_likes("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."increment_live_likes"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  UPDATE live_sessions
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = p_session_id
    AND status = 'active';
$$;


ALTER FUNCTION "public"."increment_live_likes"("p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: increment_live_recording_views("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."increment_live_recording_views"("p_recording_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.live_recordings
  SET view_count = view_count + 1
  WHERE id = p_recording_id
    AND status = 'ready'
    AND is_public = TRUE;
END;
$$;


ALTER FUNCTION "public"."increment_live_recording_views"("p_recording_id" "uuid") OWNER TO "postgres";

--
-- Name: increment_post_view("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."increment_post_view"("p_post_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id    uuid   := auth.uid();
  v_row_count  bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  -- Insert; wenn (post_id, user_id) bereits existiert -> no-op
  INSERT INTO public.post_views_log (post_id, user_id)
  VALUES (p_post_id, v_user_id)
  ON CONFLICT (post_id, user_id) DO NOTHING;

  -- Nur hochzählen wenn der Insert tatsächlich eine neue Zeile schrieb
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count > 0 THEN
    UPDATE public.posts
       SET view_count = view_count + 1
     WHERE id = p_post_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."increment_post_view"("p_post_id" "uuid") OWNER TO "postgres";

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

--
-- Name: is_cohost_blocked("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_cohost_blocked"("p_host_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_cohost_blocks
     WHERE host_id = p_host_id
       AND blocked_user_id = p_user_id
       AND (expires_at IS NULL OR expires_at > now())
  );
$$;


ALTER FUNCTION "public"."is_cohost_blocked"("p_host_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: is_feature_enabled("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_feature_enabled"("p_flag_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.feature_flags WHERE flag_key = p_flag_key),
    true  -- Fallback: wenn der Flag noch nie gesetzt wurde, Feature an lassen.
  );
$$;


ALTER FUNCTION "public"."is_feature_enabled"("p_flag_key" "text") OWNER TO "postgres";

--
-- Name: is_following_host("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_following_host"("p_session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_host_id UUID;
  v_follows  BOOLEAN;
BEGIN
  -- Host-ID aus Session laden
  SELECT host_id INTO v_host_id
  FROM public.live_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Ist der aktuelle User ein Follower des Hosts?
  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = auth.uid()
      AND following_id = v_host_id
  ) INTO v_follows;

  RETURN v_follows;
END;
$$;


ALTER FUNCTION "public"."is_following_host"("p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: is_live_session_moderator("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_live_session_moderator"("p_session_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    -- (a) Expliziter Session-Moderator (vom Host ernannt)
    EXISTS (
      SELECT 1
        FROM public.live_moderators m
       WHERE m.session_id = p_session_id
         AND m.user_id    = p_user_id
    )
    OR
    -- (b) Aktiver CoHost (vom Host akzeptiert, noch nicht revoked)
    -- Nutzt den Partial-Index idx_live_cohosts_session WHERE revoked_at IS NULL.
    EXISTS (
      SELECT 1
        FROM public.live_cohosts c
       WHERE c.session_id = p_session_id
         AND c.user_id    = p_user_id
         AND c.revoked_at IS NULL
    );
$$;


ALTER FUNCTION "public"."is_live_session_moderator"("p_session_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "is_live_session_moderator"("p_session_id" "uuid", "p_user_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."is_live_session_moderator"("p_session_id" "uuid", "p_user_id" "uuid") IS 'Prüft, ob ein User Moderations-Autorität in einer live_sessions-Zeile hat. TRUE für: explizite live_moderators-Einträge ODER aktive live_cohosts (revoked_at IS NULL). v1.27.2';


--
-- Name: is_product_saved("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_product_saved"("p_product_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.saved_products
    WHERE user_id = auth.uid() AND product_id = p_product_id
  );
$$;


ALTER FUNCTION "public"."is_product_saved"("p_product_id" "uuid") OWNER TO "postgres";

--
-- Name: is_women_only_verified(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_women_only_verified"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND gender = 'female'
      AND women_only_verified = true
  );
$$;


ALTER FUNCTION "public"."is_women_only_verified"() OWNER TO "postgres";

--
-- Name: join_live_session("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."join_live_session"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_inserted INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- Session muss existieren + active sein
  PERFORM 1 FROM public.live_sessions
   WHERE id = p_session_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN;  -- stilles No-Op statt Fehler (Viewer kann sich später reconnecten)
  END IF;

  -- Upsert-Dedup: erster Join-Call fügt Row ein, alle folgenden sind No-Op
  INSERT INTO public.live_session_viewers (session_id, user_id)
  VALUES (p_session_id, v_user_id)
  ON CONFLICT (session_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;  -- 1 = neu, 0 = schon drin

  -- Nur wenn tatsächlich neu: Counter inkrementieren
  IF v_inserted > 0 THEN
    UPDATE public.live_sessions
    SET
      viewer_count = viewer_count + 1,
      peak_viewers = GREATEST(peak_viewers, viewer_count + 1)
    WHERE id = p_session_id AND status = 'active';
  END IF;
END;
$$;


ALTER FUNCTION "public"."join_live_session"("p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: leave_live_session("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."leave_live_session"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  DELETE FROM public.live_session_viewers
   WHERE session_id = p_session_id AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    UPDATE public.live_sessions
    SET viewer_count = GREATEST(0, viewer_count - 1)
    WHERE id = p_session_id AND status = 'active';
  END IF;
END;
$$;


ALTER FUNCTION "public"."leave_live_session"("p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: leave_women_only(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."leave_women_only"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  PERFORM set_config('app.woz_bypass', 'on', true);
  UPDATE profiles
     SET women_only_verified = false, verification_level = 0
   WHERE id = v_uid;

  -- Antrag entfernen → sauberer Neustart, falls die Nutzerin später neu beitritt.
  DELETE FROM women_only_requests WHERE user_id = v_uid;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."leave_women_only"() OWNER TO "postgres";

--
-- Name: link_live_session_to_scheduled("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."link_live_session_to_scheduled"("p_scheduled_live_id" "uuid", "p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Sanity: Scheduled-Live gehört dem Caller und ist noch nicht live
  UPDATE public.scheduled_lives
     SET status     = 'live',
         session_id = p_session_id
   WHERE id         = p_scheduled_live_id
     AND host_id    = v_caller
     AND status IN ('scheduled','reminded');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Live nicht gefunden, gehört dir nicht, oder ist bereits live/expired/cancelled'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


ALTER FUNCTION "public"."link_live_session_to_scheduled"("p_scheduled_live_id" "uuid", "p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: list_ai_image_storage_paths_for_user("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."list_ai_image_storage_paths_for_user"("p_user_id" "uuid") RETURNS SETOF "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT storage_path
    FROM public.ai_image_generations
   WHERE user_id = p_user_id
     AND storage_path IS NOT NULL;
$$;


ALTER FUNCTION "public"."list_ai_image_storage_paths_for_user"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: list_ai_image_unconsumed_paths(interval, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."list_ai_image_unconsumed_paths"("p_older_than" interval DEFAULT '7 days'::interval, "p_limit" integer DEFAULT 500) RETURNS TABLE("id" "uuid", "storage_path" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT id, storage_path
    FROM public.ai_image_generations
   WHERE consumed_at IS NULL
     AND storage_path IS NOT NULL
     AND created_at < NOW() - p_older_than
   ORDER BY created_at ASC
   LIMIT p_limit;
$$;


ALTER FUNCTION "public"."list_ai_image_unconsumed_paths"("p_older_than" interval, "p_limit" integer) OWNER TO "postgres";

--
-- Name: live_notification_backlog_recovery(integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."live_notification_backlog_recovery"("p_older_than_days" integer DEFAULT 30, "p_limit" integer DEFAULT 500, "p_execute" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_days INT := GREATEST(1, LEAST(COALESCE(p_older_than_days, 30), 365));
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000));
  v_matched INT := 0;
  v_updated INT := 0;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin() OR public.can_operate()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH candidates AS (
    SELECT id
    FROM public.notifications
    WHERE read = false
      AND type IN ('live', 'scheduled_live_reminder')
      AND created_at < NOW() - make_interval(days => v_days)
    ORDER BY created_at ASC
    LIMIT v_limit
  )
  SELECT COUNT(*)::INT INTO v_matched FROM candidates;

  IF p_execute THEN
    WITH candidates AS (
      SELECT id
      FROM public.notifications
      WHERE read = false
        AND type IN ('live', 'scheduled_live_reminder')
        AND created_at < NOW() - make_interval(days => v_days)
      ORDER BY created_at ASC
      LIMIT v_limit
    ),
    updated AS (
      UPDATE public.notifications n
         SET read = true
        FROM candidates c
       WHERE n.id = c.id
       RETURNING n.id
    )
    SELECT COUNT(*)::INT INTO v_updated FROM updated;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'executed', p_execute,
    'older_than_days', v_days,
    'limit', v_limit,
    'matched', v_matched,
    'updated', v_updated,
    'types', jsonb_build_array('live', 'scheduled_live_reminder')
  );
END;
$$;


ALTER FUNCTION "public"."live_notification_backlog_recovery"("p_older_than_days" integer, "p_limit" integer, "p_execute" boolean) OWNER TO "postgres";

--
-- Name: mark_ai_image_consumed("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."mark_ai_image_consumed"("p_generation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.ai_image_generations
     SET consumed_at = COALESCE(consumed_at, NOW())
   WHERE id = p_generation_id
     AND user_id = auth.uid();

  -- Kein RAISE wenn 0 Rows getroffen — das kann passieren wenn a) die Row
  -- dem User nicht gehört (dann ist das eine stille Sicherheitsabwehr) oder
  -- b) die Row zwischenzeitlich gelöscht wurde (Edge-Case bei Account-
  -- Delete während Sheet offen). In beiden Fällen wäre ein Fehler im UI
  -- eine schlechte UX ohne Mehrwert.
END;
$$;


ALTER FUNCTION "public"."mark_ai_image_consumed"("p_generation_id" "uuid") OWNER TO "postgres";

--
-- Name: mark_due_scheduled_lives_reminded(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."mark_due_scheduled_lives_reminded"("p_batch_size" integer DEFAULT 50) RETURNS TABLE("scheduled_live_id" "uuid", "host_id" "uuid", "notified_count" integer, "success" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row       public.scheduled_lives%ROWTYPE;
  v_count     INT;
BEGIN
  FOR v_row IN
    SELECT *
      FROM public.scheduled_lives
     WHERE status = 'scheduled'
       AND scheduled_at <= NOW() + INTERVAL '15 minutes'
       AND scheduled_at > NOW() - INTERVAL '1 hour'
     ORDER BY scheduled_at ASC
     LIMIT p_batch_size
     FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.scheduled_lives
         SET status      = 'reminded',
             reminded_at = NOW()
       WHERE id = v_row.id;

      WITH inserted AS (
        INSERT INTO public.notifications (
          recipient_id,
          sender_id,
          type,
          session_id,
          comment_text
        )
        SELECT
          f.follower_id,
          v_row.host_id,
          'scheduled_live_reminder',
          NULL,
          v_row.title
        FROM public.follows f
        WHERE f.following_id = v_row.host_id
          AND f.follower_id <> v_row.host_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.muted_live_hosts m
            WHERE m.user_id = f.follower_id
              AND m.host_id = v_row.host_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.notifications n
            WHERE n.recipient_id = f.follower_id
              AND n.sender_id = v_row.host_id
              AND n.type IN ('live', 'scheduled_live_reminder')
              AND n.read = false
              AND n.created_at > NOW() - INTERVAL '7 days'
          )
          AND (
            SELECT COUNT(*)
            FROM public.notifications n
            WHERE n.recipient_id = f.follower_id
              AND n.type IN ('live', 'scheduled_live_reminder')
              AND n.read = false
              AND n.created_at > NOW() - INTERVAL '30 days'
          ) < 100
        RETURNING 1
      )
      SELECT COUNT(*)::INT INTO v_count FROM inserted;

      scheduled_live_id := v_row.id;
      host_id           := v_row.host_id;
      notified_count    := v_count;
      success           := true;
      error             := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      scheduled_live_id := v_row.id;
      host_id           := v_row.host_id;
      notified_count    := 0;
      success           := false;
      error             := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."mark_due_scheduled_lives_reminded"("p_batch_size" integer) OWNER TO "postgres";

--
-- Name: mark_messages_read("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."mark_messages_read"("p_conversation_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Nur Nachrichten in Conversations, wo User Teilnehmer ist,
  -- und nur Nachrichten, die NICHT von ihm selbst stammen.
  UPDATE public.messages m
     SET read = true
    FROM public.conversations c
   WHERE m.conversation_id = c.id
     AND m.conversation_id = p_conversation_id
     AND m.sender_id <> v_user_id
     AND m.read = false
     AND (c.participant_1 = v_user_id OR c.participant_2 = v_user_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;


ALTER FUNCTION "public"."mark_messages_read"("p_conversation_id" "uuid") OWNER TO "postgres";

--
-- Name: mark_order_shipped("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."mark_order_shipped"("p_order_id" "uuid", "p_carrier" "text" DEFAULT NULL::"text", "p_tracking" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  o     public.product_orders;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO o FROM public.product_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = '22023';
  END IF;
  IF o.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Nur bezahlte Bestellungen. Etwas als versendet zu melden, das nicht
  -- bezahlt ist, wäre der schnellste Weg zu einem Streitfall.
  IF o.status <> 'paid' THEN
    RAISE EXCEPTION 'order_not_paid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.product_orders
     SET status           = 'shipped',
         shipped_at       = now(),
         tracking_carrier = NULLIF(btrim(COALESCE(p_carrier, '')), ''),
         tracking_number  = NULLIF(btrim(COALESCE(p_tracking, '')), ''),
         updated_at       = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('order_id', p_order_id, 'status', 'shipped');
END $$;


ALTER FUNCTION "public"."mark_order_shipped"("p_order_id" "uuid", "p_carrier" "text", "p_tracking" "text") OWNER TO "postgres";

--
-- Name: FUNCTION "mark_order_shipped"("p_order_id" "uuid", "p_carrier" "text", "p_tracking" "text"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."mark_order_shipped"("p_order_id" "uuid", "p_carrier" "text", "p_tracking" "text") IS 'Berkat: Verkäufer meldet eine bezahlte Bestellung als versendet, mit Sendungsnummer.';


--
-- Name: mark_preorders_payable("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."mark_preorders_payable"("p_product_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_product  public.products%ROWTYPE;
  v_unit     numeric(10,2);
  v_created  int := 0;
  v_skipped  int := 0;
  r          record;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','product_not_found'); END IF;

  IF v_product.seller_id <> v_caller AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  v_unit := v_product.price_eur;
  IF v_unit IS NULL OR v_unit <= 0 THEN
    RETURN jsonb_build_object('error','no_eur_price');
  END IF;

  FOR r IN
    SELECT pp.* FROM public.product_preorders pp
     WHERE pp.product_id = p_product_id
       AND pp.status IN ('interested','notified')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.product_orders po
       WHERE po.preorder_id = r.id
         AND po.status IN ('payment_requested','paid','shipped')
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.product_orders
      (buyer_id, seller_id, product_id, preorder_id, quantity,
       unit_price_eur, amount_eur, platform_fee_eur, status, payment_requested_at)
    VALUES
      (r.user_id, v_product.seller_id, p_product_id, r.id, r.quantity,
       v_unit, v_unit * r.quantity, 0, 'payment_requested', now());

    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, product_name)
    VALUES (r.user_id, v_caller, 'order_payment_requested',
            'Deine Vorbestellung ist da! 🌸 Jetzt '
              || replace((v_unit * r.quantity)::text, '.', ',')
              || ' € zahlen — danach geht sie direkt an dich raus.',
            v_product.title);

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'created', v_created, 'skipped', v_skipped);
END $$;


ALTER FUNCTION "public"."mark_preorders_payable"("p_product_id" "uuid") OWNER TO "postgres";

--
-- Name: moderation_health_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."moderation_health_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_oldest_pending_age_seconds NUMERIC;
  v_legacy_post_unqueued BIGINT := 0;
  v_legacy_user_unqueued BIGINT := 0;
  v_legacy_live_unqueued BIGINT := 0;
BEGIN
  SELECT EXTRACT(EPOCH FROM (v_generated_at - MIN(created_at)))
    INTO v_oldest_pending_age_seconds
    FROM public.content_reports
   WHERE status = 'pending';

  IF to_regclass('public.post_reports') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.post_reports pr
      WHERE pr.reason = 'report'
        AND NOT EXISTS (
          SELECT 1
          FROM public.content_reports cr
          WHERE cr.reporter_id = pr.reporter_id
            AND cr.target_type = 'post'
            AND cr.target_id = pr.post_id
            AND cr.created_at >= pr.created_at - INTERVAL '1 minute'
        )
    $sql$ INTO v_legacy_post_unqueued;
  END IF;

  IF to_regclass('public.user_reports') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.user_reports ur
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.content_reports cr
        WHERE cr.reporter_id = ur.reporter_id
          AND cr.target_type = 'profile'
          AND cr.target_id = ur.reported_id
          AND cr.created_at >= ur.created_at - INTERVAL '1 minute'
      )
    $sql$ INTO v_legacy_user_unqueued;
  END IF;

  IF to_regclass('public.live_reports') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.live_reports lr
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.content_reports cr
        WHERE cr.reporter_id = lr.reporter_id
          AND cr.target_type = 'live'
          AND cr.target_id = lr.session_id
          AND cr.created_at >= lr.created_at - INTERVAL '1 minute'
      )
    $sql$ INTO v_legacy_live_unqueued;
  END IF;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'sla_hours', 24,
    'content_reports', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.content_reports),
      'pending', (SELECT COUNT(*) FROM public.content_reports WHERE status = 'pending'),
      'reviewed_7d', (
        SELECT COUNT(*)
        FROM public.content_reports
        WHERE reviewed_at >= v_generated_at - INTERVAL '7 days'
      ),
      'pending_over_sla', (
        SELECT COUNT(*)
        FROM public.content_reports
        WHERE status = 'pending'
          AND created_at < v_generated_at - INTERVAL '24 hours'
      ),
      'oldest_pending_age_seconds', v_oldest_pending_age_seconds,
      'by_target_type', COALESCE((
        SELECT jsonb_object_agg(target_type, count)
        FROM (
          SELECT target_type, COUNT(*) AS count
          FROM public.content_reports
          WHERE status = 'pending'
          GROUP BY target_type
          ORDER BY target_type
        ) grouped
      ), '{}'::jsonb)
    ),
    'legacy_unqueued', jsonb_build_object(
      'post_reports', COALESCE(v_legacy_post_unqueued, 0),
      'user_reports', COALESCE(v_legacy_user_unqueued, 0),
      'live_reports', COALESCE(v_legacy_live_unqueued, 0),
      'total',
        COALESCE(v_legacy_post_unqueued, 0) +
        COALESCE(v_legacy_user_unqueued, 0) +
        COALESCE(v_legacy_live_unqueued, 0)
    ),
    'admin_audit', jsonb_build_object(
      'events_7d', (
        SELECT COUNT(*)
        FROM public.admin_audit_log
        WHERE created_at >= v_generated_at - INTERVAL '7 days'
      ),
      'moderation_events_7d', (
        SELECT COUNT(*)
        FROM public.admin_audit_log
        WHERE action LIKE 'moderation.%'
          AND created_at >= v_generated_at - INTERVAL '7 days'
      )
    ),
    'enforcement', jsonb_build_object(
      'rpc_available', to_regprocedure('public.admin_enforce_content_report(uuid,text,text)') IS NOT NULL,
      'profile_ban_column', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_banned'
      ),
      'profile_restrict_columns', (
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_restricted'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'restricted_until'
        )
      ),
      'profile_shadowban_column', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_shadow_banned'
      ),
      'live_mute_table', to_regclass('public.live_chat_timeouts') IS NOT NULL,
      'audit_log_table', to_regclass('public.admin_audit_log') IS NOT NULL
    ),
    'auto_moderation', jsonb_build_object(
      'classifier_available', to_regprocedure('public.classify_post_moderation(text,text[],text,text)') IS NOT NULL,
      'trigger_available', EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'posts'
          AND t.tgname = 'trg_posts_automated_moderation'
          AND NOT t.tgisinternal
      ),
      'signal_table', to_regclass('public.moderation_auto_flags') IS NOT NULL,
      'flags_7d', (
        SELECT COUNT(*)
        FROM public.moderation_auto_flags
        WHERE created_at >= v_generated_at - INTERVAL '7 days'
      ),
      'pending_auto_reports', (
        SELECT COUNT(*)
        FROM public.content_reports
        WHERE status = 'pending'
          AND reason IN ('auto_spam', 'auto_nsfw', 'auto_scam')
      )
    )
  );
END;
$_$;


ALTER FUNCTION "public"."moderation_health_snapshot"() OWNER TO "postgres";

--
-- Name: notify_auction_won(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_auction_won"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_cents integer := COALESCE(NEW.current_bid_cents, 0);
BEGIN
  IF NEW.status <> 'sold'
     OR OLD.status IS NOT DISTINCT FROM 'sold'
     OR NEW.winner_id IS NULL
     OR NEW.winner_id = NEW.seller_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, session_id, product_name, comment_text, app)
  VALUES (
    NEW.winner_id,
    NEW.seller_id,
    'auction_won',
    NEW.session_id,
    NEW.title,
    format('%s · %s,%s €', NEW.title, v_cents / 100, lpad((v_cents % 100)::text, 2, '0')),
    'berkat'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_auction_won"() OWNER TO "postgres";

--
-- Name: notify_followers_on_go_live(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_followers_on_go_live"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_recent_count int;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Anti-spam: host has pushed recently. Covers reconnects/restarts.
  SELECT COUNT(*) INTO v_recent_count
    FROM public.notifications
   WHERE sender_id = NEW.host_id
     AND type = 'live'
     AND created_at > NOW() - INTERVAL '30 minutes';

  IF v_recent_count > 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    sender_id,
    type,
    session_id,
    comment_text,
    created_at
  )
  SELECT
    f.follower_id,
    NEW.host_id,
    'live',
    NEW.id,
    NEW.title,
    NOW()
  FROM public.follows f
  WHERE f.following_id = NEW.host_id
    AND f.follower_id <> NEW.host_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.muted_live_hosts m
      WHERE m.user_id = f.follower_id
        AND m.host_id = NEW.host_id
    )
    -- If the same recipient has not opened a recent live notification from
    -- this host, a new one adds badge pressure without adding value.
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.recipient_id = f.follower_id
        AND n.sender_id = NEW.host_id
        AND n.type = 'live'
        AND n.read = false
        AND n.created_at > NOW() - INTERVAL '7 days'
    )
    -- Backlog cap: users with a large unread live queue do not receive more
    -- live pings until they return and clear/open notifications.
    AND (
      SELECT COUNT(*)
      FROM public.notifications n
      WHERE n.recipient_id = f.follower_id
        AND n.type IN ('live', 'scheduled_live_reminder')
        AND n.read = false
        AND n.created_at > NOW() - INTERVAL '30 days'
    ) < 100;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_followers_on_go_live"() OWNER TO "postgres";

--
-- Name: notify_followers_on_live(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_followers_on_live"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  -- Nur beim Statuswechsel zu 'active' feuern
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status <> 'active') THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, session_id)
    SELECT
      f.follower_id,
      NEW.host_id,
      'live',
      NEW.id
    FROM public.follows f
    WHERE f.following_id = NEW.host_id
      AND f.follower_id <> NEW.host_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_followers_on_live"() OWNER TO "postgres";

--
-- Name: notify_on_comment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_on_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_post_author_id UUID;
  v_commenter_name TEXT;
  v_comment_preview TEXT;
BEGIN
  SELECT author_id INTO v_post_author_id
    FROM public.posts WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand') INTO v_commenter_name
    FROM public.profiles WHERE id = NEW.user_id;

  v_comment_preview := COALESCE(SUBSTRING(NEW.text, 1, 50), '...');

  PERFORM send_push_to_user(
    p_user_id := v_post_author_id,
    p_title   := '💬 Neuer Kommentar',
    p_body    := '@' || v_commenter_name || ': ' || v_comment_preview,
    p_data    := json_build_object('type', 'comment', 'postId', NEW.post_id)::jsonb
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_comment"() OWNER TO "postgres";

--
-- Name: notify_on_comment_to_table(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_on_comment_to_table"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, post_id, comment_text)
    VALUES (post_author, NEW.user_id, 'comment', NEW.post_id, LEFT(NEW.text, 80));
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_comment_to_table"() OWNER TO "postgres";

--
-- Name: notify_on_dm(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_on_dm"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sender_id    UUID;
  v_recipient_id UUID;
  v_sender_name  TEXT;
BEGIN
  v_sender_id := NEW.sender_id;

  -- Empfänger = der andere Teilnehmer der Konversation
  SELECT CASE
           WHEN participant_1 = v_sender_id THEN participant_2
           ELSE participant_1
         END
    INTO v_recipient_id
    FROM public.conversations
   WHERE id = NEW.conversation_id;

  IF v_recipient_id IS NULL           THEN RETURN NEW; END IF;
  IF v_recipient_id = v_sender_id     THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand')
    INTO v_sender_name
    FROM public.profiles
   WHERE id = v_sender_id;

  -- In-App Notification (unverändert)
  INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
  VALUES (v_recipient_id, v_sender_id, 'dm', LEFT(NEW.content, 200))
  ON CONFLICT DO NOTHING;

  -- Push über den kanonischen Direkt-Helper (identisch zu notify_on_like).
  PERFORM public.send_push_to_user(
    p_user_id := v_recipient_id,
    p_title   := '✉️ Neue Nachricht',
    p_body    := COALESCE(NULLIF(LEFT(NEW.content, 140), ''),
                          '@' || v_sender_name || ' schreibt dir'),
    p_data    := jsonb_build_object(
      'type',           'dm',
      'conversationId', NEW.conversation_id::text,
      'senderId',       v_sender_id::text,
      'senderUsername', v_sender_name
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_dm"() OWNER TO "postgres";

--
-- Name: notify_on_follow(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_on_follow"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_follower_name TEXT;
BEGIN
  SELECT COALESCE(username, 'Jemand') INTO v_follower_name
    FROM public.profiles WHERE id = NEW.follower_id;

  PERFORM send_push_to_user(
    p_user_id := NEW.following_id,
    p_title   := '👤 Neuer Follower',
    p_body    := '@' || v_follower_name || ' folgt dir jetzt',
    p_data    := json_build_object('type', 'follow', 'userId', NEW.follower_id)::jsonb
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_follow"() OWNER TO "postgres";

--
-- Name: notify_on_follow_request(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_on_follow_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_sender_name  TEXT;
  v_target_token TEXT;
BEGIN
  -- Nur wenn is_pending = true (Follow-Request an privates Profil)
  IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand')
    INTO v_sender_name
    FROM public.profiles
   WHERE id = NEW.follower_id;

  -- In-App Notification
  INSERT INTO public.notifications (recipient_id, sender_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow_request')
  ON CONFLICT DO NOTHING;

  -- Push
  SELECT push_token INTO v_target_token
    FROM public.profiles WHERE id = NEW.following_id;

  IF v_target_token IS NOT NULL AND v_target_token != '' THEN
    PERFORM net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send'::text,
      body    := jsonb_build_object(
        'to',    v_target_token,
        'title', '👤 Follow-Anfrage',
        'body',  '@' || v_sender_name || ' möchte dir folgen',
        'sound', 'default',
        'data',  jsonb_build_object(
          'type',     'follow_request',
          'senderId', NEW.follower_id::text
        )
      ),
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_follow_request"() OWNER TO "postgres";

--
-- Name: notify_on_follow_to_table(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_on_follow_to_table"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF NEW.following_id <> NEW.follower_id THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_follow_to_table"() OWNER TO "postgres";

--
-- Name: notify_on_gift(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_on_gift"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_gift_name  TEXT;
  v_gift_emoji TEXT;
BEGIN
  SELECT name, emoji INTO v_gift_name, v_gift_emoji
    FROM public.gift_catalog WHERE id = NEW.gift_id;

  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, sender_id, type, gift_name, gift_emoji, session_id, created_at
  ) VALUES (
    NEW.recipient_id, NEW.sender_id, 'gift', v_gift_name, v_gift_emoji,
    NEW.live_session_id::uuid, NOW()
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_gift"() OWNER TO "postgres";

--
-- Name: notify_on_like(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_on_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_post_author_id UUID;
  v_liker_username TEXT;
  v_post_caption   TEXT;
BEGIN
  SELECT author_id, COALESCE(SUBSTRING(caption, 1, 40), 'Dein Post')
    INTO v_post_author_id, v_post_caption
    FROM public.posts WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand') INTO v_liker_username
    FROM public.profiles WHERE id = NEW.user_id;

  PERFORM send_push_to_user(
    p_user_id := v_post_author_id,
    p_title   := '❤️ Neues Like',
    p_body    := '@' || v_liker_username || ' hat „' || v_post_caption || '" geliked',
    p_data    := json_build_object('type', 'like', 'postId', NEW.post_id)::jsonb
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_like"() OWNER TO "postgres";

--
-- Name: notify_on_like_to_table(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_on_like_to_table"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  -- Nicht sich selbst benachrichtigen
  IF post_author IS NOT NULL AND post_author <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, post_id)
    VALUES (post_author, NEW.user_id, 'like', NEW.post_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_like_to_table"() OWNER TO "postgres";

--
-- Name: notify_order_shipped(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_order_shipped"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.status <> 'shipped'
     OR OLD.status IS NOT DISTINCT FROM 'shipped'
     OR NEW.buyer_id IS NULL
     -- cart_id ist die Berkat-Weiche, siehe 20260814180000.
     OR NEW.cart_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, product_name, comment_text, app)
  VALUES (
    NEW.buyer_id,
    NEW.seller_id,
    'order_shipped',
    NEW.title,
    CASE
      WHEN NEW.tracking_number IS NOT NULL AND btrim(NEW.tracking_number) <> ''
        THEN format('%s ist unterwegs · %s', COALESCE(NEW.title, 'Dein Paket'), NEW.tracking_number)
      ELSE format('%s ist unterwegs', COALESCE(NEW.title, 'Dein Paket'))
    END,
    'berkat'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_order_shipped"() OWNER TO "postgres";

--
-- Name: notify_preorder_buyers("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_preorder_buyers"("p_product_id" "uuid", "p_message" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_seller  uuid;
  v_msg     text := NULLIF(btrim(p_message), '');
  v_count   int  := 0;
  v_conv    uuid;
  v_p1      uuid;
  v_p2      uuid;
  r         record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF v_msg IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'empty_message');
  END IF;
  IF length(v_msg) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'message_too_long');
  END IF;

  SELECT seller_id INTO v_seller FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;
  IF v_seller <> v_uid AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owner');
  END IF;

  FOR r IN
    SELECT user_id
    FROM public.product_preorders
    WHERE product_id = p_product_id AND status = 'interested'
  LOOP
    CONTINUE WHEN r.user_id = v_seller;  -- nie sich selbst anschreiben

    -- Konversation normalisiert (participant_1 < participant_2, wie in der App).
    IF v_seller < r.user_id THEN v_p1 := v_seller; v_p2 := r.user_id;
    ELSE                         v_p1 := r.user_id; v_p2 := v_seller; END IF;

    SELECT id INTO v_conv
      FROM public.conversations
     WHERE participant_1 = v_p1 AND participant_2 = v_p2;
    IF v_conv IS NULL THEN
      INSERT INTO public.conversations (participant_1, participant_2)
        VALUES (v_p1, v_p2)
        RETURNING id INTO v_conv;
    END IF;

    INSERT INTO public.messages (conversation_id, sender_id, content)
      VALUES (v_conv, v_seller, v_msg);

    UPDATE public.product_preorders
       SET status = 'notified', updated_at = now()
     WHERE product_id = p_product_id AND user_id = r.user_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'notified', v_count);
END;
$$;


ALTER FUNCTION "public"."notify_preorder_buyers"("p_product_id" "uuid", "p_message" "text") OWNER TO "postgres";

--
-- Name: notify_scheduled_post_failure(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_scheduled_post_failure"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caption TEXT;
  v_body    TEXT;
BEGIN
  -- Nur feuern, wenn der Status auf 'failed' wechselt — nicht bei jedem UPDATE.
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status <> 'failed') THEN

    v_caption := COALESCE(LEFT(NEW.caption, 40), 'Geplanter Post');
    IF LENGTH(NEW.caption) > 40 THEN
      v_caption := v_caption || '…';
    END IF;

    v_body := format(
      '"%s" konnte nicht veröffentlicht werden. Öffne Creator Studio, um es erneut zu planen.',
      v_caption
    );

    -- Ein Push-Fehler darf das Markieren als 'failed' NIEMALS verhindern, sonst
    -- bliebe der Post in 'pending' hängen und der Cron versuchte es ewig weiter.
    -- Der alte HTTP-Weg war fire-and-forget und damit implizit geschützt; ein
    -- Direktaufruf ist es nicht, deshalb ausdrücklich.
    BEGIN
      PERFORM public.send_push_to_user(
        p_user_id := NEW.author_id,
        p_title   := '⚠️ Post fehlgeschlagen',
        p_body    := v_body,
        p_data    := jsonb_build_object(
          'type',            'scheduled_post_failed',
          'scheduledPostId', NEW.id::text
        ),
        -- Creator Studio ist eine Serlo-Funktion.
        p_app     := 'serlo'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_scheduled_post_failure"() OWNER TO "postgres";

--
-- Name: notify_web_push_on_dm(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_web_push_on_dm"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_id    UUID := NEW.sender_id;
  v_sender_name  TEXT;
  v_body_preview TEXT;
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', TRUE);
  v_project_url      TEXT := current_setting('app.settings.project_url',      TRUE);
BEGIN
  -- Empfänger = der andere Teilnehmer der Conversation. Schema-Annahme:
  -- `conversations` hat `user_a_id` + `user_b_id` (konsistent mit bestehenden
  -- DM-Triggern in notifications_extend.sql).
  SELECT CASE
           WHEN c.user_a_id = v_sender_id THEN c.user_b_id
           ELSE c.user_a_id
         END
    INTO v_recipient_id
    FROM public.conversations c
   WHERE c.id = NEW.conversation_id;

  -- Defensive-Guard: keine Self-Notifications, keine Orphan-Conversations.
  IF v_recipient_id IS NULL OR v_recipient_id = v_sender_id THEN
    RETURN NEW;
  END IF;

  -- Wenn pg_net / settings nicht konfiguriert sind (lokales Dev ohne
  -- Service-Role oder selbst-gehostete Instanz), skip silent. Expo-Push
  -- läuft in der parallelen Trigger-Function weiter.
  IF v_service_role_key IS NULL OR v_project_url IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sender-Username für Notification-Titel
  SELECT COALESCE(username, 'Jemand')
    INTO v_sender_name
    FROM public.profiles
   WHERE id = v_sender_id;

  -- 100 Zeichen reichen für Notification-Body; Browser kürzen eh
  v_body_preview := COALESCE(LEFT(NEW.content, 100), '✉️ Neue Nachricht');

  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body    := jsonb_build_object(
      'user_id', v_recipient_id,
      'title',   '@' || v_sender_name,
      'body',    v_body_preview,
      -- tag setzt Browser-Grouping: neue DM von gleichem Sender ersetzt
      -- die alte Notification → 10 Messages hintereinander machen nicht
      -- 10 Pop-Ups, sondern 1 aktualisiertes.
      'tag',     'dm:' || NEW.conversation_id::text,
      -- Deep-Link direkt in den Thread. `/messages/[id]`-Route matched
      -- bereits existierende Next-Route (siehe apps/web/app/messages/).
      'url',     '/messages/' || NEW.conversation_id::text,
      'data',    jsonb_build_object(
        'type',            'dm',
        'conversationId',  NEW.conversation_id::text,
        'senderId',        v_sender_id::text,
        'senderUsername',  v_sender_name
      )
    )
  );

  RETURN NEW;
EXCEPTION
  -- pg_net kann im Edge-Case (extension nicht geladen) werfen; wir wollen
  -- niemals einen DM-INSERT wegen einer Push-Dispatch-Nebenwirkung scheitern
  -- lassen. Sentry bekommt den Fehler nicht automatisch, aber der Eintrag
  -- landet im Postgres-Log und die Expo-Push-Pipeline läuft unverändert.
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_web_push_on_dm"() OWNER TO "postgres";

--
-- Name: FUNCTION "notify_web_push_on_dm"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."notify_web_push_on_dm"() IS 'Fire-and-forget Web-Push-Dispatch via Edge-Function send-web-push. Additiv zur existierenden Expo-Push-Pipeline in notify_on_dm().';


--
-- Name: pin_live_comment("uuid", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."pin_live_comment"("p_session_id" "uuid", "p_comment" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_host       uuid;
  v_comment_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
     AND status = 'active'
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden oder nicht aktiv'
      USING ERRCODE = '42501';
  END IF;

  IF v_caller <> v_host
     AND NOT public.is_live_session_moderator(p_session_id, v_caller) THEN
    RAISE EXCEPTION 'Nicht Host oder Moderator dieser Session'
      USING ERRCODE = '42501';
  END IF;

  v_comment_id := NULLIF(p_comment->>'id', '')::uuid;

  UPDATE public.live_comments
     SET pinned = false
   WHERE session_id = p_session_id
     AND pinned IS TRUE;

  UPDATE public.live_comments
     SET pinned = true
   WHERE session_id = p_session_id
     AND id = v_comment_id;

  UPDATE public.live_sessions
     SET pinned_comment = jsonb_set(p_comment, '{pinned}', 'true'::jsonb, true)
   WHERE id = p_session_id;
END;
$$;


ALTER FUNCTION "public"."pin_live_comment"("p_session_id" "uuid", "p_comment" "jsonb") OWNER TO "postgres";

--
-- Name: place_live_bid("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."place_live_bid"("p_auction_id" "uuid", "p_amount_cents" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a            public.live_auctions;
  v_uid        uuid := auth.uid();
  v_next_min   int;
  v_new_ends   timestamptz;
  v_extended   boolean;
  c_snipe_window constant interval := interval '10 seconds';
  c_extend       constant interval := interval '10 seconds';
  c_max_cents    constant int := 1000000;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.status <> 'running' THEN
    RAISE EXCEPTION 'auction_not_running' USING ERRCODE = '22023';
  END IF;
  IF a.ends_at IS NULL OR a.ends_at <= now() THEN
    RAISE EXCEPTION 'auction_ended' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;
  IF a.current_bidder_id = v_uid THEN
    RAISE EXCEPTION 'already_leading' USING ERRCODE = '22023';
  END IF;

  v_next_min := CASE
    WHEN a.current_bid_cents IS NULL THEN a.start_price_cents
    ELSE a.current_bid_cents + a.min_increment_cents
  END;

  IF p_amount_cents < v_next_min THEN
    RAISE EXCEPTION 'bid_too_low' USING ERRCODE = '22023',
      DETAIL = format('Mindestens %s Cent', v_next_min);
  END IF;
  IF p_amount_cents > c_max_cents THEN
    RAISE EXCEPTION 'bid_too_high' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (a.id, v_uid, p_amount_cents);

  v_extended := (a.ends_at - now()) < c_snipe_window;
  v_new_ends := CASE WHEN v_extended THEN now() + c_extend ELSE a.ends_at END;

  UPDATE public.live_auctions
     SET current_bid_cents = p_amount_cents,
         current_bidder_id = v_uid,
         bid_count         = a.bid_count + 1,
         ends_at           = v_new_ends
   WHERE id = a.id;

  -- Erst jetzt die Maxima anderer greifen lassen. Die Verlängerung oben zählt
  -- bewusst nur für das Handgebot: ein automatischer Konter im selben Moment
  -- soll die Uhr nicht ein zweites Mal hochsetzen.
  PERFORM public.resolve_auto_bids(a.id);

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'auction_id',        a.id,
    'current_bid_cents', a.current_bid_cents,
    'next_min_cents',    a.current_bid_cents + a.min_increment_cents,
    'ends_at',           a.ends_at,
    'extended',          v_extended,
    'leading',           a.current_bidder_id = v_uid
  );
END $$;


ALTER FUNCTION "public"."place_live_bid"("p_auction_id" "uuid", "p_amount_cents" integer) OWNER TO "postgres";

--
-- Name: FUNCTION "place_live_bid"("p_auction_id" "uuid", "p_amount_cents" integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."place_live_bid"("p_auction_id" "uuid", "p_amount_cents" integer) IS 'Einziger Weg zu einem Gebot. Zeilen-Lock, Mindestschritt, Anti-Snipe, kein Selbstüberbieten.';


--
-- Name: post_drafts_touch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."post_drafts_touch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."post_drafts_touch"() OWNER TO "postgres";

--
-- Name: product_health_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."product_health_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  WITH events AS (
    SELECT author_id AS user_id, created_at, 'post'::TEXT AS event_type FROM public.posts
    UNION ALL SELECT user_id, created_at, 'like' FROM public.likes
    UNION ALL SELECT user_id, created_at, 'comment' FROM public.comments
    UNION ALL SELECT user_id, created_at, 'bookmark' FROM public.bookmarks
    UNION ALL SELECT follower_id AS user_id, created_at, 'follow' FROM public.follows
    UNION ALL SELECT user_id, viewed_at AS created_at, 'view' FROM public.post_views_log
  ),
  posts_7d AS (
    SELECT id, author_id, created_at
    FROM public.posts
    WHERE created_at >= NOW() - INTERVAL '7 days'
  ),
  meaningful_engagement_7d AS (
    SELECT p.author_id AS creator_id, p.id AS post_id
    FROM posts_7d p
    WHERE EXISTS (
      SELECT 1 FROM public.likes l
      WHERE l.post_id = p.id AND l.created_at >= p.created_at
    )
    OR EXISTS (
      SELECT 1 FROM public.comments c
      WHERE c.post_id = p.id AND c.created_at >= p.created_at
    )
    OR EXISTS (
      SELECT 1 FROM public.bookmarks b
      WHERE b.post_id = p.id AND b.created_at >= p.created_at
    )
    OR EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.following_id = p.author_id AND f.created_at >= p.created_at
    )
  ),
  active AS (
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS wau,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS mau
    FROM events
  ),
  signup_cohorts AS (
    SELECT
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '7 days'
      ) AS new_users_7d,
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '30 days'
      ) AS new_users_30d,
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '8 days'
          AND created_at < NOW() - INTERVAL '1 day'
      ) AS d1_cohort,
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days'
      ) AS d7_cohort
    FROM public.profiles
  ),
  retention AS (
    SELECT
      COUNT(DISTINCT p.id) FILTER (
        WHERE p.created_at >= NOW() - INTERVAL '8 days'
          AND p.created_at < NOW() - INTERVAL '1 day'
          AND EXISTS (
            SELECT 1 FROM events e
            WHERE e.user_id = p.id
              AND e.created_at >= p.created_at + INTERVAL '1 day'
              AND e.created_at < p.created_at + INTERVAL '2 days'
          )
      ) AS d1_retained,
      COUNT(DISTINCT p.id) FILTER (
        WHERE p.created_at >= NOW() - INTERVAL '14 days'
          AND p.created_at < NOW() - INTERVAL '7 days'
          AND EXISTS (
            SELECT 1 FROM events e
            WHERE e.user_id = p.id
              AND e.created_at >= p.created_at + INTERVAL '7 days'
              AND e.created_at < p.created_at + INTERVAL '8 days'
          )
      ) AS d7_retained
    FROM public.profiles p
  ),
  activity_7d AS (
    SELECT
      (SELECT COUNT(*) FROM posts_7d) AS posts,
      COUNT(*) FILTER (WHERE event_type = 'like' AND created_at >= NOW() - INTERVAL '7 days') AS likes,
      COUNT(*) FILTER (WHERE event_type = 'comment' AND created_at >= NOW() - INTERVAL '7 days') AS comments,
      COUNT(*) FILTER (WHERE event_type = 'bookmark' AND created_at >= NOW() - INTERVAL '7 days') AS bookmarks,
      COUNT(*) FILTER (WHERE event_type = 'follow' AND created_at >= NOW() - INTERVAL '7 days') AS follows,
      COUNT(*) FILTER (WHERE event_type = 'view' AND created_at >= NOW() - INTERVAL '7 days') AS views,
      0 AS dwell_events
    FROM events
  ),
  creator_activation AS (
    SELECT
      COUNT(DISTINCT author_id) AS active_creators_7d,
      COUNT(DISTINCT author_id) FILTER (
        WHERE id IN (SELECT post_id FROM meaningful_engagement_7d)
      ) AS activated_creators_7d,
      COUNT(*) FILTER (
        WHERE id IN (SELECT post_id FROM meaningful_engagement_7d)
      ) AS posts_with_meaningful_engagement_7d
    FROM posts_7d
  ),
  first_post AS (
    SELECT
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (first_post_at - created_at))
      ) AS median_seconds
    FROM (
      SELECT p.id, p.created_at, MIN(po.created_at) AS first_post_at
      FROM public.profiles p
      JOIN public.posts po ON po.author_id = p.id
      GROUP BY p.id, p.created_at
    ) x
    WHERE first_post_at >= created_at
  ),
  first_meaningful_interaction AS (
    SELECT
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (first_interaction_at - created_at))
      ) AS median_seconds
    FROM (
      SELECT p.id, p.created_at, MIN(e.created_at) AS first_interaction_at
      FROM public.profiles p
      JOIN events e ON e.user_id = p.id AND e.event_type IN ('like', 'comment', 'bookmark', 'follow')
      GROUP BY p.id, p.created_at
    ) x
    WHERE first_interaction_at >= created_at
  )
  SELECT JSONB_BUILD_OBJECT(
    'generated_at', NOW(),
    'north_star', JSONB_BUILD_OBJECT(
      'name', 'weekly_active_creators_with_meaningful_engagement',
      'value', COALESCE(ca.activated_creators_7d, 0),
      'active_creators_7d', COALESCE(ca.active_creators_7d, 0),
      'posts_with_meaningful_engagement_7d', COALESCE(ca.posts_with_meaningful_engagement_7d, 0),
      'activation_rate',
        CASE WHEN COALESCE(ca.active_creators_7d, 0) = 0 THEN 0
        ELSE ROUND((ca.activated_creators_7d::NUMERIC / ca.active_creators_7d::NUMERIC), 4)
        END
    ),
    'audience', JSONB_BUILD_OBJECT(
      'wau', COALESCE(a.wau, 0),
      'mau', COALESCE(a.mau, 0),
      'wau_mau',
        CASE WHEN COALESCE(a.mau, 0) = 0 THEN 0
        ELSE ROUND((a.wau::NUMERIC / a.mau::NUMERIC), 4)
        END,
      'new_users_7d', COALESCE(sc.new_users_7d, 0),
      'new_users_30d', COALESCE(sc.new_users_30d, 0)
    ),
    'retention', JSONB_BUILD_OBJECT(
      'd1_cohort', COALESCE(sc.d1_cohort, 0),
      'd1_retained', COALESCE(r.d1_retained, 0),
      'd1_rate',
        CASE WHEN COALESCE(sc.d1_cohort, 0) = 0 THEN NULL
        ELSE ROUND((r.d1_retained::NUMERIC / sc.d1_cohort::NUMERIC), 4)
        END,
      'd7_cohort', COALESCE(sc.d7_cohort, 0),
      'd7_retained', COALESCE(r.d7_retained, 0),
      'd7_rate',
        CASE WHEN COALESCE(sc.d7_cohort, 0) = 0 THEN NULL
        ELSE ROUND((r.d7_retained::NUMERIC / sc.d7_cohort::NUMERIC), 4)
        END
    ),
    'engagement_7d', JSONB_BUILD_OBJECT(
      'posts', COALESCE(act.posts, 0),
      'views', COALESCE(act.views, 0),
      'dwell_events', COALESCE(act.dwell_events, 0),
      'likes', COALESCE(act.likes, 0),
      'comments', COALESCE(act.comments, 0),
      'bookmarks', COALESCE(act.bookmarks, 0),
      'follows', COALESCE(act.follows, 0),
      'engagement_events', COALESCE(act.likes, 0) + COALESCE(act.comments, 0) + COALESCE(act.bookmarks, 0) + COALESCE(act.follows, 0),
      'engagement_per_view',
        CASE WHEN COALESCE(act.views, 0) = 0 THEN NULL
        ELSE ROUND(((act.likes + act.comments + act.bookmarks + act.follows)::NUMERIC / act.views::NUMERIC), 4)
        END,
      'comment_per_view',
        CASE WHEN COALESCE(act.views, 0) = 0 THEN NULL
        ELSE ROUND((act.comments::NUMERIC / act.views::NUMERIC), 4)
        END
    ),
    'activation_speed', JSONB_BUILD_OBJECT(
      'median_time_to_first_post_seconds', ROUND(COALESCE(fp.median_seconds, 0)::NUMERIC, 0),
      'median_time_to_first_meaningful_interaction_seconds', ROUND(COALESCE(fmi.median_seconds, 0)::NUMERIC, 0)
    )
  )
  INTO v_snapshot
  FROM active a
  CROSS JOIN signup_cohorts sc
  CROSS JOIN retention r
  CROSS JOIN activity_7d act
  CROSS JOIN creator_activation ca
  CROSS JOIN first_post fp
  CROSS JOIN first_meaningful_interaction fmi;

  RETURN v_snapshot;
END;
$$;


ALTER FUNCTION "public"."product_health_snapshot"() OWNER TO "postgres";

--
-- Name: production_integrity_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."production_integrity_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_pending_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_oldest_pending_at TIMESTAMPTZ := NULL;
  v_latest_error TEXT := NULL;
  v_empty_posts_count INTEGER := 0;
  v_media_reference_count INTEGER := 0;
  v_cron_jobs JSONB := '[]'::JSONB;
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'error')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'deleted')::INTEGER,
    MIN(created_at) FILTER (WHERE status = 'pending'),
    (
      ARRAY_AGG(last_error ORDER BY processed_at DESC NULLS LAST, created_at DESC)
        FILTER (WHERE status = 'error' AND last_error IS NOT NULL)
    )[1]
  INTO
    v_total_count,
    v_pending_count,
    v_error_count,
    v_deleted_count,
    v_oldest_pending_at,
    v_latest_error
  FROM public.r2_delete_queue;

  SELECT COUNT(*)::INTEGER
  INTO v_empty_posts_count
  FROM public.posts
  WHERE media_url IS NULL
    AND NULLIF(BTRIM(COALESCE(caption, '')), '') IS NULL;

  SELECT COUNT(*)::INTEGER
  INTO v_media_reference_count
  FROM public.posts
  WHERE media_url IS NOT NULL
     OR thumbnail_url IS NOT NULL;

  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $cron$
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'jobname', jobname,
            'schedule', schedule,
            'active', active
          )
          ORDER BY jobname
        ),
        '[]'::JSONB
      )
      FROM cron.job
      WHERE jobname IN (
        'r2-delete-queue',
        'publish-scheduled-posts',
        'scheduled-lives-cron',
        'scheduled-lives-cron-sql',
        'cleanup-stale-live-sessions',
        'cleanup-stale-lives-sql',
        'ai-image-daily-report',
        'ai-image-retention-weekly'
      )
    $cron$
    INTO v_cron_jobs;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'generated_at', NOW(),
    'r2_delete_queue', JSONB_BUILD_OBJECT(
      'total', COALESCE(v_total_count, 0),
      'pending', COALESCE(v_pending_count, 0),
      'error', COALESCE(v_error_count, 0),
      'deleted', COALESCE(v_deleted_count, 0),
      'oldest_pending_at', v_oldest_pending_at,
      'oldest_pending_age_seconds',
        CASE
          WHEN v_oldest_pending_at IS NULL THEN NULL
          ELSE EXTRACT(EPOCH FROM (NOW() - v_oldest_pending_at))::INTEGER
        END,
      'latest_error', v_latest_error
    ),
    'posts', JSONB_BUILD_OBJECT(
      'empty_content', COALESCE(v_empty_posts_count, 0),
      'media_references', COALESCE(v_media_reference_count, 0)
    ),
    'cron', JSONB_BUILD_OBJECT(
      'available', to_regclass('cron.job') IS NOT NULL,
      'jobs', v_cron_jobs
    )
  );
END;
$_$;


ALTER FUNCTION "public"."production_integrity_snapshot"() OWNER TO "postgres";

--
-- Name: prune_web_push_subscription("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."prune_web_push_subscription"("p_endpoint" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DELETE FROM public.web_push_subscriptions
   WHERE endpoint = p_endpoint;
$$;


ALTER FUNCTION "public"."prune_web_push_subscription"("p_endpoint" "text") OWNER TO "postgres";

--
-- Name: publish_due_scheduled_posts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."publish_due_scheduled_posts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row   public.scheduled_posts%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM public.scheduled_posts
    WHERE status = 'pending'
      AND publish_at <= NOW()
    ORDER BY publish_at
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      INSERT INTO public.posts (
        author_id, caption, media_url, media_type, thumbnail_url, tags,
        is_guild_post, guild_id, audio_url, audio_volume,
        privacy, allow_comments, allow_download, allow_duet, women_only,
        cover_time_ms, aspect_ratio
      ) VALUES (
        v_row.author_id, v_row.caption, v_row.media_url, v_row.media_type,
        v_row.thumbnail_url, v_row.tags,
        v_row.is_guild_post, v_row.guild_id, v_row.audio_url, v_row.audio_volume,
        v_row.privacy, v_row.allow_comments, v_row.allow_download, v_row.allow_duet,
        v_row.women_only, v_row.cover_time_ms,
        COALESCE(v_row.aspect_ratio, 'portrait')
      );

      UPDATE public.scheduled_posts
        SET status = 'published', published_at = NOW()
      WHERE id = v_row.id;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.scheduled_posts
        SET retries = retries + 1,
            status  = CASE WHEN retries + 1 >= 3 THEN 'failed' ELSE 'pending' END,
            last_error = SQLERRM
      WHERE id = v_row.id;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."publish_due_scheduled_posts"() OWNER TO "postgres";

--
-- Name: publish_due_scheduled_posts(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."publish_due_scheduled_posts"("p_batch_size" integer DEFAULT 50) RETURNS TABLE("scheduled_id" "uuid", "post_id" "uuid", "success" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row     public.scheduled_posts%ROWTYPE;
  v_post_id UUID;
BEGIN
  FOR v_row IN
    SELECT *
      FROM public.scheduled_posts
     WHERE status = 'pending' AND publish_at <= NOW()
     ORDER BY publish_at ASC
     LIMIT p_batch_size
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Status flag vor dem Copy, damit bei Crash wiederaufnehmbar
    UPDATE public.scheduled_posts SET status = 'publishing' WHERE id = v_row.id;

    BEGIN
      INSERT INTO public.posts (
        author_id, caption, media_url, media_type, thumbnail_url, tags,
        is_guild_post, guild_id, audio_url, audio_volume,
        privacy, allow_comments, allow_download, allow_duet, women_only,
        cover_time_ms
      ) VALUES (
        v_row.author_id, v_row.caption, v_row.media_url, v_row.media_type,
        v_row.thumbnail_url, v_row.tags,
        v_row.is_guild_post, v_row.guild_id, v_row.audio_url, v_row.audio_volume,
        v_row.privacy, v_row.allow_comments, v_row.allow_download, v_row.allow_duet,
        v_row.women_only, v_row.cover_time_ms
      )
      RETURNING id INTO v_post_id;

      UPDATE public.scheduled_posts
         SET status = 'published', published_post_id = v_post_id, last_error = NULL
       WHERE id = v_row.id;

      scheduled_id := v_row.id;
      post_id := v_post_id;
      success := true;
      error := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      -- Fehler: zurück in pending + Retry-Counter hoch, nach 3x -> failed
      UPDATE public.scheduled_posts
         SET status     = CASE WHEN retries + 1 >= 3 THEN 'failed' ELSE 'pending' END,
             retries    = retries + 1,
             last_error = SQLERRM
       WHERE id = v_row.id;

      scheduled_id := v_row.id;
      post_id := NULL;
      success := false;
      error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."publish_due_scheduled_posts"("p_batch_size" integer) OWNER TO "postgres";

--
-- Name: push_feed_health_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."push_feed_health_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_push_tokens JSONB := jsonb_build_object('available', false);
  v_web_push JSONB := jsonb_build_object('available', false);
  v_notifications JSONB := jsonb_build_object('available', false);
  v_feed JSONB;
  v_triggers JSONB;
BEGIN
  IF to_regclass('public.push_tokens') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT jsonb_build_object(
        'available', true,
        'total', COUNT(*),
        'active_30d', COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days'),
        'stale_90d', COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '90 days'),
        'platforms', COALESCE((
          SELECT jsonb_object_agg(platform, count)
          FROM (
            SELECT COALESCE(platform, 'unknown') AS platform, COUNT(*) AS count
            FROM public.push_tokens
            GROUP BY COALESCE(platform, 'unknown')
            ORDER BY COALESCE(platform, 'unknown')
          ) grouped
        ), '{}'::jsonb)
      )
      FROM public.push_tokens
    $sql$ INTO v_push_tokens;
  END IF;

  IF to_regclass('public.web_push_subscriptions') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT jsonb_build_object(
        'available', true,
        'total', COUNT(*),
        'active_30d', COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days'),
        'active_60d', COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '60 days'),
        'stale_60d', COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '60 days')
      )
      FROM public.web_push_subscriptions
    $sql$ INTO v_web_push;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT jsonb_build_object(
        'available', true,
        'total', COUNT(*),
        'created_24h', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'),
        'created_7d', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),
        'unread_total', COUNT(*) FILTER (WHERE read = false),
        'unread_30d_plus', COUNT(*) FILTER (
          WHERE read = false
            AND created_at < NOW() - INTERVAL '30 days'
        ),
        'unread_60d_plus', COUNT(*) FILTER (
          WHERE read = false
            AND created_at < NOW() - INTERVAL '60 days'
        ),
        'unread_90d_plus', COUNT(*) FILTER (
          WHERE read = false
            AND created_at < NOW() - INTERVAL '90 days'
        ),
        'oldest_unread_age_seconds',
          EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE read = false))),
        'by_type_7d', COALESCE((
          SELECT jsonb_object_agg(type, count)
          FROM (
            SELECT type, COUNT(*) AS count
            FROM public.notifications
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY type
            ORDER BY type
          ) grouped
        ), '{}'::jsonb),
        'by_type_unread', COALESCE((
          SELECT jsonb_object_agg(type, count)
          FROM (
            SELECT type, COUNT(*) AS count
            FROM public.notifications
            WHERE read = false
            GROUP BY type
            ORDER BY type
          ) grouped
        ), '{}'::jsonb),
        'recipient_backlog', COALESCE((
          SELECT jsonb_build_object(
            'users_with_unread', COUNT(*),
            'users_over_50', COUNT(*) FILTER (WHERE unread_count > 50),
            'users_over_100', COUNT(*) FILTER (WHERE unread_count > 100),
            'max_unread_for_one_user', COALESCE(MAX(unread_count), 0),
            'oldest_unread_for_one_user_age_seconds', COALESCE(MAX(oldest_age_seconds), 0)
          )
          FROM (
            SELECT
              recipient_id,
              COUNT(*) AS unread_count,
              EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) AS oldest_age_seconds
            FROM public.notifications
            WHERE read = false
            GROUP BY recipient_id
          ) grouped
        ), jsonb_build_object(
          'users_with_unread', 0,
          'users_over_50', 0,
          'users_over_100', 0,
          'max_unread_for_one_user', 0,
          'oldest_unread_for_one_user_age_seconds', 0
        ))
      )
      FROM public.notifications
    $sql$ INTO v_notifications;
  END IF;

  SELECT jsonb_build_object(
    'public_posts_total', COUNT(*) FILTER (WHERE privacy = 'public'),
    'public_posts_7d', COUNT(*) FILTER (
      WHERE privacy = 'public'
        AND created_at >= v_generated_at - INTERVAL '7 days'
    ),
    'public_media_posts_total', COUNT(*) FILTER (
      WHERE privacy = 'public'
        AND media_url IS NOT NULL
    ),
    'public_video_posts_without_thumbnail', COUNT(*) FILTER (
      WHERE privacy = 'public'
        AND media_type = 'video'
        AND thumbnail_url IS NULL
    ),
    'latest_public_post_age_seconds',
      EXTRACT(EPOCH FROM (v_generated_at - MAX(created_at) FILTER (WHERE privacy = 'public')))
  )
  INTO v_feed
  FROM public.posts;

  SELECT jsonb_build_object(
    'notifications_push_trigger', EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'notifications'
        AND t.tgname = 'trg_push_notification'
        AND NOT t.tgisinternal
    ),
    'messages_web_push_trigger', EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'messages'
        AND t.tgname = 'on_message_insert_web_push'
        AND NOT t.tgisinternal
    ),
    'send_push_notification_function', to_regprocedure('public.fn_send_push_on_notification()') IS NOT NULL,
    'notify_web_push_on_dm_function', to_regprocedure('public.notify_web_push_on_dm()') IS NOT NULL,
    'pg_net_available', to_regnamespace('net') IS NOT NULL
  )
  INTO v_triggers;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'push', jsonb_build_object(
      'native_tokens', v_push_tokens,
      'web_subscriptions', v_web_push,
      'notifications', v_notifications,
      'triggers', v_triggers
    ),
    'feed', v_feed
  );
END;
$_$;


ALTER FUNCTION "public"."push_feed_health_snapshot"() OWNER TO "postgres";

--
-- Name: record_share_learn("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."record_share_learn"("p_post_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;
  IF p_post_id IS NULL THEN RETURN; END IF;

  -- Share = sehr starkes positives Signal (alpha 0.10, gleichwertig mit Kommentieren)
  PERFORM public._learn_from_post(v_user_id, p_post_id, 0.10);
END;
$$;


ALTER FUNCTION "public"."record_share_learn"("p_post_id" "uuid") OWNER TO "postgres";

--
-- Name: record_skip("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."record_skip"("p_post_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."record_skip"("p_post_id" "uuid") OWNER TO "postgres";

--
-- Name: refresh_admin_region_metrics_from_profiles("date"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."refresh_admin_region_metrics_from_profiles"("p_metric_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_upserted BIGINT := 0;
BEGIN
  IF NOT (public.can_operate() OR auth.role() = 'service_role') THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  -- This source is a current profile snapshot, not a historical daily import.
  -- Keep only the latest generated row per country to avoid summing the same
  -- total profile/post counts repeatedly across the 30-day dashboard window.
  DELETE FROM public.admin_region_daily_metrics
  WHERE source = 'voluntary_profiles';

  WITH grouped AS (
    SELECT
      UPPER(p.country_code) AS country_code,
      MAX(p.country_name) AS country_name,
      COUNT(DISTINCT p.id)::BIGINT AS total_profiles,
      COUNT(DISTINCT p.id) FILTER (
        WHERE p.created_at >= p_metric_date::TIMESTAMPTZ
          AND p.created_at < (p_metric_date + 1)::TIMESTAMPTZ
      )::BIGINT AS new_registrations,
      COUNT(DISTINCT p.id) FILTER (WHERE post_counts.post_count > 0)::BIGINT AS active_users,
      COALESCE(SUM(post_counts.post_count), 0)::BIGINT AS posts
    FROM public.profiles p
    LEFT JOIN (
      SELECT
        author_id,
        COUNT(*)::BIGINT AS post_count
      FROM public.posts
      GROUP BY author_id
    ) post_counts ON post_counts.author_id = p.id
    WHERE p.country_code IS NOT NULL
      AND trim(p.country_code) <> ''
      AND p.location_consent_at IS NOT NULL
    GROUP BY UPPER(p.country_code)
  ),
  inserted AS (
    INSERT INTO public.admin_region_daily_metrics (
      country_code,
      country_name,
      metric_date,
      total_profiles,
      active_users,
      new_registrations,
      posts,
      views,
      reports,
      source
    )
    SELECT
      country_code,
      COALESCE(NULLIF(country_name, ''), country_code),
      p_metric_date,
      total_profiles,
      active_users,
      new_registrations,
      posts,
      0,
      0,
      'voluntary_profiles'
    FROM grouped
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_upserted FROM inserted;

  RETURN jsonb_build_object(
    'ok', true,
    'metric_date', p_metric_date,
    'source', 'voluntary_profiles',
    'countries_upserted', COALESCE(v_upserted, 0)
  );
END;
$$;


ALTER FUNCTION "public"."refresh_admin_region_metrics_from_profiles"("p_metric_date" "date") OWNER TO "postgres";

--
-- Name: refresh_user_tag_affinity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."refresh_user_tag_affinity"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."refresh_user_tag_affinity"() OWNER TO "postgres";

--
-- Name: reject_women_only("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reject_women_only"("p_user" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  UPDATE women_only_requests
     SET status = 'rejected', reviewed_at = now(), reviewed_by = v_uid, note = p_note
   WHERE user_id = p_user;

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES (v_uid, 'woz_reject', 'profile', p_user,
               jsonb_build_object('note', p_note));

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."reject_women_only"("p_user" "uuid", "p_note" "text") OWNER TO "postgres";

--
-- Name: remind_due_auction_carts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."remind_due_auction_carts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  c       record;
  v_cents bigint;
  v_items int;
  v_hours int;
  v_sent  int := 0;
BEGIN
  FOR c IN
    SELECT id, buyer_id, seller_id, closes_at
      FROM public.auction_carts
     -- Beides sind unbezahlte Zustände mit Ware. 'checkout_pending' heißt: Der
     -- Käufer hat „Bezahlen" gedrückt und es nicht zu Ende gebracht — genau der,
     -- den man erinnern will.
     WHERE status IN ('open', 'checkout_pending')
       AND reminded_at IS NULL
       -- Nicht mehr erinnern, wenn das Fenster ohnehin schon zu ist.
       AND closes_at > now()
       AND closes_at <= now() + interval '4 hours'
     ORDER BY closes_at
     -- Zwei überlappende Läufe dürfen denselben Korb nicht doppelt anfassen.
     FOR UPDATE SKIP LOCKED
  LOOP
    SELECT COALESCE(SUM(current_bid_cents), 0), COUNT(*)
      INTO v_cents, v_items
      FROM public.live_auctions
     WHERE cart_id = c.id AND status = 'sold';

    -- Leerer Korb: nichts zu bezahlen, also nichts zu erinnern. Trotzdem
    -- markieren, damit ihn nicht jeder weitere Lauf erneut aufgreift.
    IF v_items = 0 OR v_cents <= 0 THEN
      UPDATE public.auction_carts SET reminded_at = now() WHERE id = c.id;
      CONTINUE;
    END IF;

    v_hours := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (c.closes_at - now())) / 3600)::int);

    INSERT INTO public.notifications
      (recipient_id, sender_id, type, comment_text, app)
    VALUES (
      c.buyer_id,
      c.seller_id,
      'order_payment_reminder',
      -- Cent-Arithmetik in Integer, kein Fließkomma.
      format('%s Artikel · %s,%s € — noch %s h',
             v_items, v_cents / 100, lpad((v_cents % 100)::text, 2, '0'), v_hours),
      'berkat'
    );

    UPDATE public.auction_carts SET reminded_at = now() WHERE id = c.id;
    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$$;


ALTER FUNCTION "public"."remind_due_auction_carts"() OWNER TO "postgres";

--
-- Name: report_order_dispute("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."report_order_dispute"("p_order_id" "uuid", "p_reason" "text", "p_detail" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_order   public.product_orders%rowtype;
  v_role    text;
  v_against uuid;
  v_detail  text := nullif(btrim(p_detail), '');
  r_admin   record;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF p_reason NOT IN ('not_received','damaged','not_as_described','not_paid','fraud','other') THEN
    RETURN jsonb_build_object('error','invalid_reason');
  END IF;
  IF v_detail IS NOT NULL AND length(v_detail) > 2000 THEN v_detail := left(v_detail, 2000); END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_caller = v_order.buyer_id THEN v_role := 'buyer'; v_against := v_order.seller_id;
  ELSIF v_caller = v_order.seller_id THEN v_role := 'seller'; v_against := v_order.buyer_id;
  ELSE RETURN jsonb_build_object('error','not_authorized'); END IF;

  -- Erst ab Zahlung sinnvoll (vorher gibt's „Doch nicht"/Stornieren).
  IF v_order.status NOT IN ('paid','shipped','delivered') THEN
    RETURN jsonb_build_object('error','not_reportable');
  END IF;

  INSERT INTO public.order_disputes (order_id, reporter_id, against_id, reporter_role, reason, detail)
  VALUES (p_order_id, v_caller, v_against, v_role, p_reason, v_detail)
  ON CONFLICT (order_id, reporter_id) DO UPDATE
    SET reason = excluded.reason, detail = excluded.detail, status = 'open', resolved_at = NULL;

  -- Gegenseite informieren.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    VALUES (v_against, v_caller, 'order_dispute', 'Ein Problem mit einer Bestellung wurde gemeldet ⚠️');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Admins informieren (außer wenn schon als Gegenseite/Melder benachrichtigt).
  FOR r_admin IN SELECT id FROM public.profiles WHERE is_admin = true LOOP
    IF r_admin.id <> v_caller AND r_admin.id <> v_against THEN
      BEGIN
        INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
        VALUES (r_admin.id, v_caller, 'order_dispute', 'Neue Streit-Meldung zu einer Bestellung ⚠️');
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END $$;


ALTER FUNCTION "public"."report_order_dispute"("p_order_id" "uuid", "p_reason" "text", "p_detail" "text") OWNER TO "postgres";

--
-- Name: request_women_only(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."request_women_only"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT status INTO v_existing FROM women_only_requests WHERE user_id = v_uid;
  IF v_existing = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'status', 'approved');
  END IF;

  -- Selbstdeklaration: Geschlecht + Level 1 (Antrag gestellt), ABER KEIN Zugang.
  -- women_only_verified bleibt false bis zur Admin-Freigabe.
  UPDATE profiles
     SET gender = 'female', verification_level = 1
   WHERE id = v_uid;

  INSERT INTO women_only_requests (user_id, status, method, requested_at)
       VALUES (v_uid, 'pending', 'self', now())
  ON CONFLICT (user_id) DO UPDATE
       SET status = 'pending', method = 'self', requested_at = now(),
           reviewed_at = NULL, reviewed_by = NULL, note = NULL;

  RETURN jsonb_build_object('success', true, 'status', 'pending');
END;
$$;


ALTER FUNCTION "public"."request_women_only"() OWNER TO "postgres";

--
-- Name: reschedule_live("uuid", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reschedule_live"("p_id" "uuid", "p_new_time" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_new_time <= NOW() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'scheduled_at muss mind. 5 Minuten in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_new_time > NOW() + INTERVAL '30 days' THEN
    RAISE EXCEPTION 'scheduled_at darf max. 30 Tage in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;

  -- Beim Umplanen zurücksetzen auf 'scheduled' → Reminder geht erneut raus
  UPDATE public.scheduled_lives
     SET scheduled_at = p_new_time,
         status       = 'scheduled',
         reminded_at  = NULL
   WHERE id = p_id
     AND host_id = v_caller
     AND status IN ('scheduled','reminded');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Live nicht gefunden oder nicht mehr umplanbar'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


ALTER FUNCTION "public"."reschedule_live"("p_id" "uuid", "p_new_time" timestamp with time zone) OWNER TO "postgres";

--
-- Name: reschedule_post("uuid", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reschedule_post"("p_id" "uuid", "p_new_time" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_new_time <= NOW() + INTERVAL '1 minute' THEN
    RAISE EXCEPTION 'publish_at muss mind. 1 Minute in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.scheduled_posts
     SET publish_at = p_new_time
   WHERE id = p_id AND author_id = v_caller AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Post nicht gefunden oder bereits veröffentlicht/abgebrochen'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


ALTER FUNCTION "public"."reschedule_post"("p_id" "uuid", "p_new_time" timestamp with time zone) OWNER TO "postgres";

--
-- Name: reschedule_preorder_round("uuid", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reschedule_preorder_round"("p_round_id" "uuid", "p_closes_at" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_round public.preorder_rounds%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_closes_at IS NULL OR p_closes_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_date');
  END IF;

  SELECT * INTO v_round FROM preorder_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'round_not_found');
  END IF;
  IF v_round.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'round_not_open');
  END IF;
  IF v_round.seller_id <> v_uid AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_seller');
  END IF;

  UPDATE preorder_rounds
    SET closes_at = p_closes_at
    WHERE id = p_round_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."reschedule_preorder_round"("p_round_id" "uuid", "p_closes_at" timestamp with time zone) OWNER TO "postgres";

--
-- Name: resolve_auto_bids("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."resolve_auto_bids"("p_auction_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a          public.live_auctions;
  r          record;
  v_win_id   uuid;
  v_win_max  int;
  v_run_max  int;
  v_price    int;
  v_rank     int := 0;
BEGIN
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id;
  IF NOT FOUND OR a.status <> 'running' THEN RETURN; END IF;

  -- Zwei Beste ermitteln. Der aktuell Führende zählt mit seinem abgegebenen
  -- Gebot mit, falls er kein (höheres) Maximum hinterlegt hat.
  FOR r IN
    SELECT bidder_id, MAX(m) AS m, MIN(t) AS t
      FROM (
        SELECT ab.bidder_id, ab.max_cents AS m, ab.created_at AS t
          FROM public.live_auto_bids ab
         WHERE ab.auction_id = p_auction_id
        UNION ALL
        SELECT a.current_bidder_id, a.current_bid_cents, '-infinity'::timestamptz
         WHERE a.current_bidder_id IS NOT NULL AND a.current_bid_cents IS NOT NULL
      ) AS entries
     GROUP BY bidder_id
     ORDER BY 2 DESC, 3 ASC
     LIMIT 2
  LOOP
    v_rank := v_rank + 1;
    IF v_rank = 1 THEN
      v_win_id  := r.bidder_id;
      v_win_max := r.m;
    ELSE
      v_run_max := r.m;
    END IF;
  END LOOP;

  IF v_win_id IS NULL THEN RETURN; END IF;

  -- Preis: gerade so viel, dass der Zweitbeste überboten ist — nie mehr.
  v_price := CASE
    WHEN v_run_max IS NULL THEN GREATEST(COALESCE(a.current_bid_cents, 0), a.start_price_cents)
    ELSE LEAST(v_win_max, v_run_max + a.min_increment_cents)
  END;
  v_price := GREATEST(v_price, a.start_price_cents);

  -- Nichts zu tun, wenn derselbe schon zu diesem Preis führt.
  IF a.current_bidder_id = v_win_id AND a.current_bid_cents = v_price THEN RETURN; END IF;
  IF v_price > v_win_max THEN RETURN; END IF;

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (p_auction_id, v_win_id, v_price)
  ON CONFLICT (auction_id, amount_cents) DO NOTHING;

  UPDATE public.live_auctions
     SET current_bid_cents = v_price,
         current_bidder_id = v_win_id,
         bid_count         = bid_count + 1
   WHERE id = p_auction_id;
END $$;


ALTER FUNCTION "public"."resolve_auto_bids"("p_auction_id" "uuid") OWNER TO "postgres";

--
-- Name: resolve_order_dispute("uuid", "text", boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."resolve_order_dispute"("p_dispute_id" "uuid", "p_resolution" "text" DEFAULT NULL::"text", "p_dismiss" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_dispute public.order_disputes%rowtype;
  v_res     text := nullif(btrim(p_resolution), '');
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF NOT COALESCE(public.is_admin(), false) THEN RETURN jsonb_build_object('error','not_authorized'); END IF;

  SELECT * INTO v_dispute FROM public.order_disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','dispute_not_found'); END IF;

  UPDATE public.order_disputes
     SET status = CASE WHEN p_dismiss THEN 'dismissed' ELSE 'resolved' END,
         resolution = v_res,
         resolved_at = now()
   WHERE id = p_dispute_id;

  -- Beide Parteien informieren.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    VALUES
      (v_dispute.reporter_id, v_caller, 'order_dispute', 'Deine Streit-Meldung wurde geklärt ✓'),
      (v_dispute.against_id,  v_caller, 'order_dispute', 'Eine Streit-Meldung zu deiner Bestellung wurde geklärt ✓');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END $$;


ALTER FUNCTION "public"."resolve_order_dispute"("p_dispute_id" "uuid", "p_resolution" "text", "p_dismiss" boolean) OWNER TO "postgres";

--
-- Name: respond_duet_invite("uuid", boolean, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."respond_duet_invite"("p_invite_id" "uuid", "p_accept" boolean, "p_reason" "text" DEFAULT NULL::"text") RETURNS TABLE("status" "text", "session_id" "uuid", "host_id" "uuid", "guest_id" "uuid", "layout" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_invite     public.live_duet_invites%ROWTYPE;
  v_slot       INT;
  v_active_cnt INT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- ── Row-Lock: verhindert Race bei parallelen Accept/Decline ─────────
  SELECT * INTO v_invite
    FROM public.live_duet_invites
   WHERE id = p_invite_id
   FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  -- ── Autorisierung: Nur der Adressat darf antworten ──────────────────
  --   host-to-viewer → invitee_id beantwortet
  --   viewer-to-host → host_id beantwortet
  IF v_invite.direction = 'host-to-viewer' AND v_caller <> v_invite.invitee_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;
  IF v_invite.direction = 'viewer-to-host' AND v_caller <> v_invite.host_id THEN
    RAISE EXCEPTION 'Nicht autorisiert' USING ERRCODE = '42501';
  END IF;

  -- ── Idempotenz: wenn bereits abgeschlossen, passendes Ergebnis zurück ─
  IF v_invite.status = 'accepted' THEN
    IF p_accept THEN
      -- Retry desselben Calls → gleiches Tupel, no-op.
      RETURN QUERY SELECT 'accepted'::TEXT, v_invite.session_id, v_invite.host_id,
                          v_invite.invitee_id, v_invite.layout;
      RETURN;
    ELSE
      -- Accept ist durch, Decline kann nicht mehr nachgereicht werden.
      RAISE EXCEPTION 'Invite wurde bereits akzeptiert' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_invite.status = 'declined' THEN
    IF NOT p_accept THEN
      RETURN QUERY SELECT 'declined'::TEXT, v_invite.session_id, v_invite.host_id,
                          v_invite.invitee_id, v_invite.layout;
      RETURN;
    ELSE
      RAISE EXCEPTION 'Invite wurde bereits abgelehnt' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_invite.status IN ('expired', 'cancelled') THEN
    RAISE EXCEPTION 'Invite nicht mehr offen (Status: %)', v_invite.status
      USING ERRCODE = '22023';
  END IF;

  -- Ab hier: Status ist 'pending' und Row ist gelockt.

  IF v_invite.expires_at <= NOW() THEN
    UPDATE public.live_duet_invites
       SET status = 'expired', responded_at = NOW()
     WHERE id = p_invite_id;
    RAISE EXCEPTION 'Invite ist abgelaufen' USING ERRCODE = '22023';
  END IF;

  IF p_accept THEN
    -- Kapazitäts-Check (max 8 aktive Co-Hosts)
    SELECT COUNT(*) INTO v_active_cnt
      FROM public.live_cohosts
     WHERE session_id = v_invite.session_id
       AND revoked_at IS NULL;

    IF v_active_cnt >= 8 AND NOT EXISTS (
      SELECT 1 FROM public.live_cohosts
       WHERE session_id = v_invite.session_id
         AND user_id    = v_invite.invitee_id
         AND revoked_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Max. 8 Co-Hosts pro Session erreicht'
        USING ERRCODE = '22023', HINT = 'capacity';
    END IF;

    -- Kleinster freier slot_index (0..7)
    SELECT s.idx INTO v_slot
      FROM generate_series(0, 7) AS s(idx)
      LEFT JOIN public.live_cohosts lc
        ON lc.session_id = v_invite.session_id
       AND lc.slot_index = s.idx
       AND lc.revoked_at IS NULL
     WHERE lc.user_id IS NULL OR lc.user_id = v_invite.invitee_id
     ORDER BY s.idx
     LIMIT 1;

    IF v_slot IS NULL THEN v_slot := 0; END IF;

    INSERT INTO public.live_cohosts (session_id, user_id, invited_by, slot_index)
    VALUES (v_invite.session_id, v_invite.invitee_id, v_invite.host_id, v_slot)
    ON CONFLICT (session_id, user_id) DO UPDATE
      SET invited_by  = EXCLUDED.invited_by,
          approved_at = NOW(),
          revoked_at  = NULL,
          slot_index  = EXCLUDED.slot_index;

    UPDATE public.live_duet_invites
       SET status = 'accepted', responded_at = NOW()
     WHERE id = p_invite_id;

    -- History-Row eröffnen
    INSERT INTO public.live_duet_history (
      session_id, host_id, guest_id, initiated_by, layout
    ) VALUES (
      v_invite.session_id,
      v_invite.host_id,
      v_invite.invitee_id,
      CASE WHEN v_invite.direction = 'host-to-viewer' THEN 'host' ELSE 'guest' END,
      v_invite.layout
    );

    RETURN QUERY SELECT 'accepted'::TEXT, v_invite.session_id, v_invite.host_id,
                        v_invite.invitee_id, v_invite.layout;
  ELSE
    UPDATE public.live_duet_invites
       SET status = 'declined', responded_at = NOW(), decline_reason = p_reason
     WHERE id = p_invite_id;
    RETURN QUERY SELECT 'declined'::TEXT, v_invite.session_id, v_invite.host_id,
                        v_invite.invitee_id, v_invite.layout;
  END IF;
END;
$$;


ALTER FUNCTION "public"."respond_duet_invite"("p_invite_id" "uuid", "p_accept" boolean, "p_reason" "text") OWNER TO "postgres";

--
-- Name: revoke_cohost("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."revoke_cohost"("p_session_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_host uuid := auth.uid();
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
     WHERE id = p_session_id
       AND host_id = v_host
  ) THEN
    RAISE EXCEPTION 'Nicht Host dieser Session'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_cohosts
     SET revoked_at = now()
   WHERE session_id = p_session_id
     AND user_id    = p_user_id
     AND revoked_at IS NULL;
END;
$$;


ALTER FUNCTION "public"."revoke_cohost"("p_session_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: revoke_moderator("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."revoke_moderator"("p_session_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_host UUID;
BEGIN
  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_host <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden_not_host' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.live_moderators
   WHERE session_id = p_session_id AND user_id = p_user_id;
END $$;


ALTER FUNCTION "public"."revoke_moderator"("p_session_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: revoke_women_only("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."revoke_women_only"("p_user" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  PERFORM set_config('app.woz_bypass', 'on', true);
  UPDATE profiles
     SET women_only_verified = false, verification_level = 0
   WHERE id = p_user;

  UPDATE women_only_requests
     SET status = 'revoked', reviewed_at = now(), reviewed_by = v_uid, note = p_note
   WHERE user_id = p_user;

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES (v_uid, 'woz_revoke', 'profile', p_user,
               jsonb_build_object('note', p_note));

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."revoke_women_only"("p_user" "uuid", "p_note" "text") OWNER TO "postgres";

--
-- Name: schedule_live(timestamp with time zone, "text", "text", boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."schedule_live"("p_scheduled_at" timestamp with time zone, "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_allow_comments" boolean DEFAULT true, "p_allow_gifts" boolean DEFAULT true, "p_women_only" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF char_length(trim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Titel ist erforderlich' USING ERRCODE = '22023';
  END IF;
  IF p_scheduled_at <= NOW() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'scheduled_at muss mind. 5 Minuten in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_scheduled_at > NOW() + INTERVAL '30 days' THEN
    RAISE EXCEPTION 'scheduled_at darf max. 30 Tage in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.scheduled_lives (
    host_id, title, description, scheduled_at,
    allow_comments, allow_gifts, women_only
  ) VALUES (
    v_caller, trim(p_title), NULLIF(trim(p_description), ''), p_scheduled_at,
    p_allow_comments, p_allow_gifts, p_women_only
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."schedule_live"("p_scheduled_at" timestamp with time zone, "p_title" "text", "p_description" "text", "p_allow_comments" boolean, "p_allow_gifts" boolean, "p_women_only" boolean) OWNER TO "postgres";

--
-- Name: schedule_post(timestamp with time zone, "text", "text", "text", "text", "text"[], boolean, "uuid", "text", numeric, "text", boolean, boolean, boolean, boolean, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."schedule_post"("p_publish_at" timestamp with time zone, "p_caption" "text" DEFAULT NULL::"text", "p_media_url" "text" DEFAULT NULL::"text", "p_media_type" "text" DEFAULT NULL::"text", "p_thumbnail_url" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_is_guild_post" boolean DEFAULT false, "p_guild_id" "uuid" DEFAULT NULL::"uuid", "p_audio_url" "text" DEFAULT NULL::"text", "p_audio_volume" numeric DEFAULT NULL::numeric, "p_privacy" "text" DEFAULT 'public'::"text", "p_allow_comments" boolean DEFAULT true, "p_allow_download" boolean DEFAULT false, "p_allow_duet" boolean DEFAULT true, "p_women_only" boolean DEFAULT false, "p_cover_time_ms" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_publish_at <= NOW() + INTERVAL '1 minute' THEN
    RAISE EXCEPTION 'publish_at muss mind. 1 Minute in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_publish_at > NOW() + INTERVAL '60 days' THEN
    RAISE EXCEPTION 'publish_at darf max. 60 Tage in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_media_url IS NULL AND (p_caption IS NULL OR char_length(trim(p_caption)) = 0) THEN
    RAISE EXCEPTION 'Entweder Media oder Caption erforderlich' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.scheduled_posts (
    author_id, caption, media_url, media_type, thumbnail_url, tags,
    is_guild_post, guild_id, audio_url, audio_volume,
    privacy, allow_comments, allow_download, allow_duet, women_only,
    cover_time_ms, publish_at
  ) VALUES (
    v_caller, NULLIF(trim(p_caption), ''), p_media_url, p_media_type, p_thumbnail_url, p_tags,
    p_is_guild_post, p_guild_id, p_audio_url, p_audio_volume,
    p_privacy, p_allow_comments, p_allow_download, p_allow_duet, p_women_only,
    p_cover_time_ms, p_publish_at
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."schedule_post"("p_publish_at" timestamp with time zone, "p_caption" "text", "p_media_url" "text", "p_media_type" "text", "p_thumbnail_url" "text", "p_tags" "text"[], "p_is_guild_post" boolean, "p_guild_id" "uuid", "p_audio_url" "text", "p_audio_volume" numeric, "p_privacy" "text", "p_allow_comments" boolean, "p_allow_download" boolean, "p_allow_duet" boolean, "p_women_only" boolean, "p_cover_time_ms" integer) OWNER TO "postgres";

--
-- Name: schedule_post(timestamp with time zone, "text", "text", "text", "text", "text"[], boolean, "uuid", "text", numeric, "text", boolean, boolean, boolean, boolean, integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."schedule_post"("p_publish_at" timestamp with time zone, "p_caption" "text" DEFAULT NULL::"text", "p_media_url" "text" DEFAULT NULL::"text", "p_media_type" "text" DEFAULT NULL::"text", "p_thumbnail_url" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_is_guild_post" boolean DEFAULT false, "p_guild_id" "uuid" DEFAULT NULL::"uuid", "p_audio_url" "text" DEFAULT NULL::"text", "p_audio_volume" numeric DEFAULT NULL::numeric, "p_privacy" "text" DEFAULT 'public'::"text", "p_allow_comments" boolean DEFAULT true, "p_allow_download" boolean DEFAULT false, "p_allow_duet" boolean DEFAULT true, "p_women_only" boolean DEFAULT false, "p_cover_time_ms" integer DEFAULT NULL::integer, "p_aspect_ratio" "text" DEFAULT 'portrait'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_publish_at <= NOW() + INTERVAL '1 minute' THEN
    RAISE EXCEPTION 'publish_at muss mind. 1 Minute in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_publish_at > NOW() + INTERVAL '60 days' THEN
    RAISE EXCEPTION 'publish_at darf max. 60 Tage in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_media_url IS NULL AND (p_caption IS NULL OR char_length(trim(p_caption)) = 0) THEN
    RAISE EXCEPTION 'Entweder Media oder Caption erforderlich' USING ERRCODE = '22023';
  END IF;
  IF p_aspect_ratio NOT IN ('portrait', 'landscape', 'square') THEN
    p_aspect_ratio := 'portrait';
  END IF;

  INSERT INTO public.scheduled_posts (
    author_id, caption, media_url, media_type, thumbnail_url, tags,
    is_guild_post, guild_id, audio_url, audio_volume,
    privacy, allow_comments, allow_download, allow_duet, women_only,
    cover_time_ms, publish_at, aspect_ratio
  ) VALUES (
    v_caller, NULLIF(trim(p_caption), ''), p_media_url, p_media_type, p_thumbnail_url, p_tags,
    p_is_guild_post, p_guild_id, p_audio_url, p_audio_volume,
    p_privacy, p_allow_comments, p_allow_download, p_allow_duet, p_women_only,
    p_cover_time_ms, p_publish_at, p_aspect_ratio
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."schedule_post"("p_publish_at" timestamp with time zone, "p_caption" "text", "p_media_url" "text", "p_media_type" "text", "p_thumbnail_url" "text", "p_tags" "text"[], "p_is_guild_post" boolean, "p_guild_id" "uuid", "p_audio_url" "text", "p_audio_volume" numeric, "p_privacy" "text", "p_allow_comments" boolean, "p_allow_download" boolean, "p_allow_duet" boolean, "p_women_only" boolean, "p_cover_time_ms" integer, "p_aspect_ratio" "text") OWNER TO "postgres";

--
-- Name: scheduled_lives_touch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."scheduled_lives_touch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."scheduled_lives_touch"() OWNER TO "postgres";

--
-- Name: scheduled_posts_touch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."scheduled_posts_touch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."scheduled_posts_touch"() OWNER TO "postgres";

--
-- Name: search_public_profiles_web("text", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."search_public_profiles_web"("search_query" "text", "result_limit" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "verified" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH input AS (
    SELECT NULLIF(regexp_replace(trim(COALESCE(search_query, '')), '[%_]', '', 'g'), '') AS q
  )
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_verified, false) AS verified
  FROM public.profiles p
  CROSS JOIN input i
  WHERE i.q IS NOT NULL
    AND length(i.q) >= 2
    AND p.username IS NOT NULL
    AND COALESCE(p.is_private, false) = false
    AND COALESCE(p.is_banned, false) = false
    AND COALESCE(p.is_shadow_banned, false) = false
    AND (
      p.username ILIKE '%' || i.q || '%'
      OR COALESCE(p.display_name, '') ILIKE '%' || i.q || '%'
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(result_limit, 5), 20));
$$;


ALTER FUNCTION "public"."search_public_profiles_web"("search_query" "text", "result_limit" integer) OWNER TO "postgres";

--
-- Name: send_creator_tip("uuid", integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."send_creator_tip"("p_recipient_id" "uuid", "p_coin_amount" integer, "p_message" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_sender_id    uuid := auth.uid();
  v_sender_coins integer;
  v_diamonds     integer;
  v_tip_id       uuid;
begin
  if v_sender_id is null then
    raise exception 'unauthenticated';
  end if;
  if v_sender_id = p_recipient_id then
    raise exception 'cannot_tip_self';
  end if;
  if p_coin_amount is null or p_coin_amount < 1 or p_coin_amount > 100000 then
    raise exception 'invalid_amount';
  end if;
  if p_message is not null and char_length(p_message) > 140 then
    raise exception 'message_too_long';
  end if;

  -- Balance-Check (Row-Lock damit kein race)
  select coins into v_sender_coins from coins_wallets
    where user_id = v_sender_id for update;
  if v_sender_coins is null or v_sender_coins < p_coin_amount then
    raise exception 'insufficient_coins';
  end if;

  -- Diamonds-Conversion: 85% vom Coin-Amount (gleiche Ratio wie send_gift)
  v_diamonds := floor(p_coin_amount * 0.85)::integer;

  -- Atomic Buchung
  update coins_wallets
    set coins = coins - p_coin_amount,
        total_gifted = total_gifted + p_coin_amount,
        updated_at = now()
    where user_id = v_sender_id;

  insert into coins_wallets (user_id, coins, diamonds, updated_at)
    values (p_recipient_id, 0, v_diamonds, now())
    on conflict (user_id) do update
      set diamonds = coins_wallets.diamonds + excluded.diamonds,
          updated_at = now();

  insert into creator_tips (sender_id, recipient_id, coin_amount, message)
    values (v_sender_id, p_recipient_id, p_coin_amount, p_message)
    returning id into v_tip_id;

  return v_tip_id;
end $$;


ALTER FUNCTION "public"."send_creator_tip"("p_recipient_id" "uuid", "p_coin_amount" integer, "p_message" "text") OWNER TO "postgres";

--
-- Name: send_expo_push("text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."send_expo_push"("token" "text", "title" "text", "body" "text", "data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF token IS NULL OR token = '' THEN RETURN; END IF;
  IF token NOT LIKE 'ExponentPushToken[%]' AND token NOT LIKE 'ExpoPushToken[%]' THEN RETURN; END IF;

  PERFORM net.http_post(
    url     := ('https://exp.host/--/api/v2/push/send')::text,
    body    := jsonb_build_object('to', token, 'title', title, 'body', body, 'sound', 'default', 'data', data),
    headers := ('{"Content-Type": "application/json", "Accept": "application/json"}')::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."send_expo_push"("token" "text", "title" "text", "body" "text", "data" "jsonb") OWNER TO "postgres";

--
-- Name: send_gift("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."send_gift"("p_recipient_id" "uuid", "p_live_session_id" "text", "p_gift_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_sender_id     uuid := auth.uid();
  v_gift          gift_catalog%rowtype;
  v_sender_coins  integer;
  v_gifts_allowed boolean;
BEGIN
  -- Gift laden
  SELECT * INTO v_gift FROM gift_catalog WHERE id = p_gift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'gift_not_found');
  END IF;

  -- allow_gifts prüfen: Host kann Geschenke deaktivieren
  SELECT COALESCE(allow_gifts, true)
    INTO v_gifts_allowed
    FROM live_sessions
   WHERE id = p_live_session_id::uuid;

  IF NOT v_gifts_allowed THEN
    RETURN jsonb_build_object('error', 'gifts_disabled');
  END IF;

  -- Sender kann nicht an sich selbst verschenken
  IF v_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('error', 'cannot_gift_yourself');
  END IF;

  -- Sender Wallet (mit Lock)
  SELECT coins INTO v_sender_coins
    FROM coins_wallets
   WHERE user_id = v_sender_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_wallet');
  END IF;

  IF v_sender_coins < v_gift.coin_cost THEN
    RETURN jsonb_build_object('error', 'insufficient_coins', 'balance', v_sender_coins);
  END IF;

  -- Coins vom Sender abziehen
  UPDATE coins_wallets
     SET coins        = coins        - v_gift.coin_cost,
         total_gifted = total_gifted + v_gift.coin_cost,
         updated_at   = now()
   WHERE user_id = v_sender_id;

  -- Diamonds an Creator gutschreiben
  INSERT INTO coins_wallets (user_id, diamonds, updated_at)
  VALUES (p_recipient_id, v_gift.diamond_value, now())
  ON CONFLICT (user_id) DO UPDATE
    SET diamonds   = coins_wallets.diamonds + v_gift.diamond_value,
        updated_at = now();

  -- Transaktion speichern
  INSERT INTO gift_transactions
    (sender_id, recipient_id, live_session_id, gift_id, coin_cost, diamond_value)
  VALUES
    (v_sender_id, p_recipient_id, p_live_session_id, p_gift_id, v_gift.coin_cost, v_gift.diamond_value);

  RETURN jsonb_build_object('success', true, 'new_balance', v_sender_coins - v_gift.coin_cost);
END;
$$;


ALTER FUNCTION "public"."send_gift"("p_recipient_id" "uuid", "p_live_session_id" "text", "p_gift_id" "text") OWNER TO "postgres";

--
-- Name: send_payment_reminders(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."send_payment_reminders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count int := 0;
  r       record;
BEGIN
  FOR r IN
    SELECT po.id, po.buyer_id, po.seller_id, po.amount_eur, p.title
      FROM public.product_orders po
      JOIN public.products p ON p.id = po.product_id
     WHERE po.status = 'payment_requested'
       AND po.reminded_at IS NULL
       AND po.payment_requested_at < now() - interval '24 hours'
  LOOP
    -- comment_text trägt den fertigen, warmen Text (alle Surfaces nutzen ihn).
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, product_name)
    VALUES (
      r.buyer_id, r.seller_id, 'order_payment_reminder',
      'Dein Parfüm wartet noch auf dich 🌸 — kurz '
        || replace(r.amount_eur::text, '.', ',')
        || ' € bezahlen, dann geht es direkt raus.',
      r.title
    );
    UPDATE public.product_orders SET reminded_at = now() WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;


ALTER FUNCTION "public"."send_payment_reminders"() OWNER TO "postgres";

--
-- Name: send_push_to_user("uuid", "text", "text", "jsonb", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."send_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb", "p_app" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_token TEXT;
  v_count INT;
BEGIN
  -- Stale Tokens (> 90 Tage nicht gesehen) aufräumen
  DELETE FROM public.push_tokens
   WHERE user_id = p_user_id
     AND last_seen_at < NOW() - INTERVAL '90 days';

  -- Gibt es Geräte der Ziel-App?
  SELECT COUNT(*) INTO v_count
    FROM public.push_tokens
   WHERE user_id = p_user_id
     AND (p_app IS NULL OR app = p_app);

  -- RÜCKFALL, bewusst: Findet sich kein Gerät der Ziel-App, gehen die Meldungen
  -- an alle Geräte des Nutzers. Solange Berkat noch keinen Token registriert
  -- (braucht expo-notifications und damit einen EAS-Rebuild), bekommt ein Nutzer
  -- mit beiden Apps den Zuschlag so wenigstens in Serlo. Unschön, aber besser als
  -- Stille. Sobald Berkat Tokens registriert, greift der Filter und dieser Zweig
  -- läuft leer. Zum Abschalten: die COALESCE-Bedingung durch `app = p_app` ersetzen.
  FOR v_token IN
    SELECT token FROM public.push_tokens
     WHERE user_id = p_user_id
       AND (p_app IS NULL OR v_count = 0 OR app = p_app)
  LOOP
    PERFORM send_expo_push(
      token := v_token,
      title := p_title,
      body  := p_body,
      data  := p_data
    );
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."send_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_app" "text") OWNER TO "postgres";

--
-- Name: set_admin_campaign_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_admin_campaign_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_admin_campaign_updated_at"() OWNER TO "postgres";

--
-- Name: set_admin_region_metric_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_admin_region_metric_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.country_code = UPPER(NEW.country_code);
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_admin_region_metric_updated_at"() OWNER TO "postgres";

--
-- Name: set_admin_support_thread_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_admin_support_thread_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_admin_support_thread_updated_at"() OWNER TO "postgres";

--
-- Name: set_live_shop_mode("uuid", boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_live_shop_mode"("p_session_id" "uuid", "p_enabled" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_host_id UUID;
BEGIN
  SELECT host_id INTO v_host_id
    FROM public.live_sessions
   WHERE id = p_session_id
   LIMIT 1;

  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_host_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden_not_host' USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_sessions
     SET shop_enabled = p_enabled
   WHERE id = p_session_id;

  RETURN p_enabled;
END $$;


ALTER FUNCTION "public"."set_live_shop_mode"("p_session_id" "uuid", "p_enabled" boolean) OWNER TO "postgres";

--
-- Name: set_live_slow_mode("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_live_slow_mode"("p_session_id" "uuid", "p_seconds" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_host   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_seconds < 0 OR p_seconds > 300 THEN
    RAISE EXCEPTION 'Slow-Mode muss zwischen 0 und 300s liegen'
      USING ERRCODE = '22023';
  END IF;

  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
     AND status = 'active'
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden oder nicht aktiv'
      USING ERRCODE = '42501';
  END IF;

  IF v_caller <> v_host
     AND NOT public.is_live_session_moderator(p_session_id, v_caller) THEN
    RAISE EXCEPTION 'Nicht Host oder Moderator dieser Session'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_sessions
     SET slow_mode_seconds = p_seconds
   WHERE id = p_session_id;
END;
$$;


ALTER FUNCTION "public"."set_live_slow_mode"("p_session_id" "uuid", "p_seconds" integer) OWNER TO "postgres";

--
-- Name: set_max_bid("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_max_bid"("p_auction_id" "uuid", "p_max_cents" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a           public.live_auctions;
  v_uid       uuid := auth.uid();
  v_next_min  int;
  c_max_cents constant int := 1000000;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Derselbe Lock wie beim normalen Gebot: Maximum setzen und Auflösung
  -- müssen zusammen atomar sein.
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.status <> 'running' THEN
    RAISE EXCEPTION 'auction_not_running' USING ERRCODE = '22023';
  END IF;
  IF a.ends_at IS NULL OR a.ends_at <= now() THEN
    RAISE EXCEPTION 'auction_ended' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;
  IF p_max_cents > c_max_cents THEN
    RAISE EXCEPTION 'bid_too_high' USING ERRCODE = '22023';
  END IF;

  v_next_min := CASE
    WHEN a.current_bid_cents IS NULL THEN a.start_price_cents
    ELSE a.current_bid_cents + a.min_increment_cents
  END;

  IF p_max_cents < v_next_min THEN
    RAISE EXCEPTION 'bid_too_low' USING ERRCODE = '22023',
      DETAIL = format('Mindestens %s Cent', v_next_min);
  END IF;

  INSERT INTO public.live_auto_bids (auction_id, bidder_id, max_cents)
  VALUES (p_auction_id, v_uid, p_max_cents)
  ON CONFLICT (auction_id, bidder_id) DO UPDATE
    -- Nur nach oben: ein gesenktes Maximum könnte einen bereits erteilten
    -- Zuschlag rückwirkend entwerten.
    SET max_cents = GREATEST(public.live_auto_bids.max_cents, EXCLUDED.max_cents);

  PERFORM public.resolve_auto_bids(p_auction_id);

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'auction_id',        a.id,
    'current_bid_cents', a.current_bid_cents,
    'leading',           a.current_bidder_id = v_uid,
    'my_max_cents',      p_max_cents,
    'ends_at',           a.ends_at
  );
END $$;


ALTER FUNCTION "public"."set_max_bid"("p_auction_id" "uuid", "p_max_cents" integer) OWNER TO "postgres";

--
-- Name: set_order_reviews_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_order_reviews_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ begin new.updated_at := now(); return new; end $$;


ALTER FUNCTION "public"."set_order_reviews_updated_at"() OWNER TO "postgres";

--
-- Name: set_order_shipped("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_order_shipped"("p_order_id" "uuid", "p_carrier" "text" DEFAULT NULL::"text", "p_tracking" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order  public.product_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_order.seller_id <> v_caller AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  IF v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('error','not_paid');
  END IF;

  UPDATE public.product_orders
     SET status           = 'shipped',
         shipped_at       = now(),
         tracking_carrier = COALESCE(p_carrier,  tracking_carrier),
         tracking_number  = COALESCE(p_tracking, tracking_number)
   WHERE id = p_order_id;

  IF v_order.preorder_id IS NOT NULL THEN
    UPDATE public.product_preorders SET status = 'shipped', updated_at = now()
     WHERE id = v_order.preorder_id;
  END IF;

  INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
  VALUES (v_order.buyer_id, v_caller, 'order_shipped', 'Dein Parfüm ist unterwegs 📦');

  RETURN jsonb_build_object('success', true);
END $$;


ALTER FUNCTION "public"."set_order_shipped"("p_order_id" "uuid", "p_carrier" "text", "p_tracking" "text") OWNER TO "postgres";

--
-- Name: set_product_orders_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_product_orders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at := now(); return new; end $$;


ALTER FUNCTION "public"."set_product_orders_updated_at"() OWNER TO "postgres";

--
-- Name: set_product_preorders_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_product_preorders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."set_product_preorders_updated_at"() OWNER TO "postgres";

--
-- Name: set_products_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_products_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_products_updated_at"() OWNER TO "postgres";

--
-- Name: set_web_coin_orders_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_web_coin_orders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."set_web_coin_orders_updated_at"() OWNER TO "postgres";

--
-- Name: settle_due_live_auctions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."settle_due_live_auctions"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r     record;
  v_num int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.live_auctions
     WHERE status = 'running' AND ends_at IS NOT NULL AND ends_at <= now()
     ORDER BY ends_at
     LIMIT 500
  LOOP
    PERFORM public.settle_live_auction(r.id);
    v_num := v_num + 1;
  END LOOP;
  RETURN v_num;
END $$;


ALTER FUNCTION "public"."settle_due_live_auctions"() OWNER TO "postgres";

--
-- Name: settle_live_auction("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."settle_live_auction"("p_auction_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a      public.live_auctions;
  v_cart uuid;
BEGIN
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  IF a.status <> 'running' THEN
    RETURN jsonb_build_object('auction_id', a.id, 'status', a.status,
                              'winner_id', a.winner_id, 'settled', false);
  END IF;

  IF a.ends_at IS NULL OR a.ends_at > now() THEN
    RETURN jsonb_build_object('auction_id', a.id, 'status', a.status,
                              'ends_at', a.ends_at, 'settled', false);
  END IF;

  IF a.current_bidder_id IS NULL THEN
    UPDATE public.live_auctions
       SET status = 'unsold', settled_at = now()
     WHERE id = a.id;
    RETURN jsonb_build_object('auction_id', a.id, 'status', 'unsold', 'settled', true);
  END IF;

  v_cart := public.ensure_auction_cart(a.current_bidder_id, a.seller_id);

  UPDATE public.live_auctions
     SET status     = 'sold',
         winner_id  = a.current_bidder_id,
         settled_at = now(),
         cart_id    = v_cart
   WHERE id = a.id;

  RETURN jsonb_build_object(
    'auction_id', a.id,
    'status',     'sold',
    'winner_id',  a.current_bidder_id,
    'cart_id',    v_cart,
    'paid_cents', a.current_bid_cents,
    'settled',    true
  );
END $$;


ALTER FUNCTION "public"."settle_live_auction"("p_auction_id" "uuid") OWNER TO "postgres";

--
-- Name: stale_notification_backlog_recovery(integer, integer, boolean, "text"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."stale_notification_backlog_recovery"("p_older_than_days" integer DEFAULT 60, "p_limit" integer DEFAULT 500, "p_execute" boolean DEFAULT false, "p_types" "text"[] DEFAULT ARRAY['follow'::"text", 'like'::"text", 'comment'::"text", 'live'::"text", 'scheduled_live_reminder'::"text"]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_days INT := GREATEST(1, LEAST(COALESCE(p_older_than_days, 60), 365));
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000));
  v_allowed_types CONSTANT TEXT[] := ARRAY['follow', 'like', 'comment', 'live', 'scheduled_live_reminder'];
  v_types TEXT[] := ARRAY[]::TEXT[];
  v_matched INT := 0;
  v_updated INT := 0;
  v_by_type JSONB := '{}'::JSONB;
  v_updated_by_type JSONB := '{}'::JSONB;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin() OR public.can_operate()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT normalized_type ORDER BY normalized_type), ARRAY[]::TEXT[])
    INTO v_types
    FROM (
      SELECT lower(trim(item)) AS normalized_type
      FROM unnest(COALESCE(p_types, v_allowed_types)) AS item
    ) input
   WHERE normalized_type = ANY(v_allowed_types);

  IF array_length(v_types, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'no_allowed_types',
      'allowed_types', to_jsonb(v_allowed_types)
    );
  END IF;

  WITH candidates AS (
    SELECT id, type
    FROM public.notifications
    WHERE read = false
      AND type = ANY(v_types)
      AND created_at < NOW() - make_interval(days => v_days)
    ORDER BY created_at ASC
    LIMIT v_limit
  ),
  counts AS (
    SELECT type, COUNT(*)::INT AS count
    FROM candidates
    GROUP BY type
  )
  SELECT
    COALESCE(SUM(count), 0)::INT,
    COALESCE(jsonb_object_agg(type, count), '{}'::JSONB)
    INTO v_matched, v_by_type
    FROM counts;

  IF p_execute THEN
    WITH candidates AS (
      SELECT id, type
      FROM public.notifications
      WHERE read = false
        AND type = ANY(v_types)
        AND created_at < NOW() - make_interval(days => v_days)
      ORDER BY created_at ASC
      LIMIT v_limit
    ),
    updated AS (
      UPDATE public.notifications n
         SET read = true
        FROM candidates c
       WHERE n.id = c.id
       RETURNING n.type
    ),
    counts AS (
      SELECT type, COUNT(*)::INT AS count
      FROM updated
      GROUP BY type
    )
    SELECT
      COALESCE(SUM(count), 0)::INT,
      COALESCE(jsonb_object_agg(type, count), '{}'::JSONB)
      INTO v_updated, v_updated_by_type
      FROM counts;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'executed', p_execute,
    'older_than_days', v_days,
    'limit', v_limit,
    'matched', v_matched,
    'updated', v_updated,
    'types', to_jsonb(v_types),
    'by_type', v_by_type,
    'updated_by_type', v_updated_by_type
  );
END;
$$;


ALTER FUNCTION "public"."stale_notification_backlog_recovery"("p_older_than_days" integer, "p_limit" integer, "p_execute" boolean, "p_types" "text"[]) OWNER TO "postgres";

--
-- Name: start_live_auction("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."start_live_auction"("p_auction_id" "uuid", "p_duration_seconds" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a       public.live_auctions;
  v_host  uuid;
  v_uid   uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_duration_seconds < 5 OR p_duration_seconds > 600 THEN
    RAISE EXCEPTION 'invalid_duration' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT host_id INTO v_host FROM public.live_sessions WHERE id = a.session_id;

  -- Host oder Moderator. Der Helper schließt seit v1.27.2 aktive CoHosts ein,
  -- damit gilt hier dieselbe Autoritätsgrenze wie bei der Chat-Moderation.
  IF v_host IS DISTINCT FROM v_uid
     AND NOT public.is_live_session_moderator(a.session_id, v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF a.status <> 'scheduled' THEN
    RAISE EXCEPTION 'auction_not_scheduled' USING ERRCODE = '22023';
  END IF;

  -- Nur eine laufende Auktion pro Stream. Sonst konkurrieren zwei Countdowns
  -- um denselben Daumen.
  IF EXISTS (
    SELECT 1 FROM public.live_auctions
     WHERE session_id = a.session_id AND status = 'running'
  ) THEN
    RAISE EXCEPTION 'another_auction_running' USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_auctions
     SET status     = 'running',
         started_at = now(),
         ends_at    = now() + make_interval(secs => p_duration_seconds)
   WHERE id = a.id;

  RETURN jsonb_build_object(
    'auction_id',    a.id,
    'status',        'running',
    'ends_at',       now() + make_interval(secs => p_duration_seconds),
    'next_min_cents', a.start_price_cents
  );
END $$;


ALTER FUNCTION "public"."start_live_auction"("p_auction_id" "uuid", "p_duration_seconds" integer) OWNER TO "postgres";

--
-- Name: submit_order_review("uuid", integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."submit_order_review"("p_order_id" "uuid", "p_rating" integer, "p_comment" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_order    public.product_orders%rowtype;
  v_role     text;
  v_reviewee uuid;
  v_comment  text := nullif(btrim(p_comment), '');
  v_existing boolean;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RETURN jsonb_build_object('error','invalid_rating'); END IF;
  IF v_comment IS NOT NULL AND length(v_comment) > 1000 THEN v_comment := left(v_comment, 1000); END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_caller = v_order.buyer_id THEN v_role := 'buyer'; v_reviewee := v_order.seller_id;
  ELSIF v_caller = v_order.seller_id THEN v_role := 'seller'; v_reviewee := v_order.buyer_id;
  ELSE RETURN jsonb_build_object('error','not_authorized'); END IF;

  IF v_order.status <> 'delivered' THEN RETURN jsonb_build_object('error','not_delivered'); END IF;

  SELECT EXISTS(SELECT 1 FROM public.order_reviews WHERE order_id = p_order_id AND reviewer_id = v_caller)
    INTO v_existing;

  INSERT INTO public.order_reviews (order_id, reviewer_id, reviewee_id, reviewer_role, rating, comment)
  VALUES (p_order_id, v_caller, v_reviewee, v_role, p_rating, v_comment)
  ON CONFLICT (order_id, reviewer_id) DO UPDATE
    SET rating = excluded.rating, comment = excluded.comment, updated_at = now();

  IF NOT v_existing THEN
    BEGIN
      INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
      VALUES (v_reviewee, v_caller, 'order_review', 'Du wurdest mit ' || p_rating || '★ bewertet ⭐');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;


ALTER FUNCTION "public"."submit_order_review"("p_order_id" "uuid", "p_rating" integer, "p_comment" "text") OWNER TO "postgres";

--
-- Name: timeout_chat_user("uuid", "uuid", integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."timeout_chat_user"("p_session_id" "uuid", "p_user_id" "uuid", "p_seconds" integer, "p_reason" "text" DEFAULT NULL::"text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller  uuid        := auth.uid();
  v_host    uuid;
  v_is_mod  boolean     := false;
  v_until   timestamptz := now() + make_interval(secs => p_seconds);
  v_result  timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_seconds <= 0 OR p_seconds > 86400 THEN
    RAISE EXCEPTION 'Timeout-Dauer muss zwischen 1s und 24h liegen'
      USING ERRCODE = '22023';
  END IF;

  -- Session laden + aktive Validierung
  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
     AND status = 'active'
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden oder nicht aktiv'
      USING ERRCODE = '42501';
  END IF;

  -- Berechtigung: Host ODER Mod
  IF v_caller <> v_host THEN
    v_is_mod := public.is_live_session_moderator(p_session_id, v_caller);
    IF NOT v_is_mod THEN
      RAISE EXCEPTION 'Nicht Host oder Moderator dieser Session'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Self-Timeout blockieren
  IF v_caller = p_user_id THEN
    RAISE EXCEPTION 'Kann dich nicht selbst timeouten' USING ERRCODE = '22023';
  END IF;

  -- Mods dürfen den Host NICHT timeouten
  IF v_is_mod AND p_user_id = v_host THEN
    RAISE EXCEPTION 'Moderatoren können den Host nicht timeouten'
      USING ERRCODE = '42501';
  END IF;

  -- Mods dürfen andere Mods NICHT timeouten (nur der Host darf das)
  IF v_is_mod AND public.is_live_session_moderator(p_session_id, p_user_id) THEN
    RAISE EXCEPTION 'Moderatoren können andere Moderatoren nicht timeouten'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.live_chat_timeouts (session_id, user_id, until_at, reason)
  VALUES (p_session_id, p_user_id, v_until, p_reason)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET until_at = GREATEST(live_chat_timeouts.until_at, EXCLUDED.until_at),
        reason   = COALESCE(EXCLUDED.reason, live_chat_timeouts.reason)
  RETURNING until_at INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."timeout_chat_user"("p_session_id" "uuid", "p_user_id" "uuid", "p_seconds" integer, "p_reason" "text") OWNER TO "postgres";

--
-- Name: toggle_followers_only_chat("uuid", boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."toggle_followers_only_chat"("p_session_id" "uuid", "p_enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.live_sessions
  SET followers_only_chat = p_enabled
  WHERE id = p_session_id
    AND host_id = auth.uid();   -- nur eigene Session
END;
$$;


ALTER FUNCTION "public"."toggle_followers_only_chat"("p_session_id" "uuid", "p_enabled" boolean) OWNER TO "postgres";

--
-- Name: toggle_pin_post("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."toggle_pin_post"("p_post_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_currently_pinned boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT is_pinned INTO v_currently_pinned
  FROM public.posts
  WHERE id = p_post_id AND author_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post nicht gefunden oder kein Zugriff';
  END IF;

  UPDATE public.posts
  SET is_pinned = false
  WHERE author_id = v_user_id AND is_pinned = true;

  IF NOT v_currently_pinned THEN
    UPDATE public.posts
    SET is_pinned = true
    WHERE id = p_post_id AND author_id = v_user_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_pin_post"("p_post_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "toggle_pin_post"("p_post_id" "uuid", "p_user_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."toggle_pin_post"("p_post_id" "uuid", "p_user_id" "uuid") IS 'Pinnt den eigenen Beitrag an/ab (max. 1 pro Nutzer). p_user_id wird IGNORIERT — maßgeblich ist auth.uid(). Parameter bleibt nur aus Kompatibilität zu ausgelieferten App-Versionen, siehe Migration 20260814170000.';


--
-- Name: toggle_save_product("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."toggle_save_product"("p_product_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists  BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.saved_products
    WHERE user_id = v_user_id AND product_id = p_product_id
  ) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.saved_products
    WHERE user_id = v_user_id AND product_id = p_product_id;
    RETURN jsonb_build_object('saved', false);
  ELSE
    INSERT INTO public.saved_products (user_id, product_id)
    VALUES (v_user_id, p_product_id)
    ON CONFLICT (user_id, product_id) DO NOTHING;
    RETURN jsonb_build_object('saved', true);
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_save_product"("p_product_id" "uuid") OWNER TO "postgres";

--
-- Name: touch_live_auction(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."touch_live_auction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."touch_live_auction"() OWNER TO "postgres";

--
-- Name: touch_live_sessions_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."touch_live_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."touch_live_sessions_updated_at"() OWNER TO "postgres";

--
-- Name: touch_web_push_subscription("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."touch_web_push_subscription"("p_endpoint" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.web_push_subscriptions
     SET last_seen_at = NOW()
   WHERE user_id  = auth.uid()
     AND endpoint = p_endpoint;
END;
$$;


ALTER FUNCTION "public"."touch_web_push_subscription"("p_endpoint" "text") OWNER TO "postgres";

--
-- Name: trigger_nsfw_moderation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."trigger_nsfw_moderation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _url      text;
  _anon_key text;
BEGIN
  -- Nur Bilder moderieren (Videos brauchen separate Pipeline)
  IF NEW.media_type = 'image' AND NEW.media_url IS NOT NULL THEN
    _url      := current_setting('app.supabase_url',    true);
    _anon_key := current_setting('app.service_role_key', true);

    -- Sanity-Check: wenn der Setting-Stack leer ist (neuer Project-Clone,
    -- vergessenes ALTER DATABASE ...) darf der Insert NICHT scheitern.
    IF _url IS NULL OR _anon_key IS NULL THEN
      RETURN NEW;
    END IF;

    -- Async HTTP POST an Edge Function. Fire-and-forget: der pg_net-Worker
    -- schreibt in _http_response, wir warten hier nicht. Kritisch: Fehler
    -- in diesem Block dürfen NIE den Insert rollbacken — Moderation ist
    -- best-effort, der Post hat is_visible=true als Default und wird
    -- retroaktiv versteckt wenn die Edge Function ein NSFW-Signal liefert.
    BEGIN
      PERFORM net.http_post(
        url     := _url || '/functions/v1/moderate-image',
        body    := jsonb_build_object(
                     'post_id',   NEW.id,
                     'image_url', NEW.media_url
                   ),
        headers := jsonb_build_object(
                     'Content-Type',  'application/json',
                     'Authorization', 'Bearer ' || _anon_key
                   ),
        timeout_milliseconds := 55000
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log als NOTICE (landet in Postgres-Logs), Insert läuft durch.
      RAISE NOTICE '[trigger_nsfw_moderation] net.http_post failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_nsfw_moderation"() OWNER TO "postgres";

--
-- Name: try_welcome_viewer("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."try_welcome_viewer"("p_session_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_host        uuid;
  v_status      text;
  v_tier        text;
  v_inserted    boolean;
  v_username    text;
  v_avatar_url  text;
BEGIN
  -- Nicht eingeloggt → still, kein Toast.
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Session laden.
  SELECT s.host_id, s.status
    INTO v_host, v_status
    FROM public.live_sessions s
   WHERE s.id = p_session_id;

  IF v_host IS NULL THEN
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Nur bei aktiven Sessions welcomen (ended/idle → kein Toast).
  IF v_status <> 'active' THEN
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Host meldet sich nicht selbst an.
  IF v_caller = v_host THEN
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Tier berechnen: top_fan schlägt follower.
  IF EXISTS (
    SELECT 1
      FROM public.gift_transactions g
     WHERE g.sender_id    = v_caller
       AND g.recipient_id = v_host
     LIMIT 1
  ) THEN
    v_tier := 'top_fan';
  ELSIF EXISTS (
    SELECT 1
      FROM public.follows f
     WHERE f.follower_id  = v_caller
       AND f.following_id = v_host
     LIMIT 1
  ) THEN
    v_tier := 'follower';
  ELSE
    -- Regulärer Viewer → kein Toast, kein DB-Write.
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Idempotent einfügen. Wenn bereits vorhanden → kein Toast.
  INSERT INTO public.live_viewer_welcomes (session_id, user_id, tier)
  VALUES (p_session_id, v_caller, v_tier)
  ON CONFLICT (session_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    -- Schon welcomed diese Session → still.
    RETURN jsonb_build_object('tier', NULL);
  END IF;

  -- Profilinfos für den Toast mitgeben (Client muss sonst eine
  -- extra Query machen).
  SELECT p.username, p.avatar_url
    INTO v_username, v_avatar_url
    FROM public.profiles p
   WHERE p.id = v_caller;

  RETURN jsonb_build_object(
    'tier',       v_tier,
    'user_id',    v_caller,
    'username',   v_username,
    'avatar_url', v_avatar_url
  );
END;
$$;


ALTER FUNCTION "public"."try_welcome_viewer"("p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "try_welcome_viewer"("p_session_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."try_welcome_viewer"("p_session_id" "uuid") IS 'Idempotenter Welcome-Check: liefert {tier,username,avatar_url} nur bei qualifiziertem Erst-Join (v1.24). Client broadcastet dann selbst.';


--
-- Name: unblock_cohost("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."unblock_cohost"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_host uuid := auth.uid();
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.live_cohost_blocks
   WHERE host_id = v_host
     AND blocked_user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."unblock_cohost"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: unblock_user("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."unblock_user"("p_blocked_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM user_blocks
  WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
END;
$$;


ALTER FUNCTION "public"."unblock_user"("p_blocked_id" "uuid") OWNER TO "postgres";

--
-- Name: unpin_live_comment("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."unpin_live_comment"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_host   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden' USING ERRCODE = '42501';
  END IF;

  IF v_caller <> v_host
     AND NOT public.is_live_session_moderator(p_session_id, v_caller) THEN
    RAISE EXCEPTION 'Nicht Host oder Moderator dieser Session'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_comments
     SET pinned = false
   WHERE session_id = p_session_id
     AND pinned IS TRUE;

  UPDATE public.live_sessions
     SET pinned_comment = NULL
   WHERE id = p_session_id;
END;
$$;


ALTER FUNCTION "public"."unpin_live_comment"("p_session_id" "uuid") OWNER TO "postgres";

--
-- Name: untimeout_chat_user("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."untimeout_chat_user"("p_session_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_host   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT host_id INTO v_host
    FROM public.live_sessions
   WHERE id = p_session_id
   LIMIT 1;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session nicht gefunden' USING ERRCODE = '42501';
  END IF;

  IF v_caller <> v_host
     AND NOT public.is_live_session_moderator(p_session_id, v_caller) THEN
    RAISE EXCEPTION 'Nicht Host oder Moderator dieser Session'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.live_chat_timeouts
   WHERE session_id = p_session_id
     AND user_id    = p_user_id;
END;
$$;


ALTER FUNCTION "public"."untimeout_chat_user"("p_session_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: update_conversation_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_conversation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_timestamp"() OWNER TO "postgres";

--
-- Name: update_dwell_time("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_dwell_time"("post_id" "uuid", "dwell_ms" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id   uuid    := auth.uid();
  v_capped_ms integer;
  v_fresh     boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  -- Input sanitizen: keine Negativwerte, Cap bei 60s (Ausreißer dämpfen)
  v_capped_ms := GREATEST(0, LEAST(COALESCE(dwell_ms, 0), 60000));

  -- Atomarer Upsert.  `xmax = 0` auf dem zurückgegebenen Tupel signalisiert
  -- "frisch eingefügt"; bei ON CONFLICT DO UPDATE setzt PostgreSQL xmax
  -- auf die aktuelle Transaktions-ID (> 0).
  WITH upsert AS (
    INSERT INTO public.post_dwell_log (post_id, user_id, last_dwell_ms)
    VALUES (update_dwell_time.post_id, v_user_id, v_capped_ms)
    ON CONFLICT (post_id, user_id) DO UPDATE
      SET last_dwell_ms = EXCLUDED.last_dwell_ms,
          observed_at   = now()
    RETURNING (xmax = 0) AS was_insert
  )
  SELECT was_insert INTO v_fresh FROM upsert;

  -- EMA-Update NUR bei erstmaliger Beobachtung dieses (User, Post)-Paars.
  -- Formel: new = old * 0.85 + (min(dwell,60000) / 20000.0) * 0.15
  IF v_fresh THEN
    UPDATE public.posts
       SET dwell_time_score = COALESCE(dwell_time_score, 0) * 0.85
                            + (v_capped_ms::float / 20000.0) * 0.15
     WHERE id = update_dwell_time.post_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_dwell_time"("post_id" "uuid", "dwell_ms" integer) OWNER TO "postgres";

--
-- Name: update_dwell_times_batch("jsonb", "uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_dwell_times_batch"("p_dwells" "jsonb" DEFAULT '[]'::"jsonb", "p_skips" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  r jsonb;
  s uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Dwell-Messungen: exakt update_dwell_time pro Eintrag (gleiche EMA-Logik).
  FOR r IN SELECT jsonb_array_elements(COALESCE(p_dwells, '[]'::jsonb))
  LOOP
    IF (r ? 'post_id') AND (r ? 'dwell_ms') THEN
      PERFORM public.update_dwell_time((r->>'post_id')::uuid, (r->>'dwell_ms')::int);
    END IF;
  END LOOP;

  -- Skips: exakt record_skip pro Eintrag.
  IF p_skips IS NOT NULL THEN
    FOREACH s IN ARRAY p_skips
    LOOP
      PERFORM public.record_skip(s);
    END LOOP;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_dwell_times_batch"("p_dwells" "jsonb", "p_skips" "uuid"[]) OWNER TO "postgres";

--
-- Name: update_live_auction("uuid", "text", integer, integer, integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_live_auction"("p_auction_id" "uuid", "p_title" "text", "p_start_price_cents" integer, "p_min_increment_cents" integer, "p_buy_now_cents" integer DEFAULT NULL::integer, "p_image_url" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a     public.live_auctions;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Zeilen-Lock wie beim Abbrechen: zwischen Prüfung und Schreiben darf der
  -- Artikel nicht losstarten.
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  IF a.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF a.status <> 'scheduled' THEN
    RAISE EXCEPTION 'auction_not_editable' USING ERRCODE = '22023';
  END IF;

  -- Kann bei 'scheduled' nicht vorkommen. Steht trotzdem hier, weil die
  -- Annahme sonst nur im Kopf existiert und beim nächsten Statuswechsel
  -- unbemerkt fällt.
  IF a.bid_count > 0 THEN
    RAISE EXCEPTION 'has_bids' USING ERRCODE = '22023';
  END IF;

  IF char_length(btrim(COALESCE(p_title, ''))) NOT BETWEEN 2 AND 140 THEN
    RAISE EXCEPTION 'invalid_title' USING ERRCODE = '22023';
  END IF;
  IF p_start_price_cents <= 0 OR p_min_increment_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_price' USING ERRCODE = '22023';
  END IF;
  IF p_buy_now_cents IS NOT NULL AND p_buy_now_cents <= p_start_price_cents THEN
    RAISE EXCEPTION 'buy_now_below_start' USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_auctions
     SET title               = btrim(p_title),
         start_price_cents   = p_start_price_cents,
         min_increment_cents = p_min_increment_cents,
         buy_now_cents       = p_buy_now_cents,
         image_url           = p_image_url
   WHERE id = a.id;

  RETURN jsonb_build_object('auction_id', a.id, 'status', 'updated');
END $$;


ALTER FUNCTION "public"."update_live_auction"("p_auction_id" "uuid", "p_title" "text", "p_start_price_cents" integer, "p_min_increment_cents" integer, "p_buy_now_cents" integer, "p_image_url" "text") OWNER TO "postgres";

--
-- Name: update_order_shipping_address("uuid", "text", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_order_shipping_address"("p_order_id" "uuid", "p_name" "text", "p_street" "text", "p_zip" "text", "p_city" "text", "p_country" "text" DEFAULT 'DE'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_order   public.product_orders%ROWTYPE;
  v_name    text := nullif(btrim(p_name), '');
  v_street  text := nullif(btrim(p_street), '');
  v_zip     text := nullif(btrim(p_zip), '');
  v_city    text := nullif(btrim(p_city), '');
  v_country text := upper(coalesce(nullif(btrim(p_country), ''), 'DE'));
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_order.buyer_id <> v_caller THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  IF v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('error','not_editable');
  END IF;

  IF v_name IS NULL OR v_street IS NULL OR v_zip IS NULL OR v_city IS NULL THEN
    RETURN jsonb_build_object('error','incomplete_address');
  END IF;
  IF v_country NOT IN ('DE','AT','CH') THEN
    RETURN jsonb_build_object('error','country_not_supported');
  END IF;

  UPDATE public.product_orders
     SET ship_name    = v_name,
         ship_street  = v_street,
         ship_zip     = v_zip,
         ship_city    = v_city,
         ship_country = v_country,
         updated_at   = now()
   WHERE id = p_order_id;

  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    VALUES (v_order.seller_id, v_caller, 'order_address_updated', 'Eine Lieferadresse wurde aktualisiert.');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END $$;


ALTER FUNCTION "public"."update_order_shipping_address"("p_order_id" "uuid", "p_name" "text", "p_street" "text", "p_zip" "text", "p_city" "text", "p_country" "text") OWNER TO "postgres";

--
-- Name: update_post("uuid", "text", "text"[], "text", boolean, boolean, boolean, boolean, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_post"("p_post_id" "uuid", "p_caption" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_privacy" "text" DEFAULT NULL::"text", "p_allow_comments" boolean DEFAULT NULL::boolean, "p_allow_download" boolean DEFAULT NULL::boolean, "p_allow_duet" boolean DEFAULT NULL::boolean, "p_women_only" boolean DEFAULT NULL::boolean, "p_aspect_ratio" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.posts
     SET caption = NULLIF(BTRIM(p_caption), ''),
         tags    = COALESCE(p_tags, '{}'::TEXT[]),
         privacy = COALESCE(p_privacy, privacy),
         allow_comments = COALESCE(p_allow_comments, allow_comments),
         allow_download = COALESCE(p_allow_download, allow_download),
         allow_duet = COALESCE(p_allow_duet, allow_duet),
         women_only = COALESCE(p_women_only, women_only),
         aspect_ratio = COALESCE(p_aspect_ratio, aspect_ratio)
   WHERE id = p_post_id
     AND author_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or not owned by user';
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_post"("p_post_id" "uuid", "p_caption" "text", "p_tags" "text"[], "p_privacy" "text", "p_allow_comments" boolean, "p_allow_download" boolean, "p_allow_duet" boolean, "p_women_only" boolean, "p_aspect_ratio" "text") OWNER TO "postgres";

--
-- Name: update_product_rating(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_product_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Ermittle product_id aus NEW oder OLD
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE public.products
  SET
    avg_rating   = (SELECT AVG(rating)::NUMERIC(3,2) FROM public.product_reviews WHERE product_id = v_product_id),
    review_count = (SELECT COUNT(*)                  FROM public.product_reviews WHERE product_id = v_product_id)
  WHERE id = v_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_product_rating"() OWNER TO "postgres";

--
-- Name: upsert_post_draft("uuid", "text", "text"[], "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."upsert_post_draft"("p_id" "uuid" DEFAULT NULL::"uuid", "p_caption" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_media_type" "text" DEFAULT NULL::"text", "p_media_url" "text" DEFAULT NULL::"text", "p_thumbnail_url" "text" DEFAULT NULL::"text", "p_settings" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.post_drafts (
      author_id, caption, tags, media_type, media_url,
      thumbnail_url, settings
    ) VALUES (
      v_caller, NULLIF(trim(p_caption), ''), p_tags, p_media_type,
      p_media_url, p_thumbnail_url, p_settings
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.post_drafts
       SET caption        = NULLIF(trim(p_caption), ''),
           tags           = p_tags,
           media_type     = p_media_type,
           media_url      = p_media_url,
           thumbnail_url  = p_thumbnail_url,
           settings       = p_settings
     WHERE id = p_id AND author_id = v_caller
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Draft nicht gefunden' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."upsert_post_draft"("p_id" "uuid", "p_caption" "text", "p_tags" "text"[], "p_media_type" "text", "p_media_url" "text", "p_thumbnail_url" "text", "p_settings" "jsonb") OWNER TO "postgres";

--
-- Name: users_blocked("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."users_blocked"("a" "uuid", "b" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
     WHERE (blocker_id = a AND blocked_id = b)
        OR (blocker_id = b AND blocked_id = a)
  );
$$;


ALTER FUNCTION "public"."users_blocked"("a" "uuid", "b" "uuid") OWNER TO "postgres";

--
-- Name: vote_on_poll("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."vote_on_poll"("p_poll_id" "uuid", "p_option_index" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_options JSONB;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT options
    INTO v_options
    FROM public.live_polls
   WHERE id = p_poll_id
     AND closed_at IS NULL;

  IF v_options IS NULL THEN
    RAISE EXCEPTION 'poll_closed';
  END IF;

  IF p_option_index < 0 OR p_option_index >= jsonb_array_length(v_options) THEN
    RAISE EXCEPTION 'invalid_option';
  END IF;

  INSERT INTO public.live_poll_votes (poll_id, user_id, option_index)
  VALUES (p_poll_id, v_user_id, p_option_index);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_voted';
END;
$$;


ALTER FUNCTION "public"."vote_on_poll"("p_poll_id" "uuid", "p_option_index" integer) OWNER TO "postgres";

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";

--
-- Name: admin_campaign_daily_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_campaign_daily_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "metric_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "impressions" bigint DEFAULT 0 NOT NULL,
    "clicks" bigint DEFAULT 0 NOT NULL,
    "conversions" bigint DEFAULT 0 NOT NULL,
    "revenue_cents" bigint DEFAULT 0 NOT NULL,
    "spend_cents" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_campaign_daily_metrics_clicks_check" CHECK (("clicks" >= 0)),
    CONSTRAINT "admin_campaign_daily_metrics_conversions_check" CHECK (("conversions" >= 0)),
    CONSTRAINT "admin_campaign_daily_metrics_impressions_check" CHECK (("impressions" >= 0)),
    CONSTRAINT "admin_campaign_daily_metrics_revenue_cents_check" CHECK (("revenue_cents" >= 0)),
    CONSTRAINT "admin_campaign_daily_metrics_spend_cents_check" CHECK (("spend_cents" >= 0))
);


ALTER TABLE "public"."admin_campaign_daily_metrics" OWNER TO "postgres";

--
-- Name: admin_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "channel" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "target_metric" "text",
    "budget_cents" bigint DEFAULT 0 NOT NULL,
    "spend_cents" bigint DEFAULT 0 NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_campaigns_budget_cents_check" CHECK (("budget_cents" >= 0)),
    CONSTRAINT "admin_campaigns_spend_cents_check" CHECK (("spend_cents" >= 0)),
    CONSTRAINT "admin_campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'completed'::"text", 'failed'::"text", 'archived'::"text"]))),
    CONSTRAINT "admin_campaigns_title_check" CHECK (("char_length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."admin_campaigns" OWNER TO "postgres";

--
-- Name: admin_region_daily_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_region_daily_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text" NOT NULL,
    "country_name" "text" NOT NULL,
    "metric_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "active_users" bigint DEFAULT 0 NOT NULL,
    "new_registrations" bigint DEFAULT 0 NOT NULL,
    "posts" bigint DEFAULT 0 NOT NULL,
    "views" bigint DEFAULT 0 NOT NULL,
    "reports" bigint DEFAULT 0 NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_profiles" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "admin_region_daily_metrics_active_users_check" CHECK (("active_users" >= 0)),
    CONSTRAINT "admin_region_daily_metrics_country_code_check" CHECK (("country_code" ~ '^[A-Z]{2}$'::"text")),
    CONSTRAINT "admin_region_daily_metrics_country_name_check" CHECK (("char_length"(TRIM(BOTH FROM "country_name")) > 0)),
    CONSTRAINT "admin_region_daily_metrics_new_registrations_check" CHECK (("new_registrations" >= 0)),
    CONSTRAINT "admin_region_daily_metrics_posts_check" CHECK (("posts" >= 0)),
    CONSTRAINT "admin_region_daily_metrics_reports_check" CHECK (("reports" >= 0)),
    CONSTRAINT "admin_region_daily_metrics_total_profiles_check" CHECK (("total_profiles" >= 0)),
    CONSTRAINT "admin_region_daily_metrics_views_check" CHECK (("views" >= 0))
);


ALTER TABLE "public"."admin_region_daily_metrics" OWNER TO "postgres";

--
-- Name: admin_support_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender_type" "text" NOT NULL,
    "sender_id" "uuid",
    "body" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_support_messages_body_check" CHECK ((("length"(TRIM(BOTH FROM "body")) > 0) AND ("length"("body") <= 4000))),
    CONSTRAINT "admin_support_messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['user'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."admin_support_messages" OWNER TO "postgres";

--
-- Name: admin_support_threads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_support_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "user_id" "uuid",
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "assigned_admin_id" "uuid",
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_support_threads_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "admin_support_threads_source_check" CHECK (("source" = ANY (ARRAY['dm'::"text", 'report'::"text", 'payment'::"text", 'system'::"text", 'manual'::"text", 'activation'::"text"]))),
    CONSTRAINT "admin_support_threads_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'pending'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."admin_support_threads" OWNER TO "postgres";

--
-- Name: ai_image_generations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ai_image_generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "purpose" "public"."ai_image_purpose" NOT NULL,
    "prompt" "text" NOT NULL,
    "model" "text" DEFAULT 'gpt-image-1'::"text" NOT NULL,
    "image_url" "text",
    "storage_path" "text",
    "size" "text" DEFAULT '1024x1024'::"text" NOT NULL,
    "cost_cents" integer DEFAULT 4 NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consumed_at" timestamp with time zone,
    CONSTRAINT "ai_image_generations_cost_cents_check" CHECK (("cost_cents" >= 0)),
    CONSTRAINT "ai_image_generations_prompt_check" CHECK ((("char_length"("prompt") >= 3) AND ("char_length"("prompt") <= 2000))),
    CONSTRAINT "ai_image_generations_size_check" CHECK (("size" = ANY (ARRAY['1024x1024'::"text", '1024x1536'::"text", '1536x1024'::"text", '512x512'::"text"])))
);


ALTER TABLE "public"."ai_image_generations" OWNER TO "postgres";

--
-- Name: algo_experiments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."algo_experiments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT false,
    "control_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "treatment_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone
);


ALTER TABLE "public"."algo_experiments" OWNER TO "postgres";

--
-- Name: algo_user_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."algo_user_variants" (
    "user_id" "uuid" NOT NULL,
    "experiment_name" "text" NOT NULL,
    "variant" "text" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."algo_user_variants" OWNER TO "postgres";

--
-- Name: auction_carts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."auction_carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closes_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reminded_at" timestamp with time zone,
    CONSTRAINT "auction_carts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'checkout_pending'::"text", 'checked_out'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."auction_carts" OWNER TO "postgres";

--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bookmarks" OWNER TO "postgres";

--
-- Name: coin_pricing_tiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."coin_pricing_tiers" (
    "id" "text" NOT NULL,
    "coins" integer NOT NULL,
    "bonus_coins" integer DEFAULT 0 NOT NULL,
    "price_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'eur'::"text" NOT NULL,
    "stripe_price_id" "text",
    "badge_label" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coin_pricing_tiers_bonus_coins_check" CHECK (("bonus_coins" >= 0)),
    CONSTRAINT "coin_pricing_tiers_coins_check" CHECK (("coins" > 0)),
    CONSTRAINT "coin_pricing_tiers_price_cents_check" CHECK (("price_cents" > 0))
);


ALTER TABLE "public"."coin_pricing_tiers" OWNER TO "postgres";

--
-- Name: coin_purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."coin_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "coins_credited" integer NOT NULL,
    "transaction_id" "text",
    "event_type" "text" NOT NULL,
    "raw_event" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."coin_purchases" OWNER TO "postgres";

--
-- Name: coins_wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."coins_wallets" (
    "user_id" "uuid" NOT NULL,
    "coins" integer DEFAULT 0 NOT NULL,
    "diamonds" integer DEFAULT 0 NOT NULL,
    "total_gifted" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coins_wallets_coins_check" CHECK (("coins" >= 0)),
    CONSTRAINT "coins_wallets_diamonds_check" CHECK (("diamonds" >= 0))
);


ALTER TABLE "public"."coins_wallets" OWNER TO "postgres";

--
-- Name: comment_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid",
    CONSTRAINT "comments_text_check" CHECK ((("char_length"("text") > 0) AND ("char_length"("text") <= 500)))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";

--
-- Name: COLUMN "comments"."parent_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."comments"."parent_id" IS 'If set, this comment is a reply to the comment with this id. Max one level deep.';


--
-- Name: content_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'actioned'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "content_reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'profile'::"text", 'comment'::"text", 'live'::"text", 'product'::"text"])))
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_1" "uuid" NOT NULL,
    "participant_2" "uuid" NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "participants_ordered" CHECK (("participant_1" < "participant_2"))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";

--
-- Name: gift_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."gift_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "live_session_id" "text" NOT NULL,
    "gift_id" "text" NOT NULL,
    "coin_cost" integer NOT NULL,
    "diamond_value" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gift_transactions" OWNER TO "postgres";

--
-- Name: live_battle_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_battle_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "guest_id" "uuid" NOT NULL,
    "host_score" integer DEFAULT 0 NOT NULL,
    "guest_score" integer DEFAULT 0 NOT NULL,
    "winner" "text" NOT NULL,
    "duration_secs" integer DEFAULT 0 NOT NULL,
    "ended_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_battle_history_duration_secs_check" CHECK (("duration_secs" >= 0)),
    CONSTRAINT "live_battle_history_guest_score_check" CHECK (("guest_score" >= 0)),
    CONSTRAINT "live_battle_history_host_score_check" CHECK (("host_score" >= 0)),
    CONSTRAINT "live_battle_history_winner_check" CHECK (("winner" = ANY (ARRAY['host'::"text", 'guest'::"text", 'draw'::"text"]))),
    CONSTRAINT "no_self_battle" CHECK (("host_id" <> "guest_id"))
);


ALTER TABLE "public"."live_battle_history" OWNER TO "postgres";

--
-- Name: live_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    CONSTRAINT "live_comments_text_check" CHECK (("char_length"("text") <= 300))
);


ALTER TABLE "public"."live_comments" OWNER TO "postgres";

--
-- Name: live_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "host_id" "uuid" NOT NULL,
    "title" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "viewer_count" integer DEFAULT 0 NOT NULL,
    "peak_viewers" integer DEFAULT 0 NOT NULL,
    "room_name" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "like_count" integer DEFAULT 0,
    "comment_count" integer DEFAULT 0,
    "pinned_comment" "jsonb",
    "replay_url" "text",
    "is_replayable" boolean DEFAULT false NOT NULL,
    "replay_views" integer DEFAULT 0 NOT NULL,
    "thumbnail_url" "text",
    "category" "text" DEFAULT 'talk'::"text",
    "moderation_enabled" boolean DEFAULT false NOT NULL,
    "moderation_words" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "goal_type" "text",
    "goal_target" integer,
    "goal_current" integer DEFAULT 0 NOT NULL,
    "goal_title" "text",
    "goal_reached" boolean DEFAULT false NOT NULL,
    "allow_comments" boolean DEFAULT true NOT NULL,
    "allow_gifts" boolean DEFAULT true NOT NULL,
    "women_only" boolean DEFAULT false NOT NULL,
    "followers_only_chat" boolean DEFAULT false NOT NULL,
    "slow_mode_seconds" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recording_enabled" boolean DEFAULT false NOT NULL,
    "recording_id" "uuid",
    "shop_enabled" boolean DEFAULT false NOT NULL,
    "ingress_id" "text",
    "ingress_url" "text",
    "ingress_stream_key" "text",
    "ingress_type" "text",
    "followers_only" boolean DEFAULT false NOT NULL,
    CONSTRAINT "live_sessions_goal_type_check" CHECK (("goal_type" = ANY (ARRAY['gift_value'::"text", 'likes'::"text"]))),
    CONSTRAINT "live_sessions_ingress_type_check" CHECK ((("ingress_type" IS NULL) OR ("ingress_type" = ANY (ARRAY['whip'::"text", 'rtmp'::"text"])))),
    CONSTRAINT "live_sessions_slow_mode_seconds_check" CHECK ((("slow_mode_seconds" >= 0) AND ("slow_mode_seconds" <= 300))),
    CONSTRAINT "live_sessions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."live_sessions" OWNER TO "postgres";

--
-- Name: COLUMN "live_sessions"."allow_comments"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."live_sessions"."allow_comments" IS 'Host-Einstellung: ob Zuschauer während des Livestreams kommentieren dürfen';


--
-- Name: COLUMN "live_sessions"."allow_gifts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."live_sessions"."allow_gifts" IS 'Host-Einstellung: ob Zuschauer virtuelle Geschenke (Coins) senden dürfen';


--
-- Name: COLUMN "live_sessions"."women_only"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."live_sessions"."women_only" IS 'Wenn true: nur für verifizierte Frauen beitretbar';


--
-- Name: COLUMN "live_sessions"."slow_mode_seconds"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."live_sessions"."slow_mode_seconds" IS 'Sekunden Cool-Down zwischen Messages pro User. 0 = deaktiviert.';


--
-- Name: COLUMN "live_sessions"."followers_only"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."live_sessions"."followers_only" IS 'Wenn true: nur Follower des Hosts bekommen ein LiveKit-Token (Zuschauen). Durchsetzung in Edge Function livekit-token. Unterscheidet sich von followers_only_chat (steuert nur das Schreibrecht im Chat).';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "bio" "text",
    "avatar_url" "text",
    "guild_id" "uuid",
    "explore_vibe" double precision DEFAULT 0.5,
    "brain_vibe" double precision DEFAULT 0.5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expo_push_token" "text",
    "onboarding_complete" boolean DEFAULT false,
    "push_token" "text",
    "preferred_tags" "text"[],
    "is_private" boolean DEFAULT false NOT NULL,
    "consistency_score" double precision DEFAULT 0.5 NOT NULL,
    "website" "text",
    "voice_sample_url" "text",
    "is_verified" boolean DEFAULT false NOT NULL,
    "teip" "text",
    "gender" "text",
    "women_only_verified" boolean DEFAULT false NOT NULL,
    "verification_level" integer DEFAULT 0 NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "is_creator" boolean DEFAULT false NOT NULL,
    "display_name" "text",
    "notif_prefs" "jsonb" DEFAULT '{"live": true, "gifts": true, "likes": true, "orders": true, "follows": true, "comments": true, "messages": true}'::"jsonb" NOT NULL,
    "is_banned" boolean DEFAULT false NOT NULL,
    "is_restricted" boolean DEFAULT false NOT NULL,
    "restricted_until" timestamp with time zone,
    "is_shadow_banned" boolean DEFAULT false NOT NULL,
    "is_moderator" boolean DEFAULT false NOT NULL,
    "is_operator" boolean DEFAULT false NOT NULL,
    "is_creator_ops" boolean DEFAULT false NOT NULL,
    "country_code" "text",
    "country_name" "text",
    "city" "text",
    "region_name" "text",
    "location_consent_at" timestamp with time zone,
    "nav_slot_2" "text",
    "nav_slot_4" "text",
    "referred_by" "uuid",
    "locale" "text" DEFAULT 'de'::"text" NOT NULL,
    CONSTRAINT "profiles_country_code_check" CHECK ((("country_code" IS NULL) OR ("country_code" ~ '^[A-Z]{2}$'::"text"))),
    CONSTRAINT "profiles_gender_check" CHECK (("gender" = ANY (ARRAY['female'::"text", 'male'::"text", 'other'::"text"]))),
    CONSTRAINT "profiles_locale_check" CHECK (("locale" = ANY (ARRAY['de'::"text", 'ru'::"text", 'en'::"text", 'ce'::"text"]))),
    CONSTRAINT "profiles_nav_slot_2_check" CHECK ((("nav_slot_2" IS NULL) OR ("nav_slot_2" = ANY (ARRAY['guild'::"text", 'messages'::"text", 'shop'::"text", 'explore'::"text", 'notifications'::"text", 'live'::"text", 'women_only'::"text"])))),
    CONSTRAINT "profiles_nav_slot_4_check" CHECK ((("nav_slot_4" IS NULL) OR ("nav_slot_4" = ANY (ARRAY['guild'::"text", 'messages'::"text", 'shop'::"text", 'explore'::"text", 'notifications'::"text", 'live'::"text", 'women_only'::"text"]))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";

--
-- Name: COLUMN "profiles"."voice_sample_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."voice_sample_url" IS 'Öffentliche URL des Chatterbox-Voice-Samples (Cloudflare R2). Wird als audio_prompt an die generate-voice Edge Function übergeben.';


--
-- Name: COLUMN "profiles"."gender"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."gender" IS 'Geschlecht der Nutzerin (optional, für Women-Only Zone)';


--
-- Name: COLUMN "profiles"."women_only_verified"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."women_only_verified" IS 'Hat die Zugang zur Women-Only Zone? true wenn gender=female + Level>=1';


--
-- Name: COLUMN "profiles"."verification_level"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."verification_level" IS '0=keine, 1=Selbstdeklaration, 2=Selfie-geprüft';


--
-- Name: COLUMN "profiles"."is_admin"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."is_admin" IS 'Serlo-interne Admin-Rolle. Gibt Zugang zum Admin-Panel in der App.';


--
-- Name: COLUMN "profiles"."is_creator"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."is_creator" IS 'Creator-Status: true = Creator-Dashboard und Monetarisierungs-Features aktiv';


--
-- Name: COLUMN "profiles"."display_name"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."display_name" IS 'Öffentlicher Anzeigename (optional, sonst username)';


--
-- Name: COLUMN "profiles"."notif_prefs"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."notif_prefs" IS 'Per-channel push preference flags. Keys: likes | comments | follows | messages | live | gifts | orders. Default: all true.';


--
-- Name: COLUMN "profiles"."is_moderator"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."is_moderator" IS 'Can review and enforce content reports without full admin privileges.';


--
-- Name: COLUMN "profiles"."is_operator"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."is_operator" IS 'Can view production health, release, queue, cost, and product command-center signals.';


--
-- Name: COLUMN "profiles"."is_creator_ops"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."is_creator_ops" IS 'Can view creator/shop payout operations without full admin privileges.';


--
-- Name: COLUMN "profiles"."nav_slot_2"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."nav_slot_2" IS 'Bottom-Nav Slot 2 (links vom Create-Button). TabFeature-Key. NULL = Default guild.';


--
-- Name: COLUMN "profiles"."nav_slot_4"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."nav_slot_4" IS 'Bottom-Nav Slot 4 (rechts vom Create-Button). TabFeature-Key. NULL = Default shop.';


--
-- Name: COLUMN "profiles"."locale"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."locale" IS 'App-Sprache des Users (von der App gesynct); Push-Texte werden danach lokalisiert.';


--
-- Name: creator_live_history; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."creator_live_history" AS
 SELECT "s"."id" AS "session_id",
    "s"."host_id",
    "s"."title",
    "s"."started_at",
    "s"."ended_at",
    GREATEST(0, (EXTRACT(epoch FROM (COALESCE("s"."ended_at", "now"()) - "s"."started_at")))::integer) AS "duration_secs",
    "s"."peak_viewers",
    "s"."status",
    COALESCE("g"."total_gift_coins", (0)::bigint) AS "total_gift_coins",
    COALESCE("g"."total_gift_diamonds", (0)::bigint) AS "total_gift_diamonds",
    COALESCE("g"."gift_count", (0)::bigint) AS "gift_count",
    COALESCE("c"."comment_count", (0)::bigint) AS "comment_count",
    "b"."winner" AS "battle_winner",
    "b"."host_score" AS "battle_host_score",
    "b"."guest_score" AS "battle_guest_score",
    "b"."guest_id" AS "battle_opponent_id",
    "p"."username" AS "battle_opponent_name",
    "p"."avatar_url" AS "battle_opponent_avatar",
        CASE
            WHEN ("b"."winner" IS NULL) THEN NULL::"text"
            WHEN ("b"."winner" = 'host'::"text") THEN 'win'::"text"
            WHEN ("b"."winner" = 'guest'::"text") THEN 'loss'::"text"
            WHEN ("b"."winner" = 'draw'::"text") THEN 'draw'::"text"
            ELSE NULL::"text"
        END AS "battle_result"
   FROM (((("public"."live_sessions" "s"
     LEFT JOIN ( SELECT "gt"."live_session_id",
            "sum"("gt"."coin_cost") AS "total_gift_coins",
            "sum"("gt"."diamond_value") AS "total_gift_diamonds",
            "count"(*) AS "gift_count"
           FROM "public"."gift_transactions" "gt"
          GROUP BY "gt"."live_session_id") "g" ON (("g"."live_session_id" = "s"."room_name")))
     LEFT JOIN ( SELECT "lc"."session_id",
            "count"(*) AS "comment_count"
           FROM "public"."live_comments" "lc"
          GROUP BY "lc"."session_id") "c" ON (("c"."session_id" = "s"."id")))
     LEFT JOIN "public"."live_battle_history" "b" ON ((("b"."session_id" = "s"."id") AND ("b"."host_id" = "s"."host_id"))))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "b"."guest_id")));


ALTER VIEW "public"."creator_live_history" OWNER TO "postgres";

--
-- Name: creator_tips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."creator_tips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "coin_amount" integer NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "creator_tips_check" CHECK (("sender_id" <> "recipient_id")),
    CONSTRAINT "creator_tips_coin_amount_check" CHECK ((("coin_amount" > 0) AND ("coin_amount" <= 100000))),
    CONSTRAINT "creator_tips_message_check" CHECK (("char_length"("message") <= 140))
);


ALTER TABLE "public"."creator_tips" OWNER TO "postgres";

--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "flag_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";

--
-- Name: follow_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."follow_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."follow_requests" OWNER TO "postgres";

--
-- Name: follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."follows" OWNER TO "postgres";

--
-- Name: guilds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."guilds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "member_count" integer DEFAULT 0,
    "vibe_tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."guilds" OWNER TO "postgres";

--
-- Name: likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."likes" OWNER TO "postgres";

--
-- Name: live_auctions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_auctions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "title" "text" NOT NULL,
    "image_url" "text",
    "start_price_cents" integer DEFAULT 100 NOT NULL,
    "min_increment_cents" integer DEFAULT 100 NOT NULL,
    "buy_now_cents" integer,
    "currency" "text" DEFAULT 'eur'::"text" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "sort_index" integer DEFAULT 0 NOT NULL,
    "current_bid_cents" integer,
    "current_bidder_id" "uuid",
    "bid_count" integer DEFAULT 0 NOT NULL,
    "ends_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "settled_at" timestamp with time zone,
    "winner_id" "uuid",
    "cart_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_auctions_check" CHECK ((("buy_now_cents" IS NULL) OR ("buy_now_cents" > "start_price_cents"))),
    CONSTRAINT "live_auctions_min_increment_cents_check" CHECK (("min_increment_cents" > 0)),
    CONSTRAINT "live_auctions_start_price_cents_check" CHECK (("start_price_cents" > 0)),
    CONSTRAINT "live_auctions_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'running'::"text", 'sold'::"text", 'unsold'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "live_auctions_title_check" CHECK ((("char_length"("btrim"("title")) >= 2) AND ("char_length"("btrim"("title")) <= 140)))
);

ALTER TABLE ONLY "public"."live_auctions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."live_auctions" OWNER TO "postgres";

--
-- Name: TABLE "live_auctions"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."live_auctions" IS 'Berkat: eine Auktion = ein Artikel in einem Live-Stream. ends_at ist die Serveruhr.';


--
-- Name: live_auto_bids; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_auto_bids" (
    "auction_id" "uuid" NOT NULL,
    "bidder_id" "uuid" NOT NULL,
    "max_cents" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_auto_bids_max_cents_check" CHECK (("max_cents" > 0))
);


ALTER TABLE "public"."live_auto_bids" OWNER TO "postgres";

--
-- Name: TABLE "live_auto_bids"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."live_auto_bids" IS 'Berkat: hinterlegte Maxima. Nur der Besitzer darf sein eigenes lesen.';


--
-- Name: live_bids; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auction_id" "uuid" NOT NULL,
    "bidder_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_bids_amount_cents_check" CHECK (("amount_cents" > 0))
);


ALTER TABLE "public"."live_bids" OWNER TO "postgres";

--
-- Name: live_chat_timeouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_chat_timeouts" (
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "until_at" timestamp with time zone NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_chat_timeouts" OWNER TO "postgres";

--
-- Name: live_clip_markers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_clip_markers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ts_secs" integer NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_clip_markers_note_check" CHECK ((("note" IS NULL) OR ("char_length"("note") <= 140))),
    CONSTRAINT "live_clip_markers_ts_secs_check" CHECK ((("ts_secs" >= 0) AND ("ts_secs" <= 86400)))
);


ALTER TABLE "public"."live_clip_markers" OWNER TO "postgres";

--
-- Name: live_clip_markers_hot; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."live_clip_markers_hot" AS
 SELECT "session_id",
    ("ts_secs" / 15) AS "bucket_15s",
    "min"("ts_secs") AS "window_start",
    "max"("ts_secs") AS "window_end",
    ("count"(*))::integer AS "marker_count",
    "array_agg"(DISTINCT "user_id") AS "user_ids"
   FROM "public"."live_clip_markers" "m"
  GROUP BY "session_id", ("ts_secs" / 15);


ALTER VIEW "public"."live_clip_markers_hot" OWNER TO "postgres";

--
-- Name: live_cohost_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_cohost_blocks" (
    "host_id" "uuid" NOT NULL,
    "blocked_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "reason" "text",
    CONSTRAINT "no_self_block" CHECK (("host_id" <> "blocked_user_id"))
);


ALTER TABLE "public"."live_cohost_blocks" OWNER TO "postgres";

--
-- Name: live_cohosts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_cohosts" (
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "approved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "slot_index" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "live_cohosts_slot_index_check" CHECK ((("slot_index" >= 0) AND ("slot_index" <= 7)))
);


ALTER TABLE "public"."live_cohosts" OWNER TO "postgres";

--
-- Name: COLUMN "live_cohosts"."slot_index"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."live_cohosts"."slot_index" IS 'Grid-Position in der Multi-Guest-UI (0..7). Beim Approve vergibt
   approve_cohost den kleinsten freien Slot automatisch.';


--
-- Name: live_duet_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_duet_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "guest_id" "uuid" NOT NULL,
    "initiated_by" "text" NOT NULL,
    "layout" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_secs" integer,
    "gift_coins_total" integer DEFAULT 0 NOT NULL,
    "end_reason" "text",
    CONSTRAINT "live_duet_history_end_reason_check" CHECK ((("end_reason" IS NULL) OR ("end_reason" = ANY (ARRAY['host-ended'::"text", 'guest-left'::"text", 'kicked'::"text", 'session-ended'::"text", 'disconnect'::"text"])))),
    CONSTRAINT "live_duet_history_initiated_by_check" CHECK (("initiated_by" = ANY (ARRAY['host'::"text", 'guest'::"text"]))),
    CONSTRAINT "live_duet_history_layout_check" CHECK (("layout" = ANY (ARRAY['top-bottom'::"text", 'side-by-side'::"text", 'pip'::"text", 'battle'::"text", 'grid-2x2'::"text", 'grid-3x3'::"text"])))
);


ALTER TABLE "public"."live_duet_history" OWNER TO "postgres";

--
-- Name: live_duet_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_duet_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "invitee_id" "uuid" NOT NULL,
    "direction" "text" NOT NULL,
    "layout" "text" DEFAULT 'side-by-side'::"text" NOT NULL,
    "battle_duration" integer,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "decline_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:00:30'::interval) NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "live_duet_invites_battle_duration_check" CHECK ((("battle_duration" IS NULL) OR (("battle_duration" >= 30) AND ("battle_duration" <= 600)))),
    CONSTRAINT "live_duet_invites_direction_check" CHECK (("direction" = ANY (ARRAY['host-to-viewer'::"text", 'viewer-to-host'::"text"]))),
    CONSTRAINT "live_duet_invites_layout_check" CHECK (("layout" = ANY (ARRAY['top-bottom'::"text", 'side-by-side'::"text", 'pip'::"text", 'battle'::"text"]))),
    CONSTRAINT "live_duet_invites_message_check" CHECK ((("message" IS NULL) OR ("char_length"("message") <= 200))),
    CONSTRAINT "live_duet_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."live_duet_invites" OWNER TO "postgres";

--
-- Name: live_giveaway_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_giveaway_entries" (
    "giveaway_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_giveaway_entries" OWNER TO "postgres";

--
-- Name: live_giveaways; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_giveaways" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "image_url" "text",
    "requires_follow" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "entry_count" integer DEFAULT 0 NOT NULL,
    "winner_id" "uuid",
    "drawn_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_giveaways_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'drawn'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "live_giveaways_title_check" CHECK ((("char_length"("btrim"("title")) >= 2) AND ("char_length"("btrim"("title")) <= 120)))
);

ALTER TABLE ONLY "public"."live_giveaways" REPLICA IDENTITY FULL;


ALTER TABLE "public"."live_giveaways" OWNER TO "postgres";

--
-- Name: TABLE "live_giveaways"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."live_giveaways" IS 'Berkat: Gewinnspiel im Stream. Teilnahme immer kostenlos — sonst wäre es Glücksspiel.';


--
-- Name: live_moderators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_moderators" (
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "granted_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_moderators" OWNER TO "postgres";

--
-- Name: live_placed_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_placed_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "position_x" real DEFAULT 40 NOT NULL,
    "position_y" real DEFAULT 260 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_at" timestamp with time zone
);


ALTER TABLE "public"."live_placed_products" OWNER TO "postgres";

--
-- Name: live_poll_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_poll_votes" (
    "poll_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "option_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_poll_votes_option_index_check" CHECK ((("option_index" >= 0) AND ("option_index" <= 3)))
);


ALTER TABLE "public"."live_poll_votes" OWNER TO "postgres";

--
-- Name: live_poll_tallies; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."live_poll_tallies" AS
 SELECT "poll_id",
    "option_index",
    ("count"(*))::integer AS "vote_count"
   FROM "public"."live_poll_votes" "v"
  GROUP BY "poll_id", "option_index";


ALTER VIEW "public"."live_poll_tallies" OWNER TO "postgres";

--
-- Name: live_polls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_polls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "options" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "live_polls_options_check" CHECK ((("jsonb_typeof"("options") = 'array'::"text") AND (("jsonb_array_length"("options") >= 2) AND ("jsonb_array_length"("options") <= 4)))),
    CONSTRAINT "live_polls_question_check" CHECK ((("char_length"("question") >= 3) AND ("char_length"("question") <= 140)))
);


ALTER TABLE "public"."live_polls" OWNER TO "postgres";

--
-- Name: live_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_reactions_emoji_check" CHECK (("emoji" = ANY (ARRAY['❤️'::"text", '🔥'::"text", '👏'::"text", '😱'::"text", '💜'::"text"])))
);


ALTER TABLE "public"."live_reactions" OWNER TO "postgres";

--
-- Name: live_recordings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_recordings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "egress_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "file_url" "text",
    "file_path" "text",
    "file_size_bytes" bigint,
    "duration_secs" integer,
    "thumbnail_url" "text",
    "is_public" boolean DEFAULT true NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_recordings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'recording'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."live_recordings" OWNER TO "postgres";

--
-- Name: live_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."live_reports" OWNER TO "postgres";

--
-- Name: live_session_viewers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_session_viewers" (
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_session_viewers" OWNER TO "postgres";

--
-- Name: live_session_viewer_counts; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."live_session_viewer_counts" AS
 SELECT "session_id",
    "count"(*) AS "active_viewers",
    "max"("joined_at") AS "last_join"
   FROM "public"."live_session_viewers"
  GROUP BY "session_id";


ALTER VIEW "public"."live_session_viewer_counts" OWNER TO "postgres";

--
-- Name: live_stickers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_stickers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "position_x" real DEFAULT 40 NOT NULL,
    "position_y" real DEFAULT 180 NOT NULL,
    "scale" real DEFAULT 1.0 NOT NULL,
    "rotation" real DEFAULT 0.0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_at" timestamp with time zone,
    CONSTRAINT "live_stickers_emoji_check" CHECK ((("char_length"("emoji") >= 1) AND ("char_length"("emoji") <= 32))),
    CONSTRAINT "live_stickers_scale_check" CHECK ((("scale" >= (0.3)::double precision) AND ("scale" <= (3.0)::double precision)))
);


ALTER TABLE "public"."live_stickers" OWNER TO "postgres";

--
-- Name: live_viewer_welcomes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."live_viewer_welcomes" (
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tier" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_viewer_welcomes_tier_check" CHECK (("tier" = ANY (ARRAY['follower'::"text", 'top_fan'::"text"])))
);


ALTER TABLE "public"."live_viewer_welcomes" OWNER TO "postgres";

--
-- Name: TABLE "live_viewer_welcomes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."live_viewer_welcomes" IS 'Dedup-Tracker für TikTok-Style Welcome-Toasts beim Join in eine Live-Session (v1.24).';


--
-- Name: COLUMN "live_viewer_welcomes"."tier"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."live_viewer_welcomes"."tier" IS 'Qualifizierendes Tier beim Erst-Join: follower | top_fan. Viewer ohne Tier erzeugen KEINE Zeile.';


--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_reactions" OWNER TO "postgres";

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "post_id" "uuid",
    "reply_to_id" "uuid",
    "image_url" "text",
    "story_media_url" "text",
    "story_author" "text"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";

--
-- Name: moderation_auto_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."moderation_auto_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "confidence" numeric DEFAULT 0 NOT NULL,
    "signals" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "moderation_auto_flags_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "moderation_auto_flags_reason_check" CHECK (("reason" = ANY (ARRAY['auto_spam'::"text", 'auto_nsfw'::"text", 'auto_scam'::"text"]))),
    CONSTRAINT "moderation_auto_flags_target_type_check" CHECK (("target_type" = 'post'::"text"))
);


ALTER TABLE "public"."moderation_auto_flags" OWNER TO "postgres";

--
-- Name: muted_live_hosts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."muted_live_hosts" (
    "user_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "muted_live_hosts_check" CHECK (("user_id" <> "host_id"))
);


ALTER TABLE "public"."muted_live_hosts" OWNER TO "postgres";

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "type" "text" NOT NULL,
    "post_id" "uuid",
    "comment_text" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "session_id" "uuid",
    "comment_id" "uuid",
    "conversation_id" "uuid",
    "gift_name" "text",
    "gift_emoji" "text",
    "product_name" "text",
    "product_id" "uuid",
    "app" "text" DEFAULT 'serlo'::"text" NOT NULL,
    CONSTRAINT "notifications_app_check" CHECK (("app" = ANY (ARRAY['serlo'::"text", 'berkat'::"text"]))),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['auction_won'::"text", 'order_payment_reminder'::"text", 'scheduled_live_reminder'::"text", 'preorder_interest'::"text", 'support_new'::"text", 'order_review'::"text", 'order_address_updated'::"text", 'order_dispute'::"text", 'new_order'::"text", 'live_invite'::"text", 'order_payment_requested'::"text", 'like'::"text", 'comment'::"text", 'preorder_round_open'::"text", 'guild'::"text", 'order_paid'::"text", 'support_reply'::"text", 'follow_request'::"text", 'follow_request_accepted'::"text", 'gift'::"text", 'repost'::"text", 'dm'::"text", 'order_shipped'::"text", 'order_cancelled'::"text", 'story_reaction'::"text", 'product_saved'::"text", 'follow'::"text", 'mention'::"text", 'comment_like'::"text", 'live'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";

--
-- Name: order_disputes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."order_disputes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "against_id" "uuid" NOT NULL,
    "reporter_role" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "detail" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolution" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "order_disputes_reason_check" CHECK (("reason" = ANY (ARRAY['not_received'::"text", 'damaged'::"text", 'not_as_described'::"text", 'not_paid'::"text", 'fraud'::"text", 'other'::"text"]))),
    CONSTRAINT "order_disputes_reporter_role_check" CHECK (("reporter_role" = ANY (ARRAY['buyer'::"text", 'seller'::"text"]))),
    CONSTRAINT "order_disputes_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."order_disputes" OWNER TO "postgres";

--
-- Name: order_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."order_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "reviewee_id" "uuid" NOT NULL,
    "reviewer_role" "text" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "order_reviews_reviewer_role_check" CHECK (("reviewer_role" = ANY (ARRAY['buyer'::"text", 'seller'::"text"])))
);


ALTER TABLE "public"."order_reviews" OWNER TO "postgres";

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "total_coins" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "delivery_notes" "text",
    "download_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orders_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'cancelled'::"text", 'refunded'::"text"]))),
    CONSTRAINT "orders_total_coins_check" CHECK (("total_coins" > 0))
);

ALTER TABLE ONLY "public"."orders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."orders" OWNER TO "postgres";

--
-- Name: payout_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."payout_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "diamonds_amount" bigint NOT NULL,
    "euro_amount" numeric(10,2) NOT NULL,
    "iban" "text",
    "paypal_email" "text",
    "note" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    CONSTRAINT "payout_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'paid'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."payout_requests" OWNER TO "postgres";

--
-- Name: TABLE "payout_requests"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."payout_requests" IS 'Creator-Auszahlungsanfragen (manuell bearbeitet in Phase 1)';


--
-- Name: post_drafts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."post_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "caption" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "media_type" "text",
    "media_url" "text",
    "thumbnail_url" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_drafts_caption_len" CHECK ((("caption" IS NULL) OR ("char_length"("caption") <= 2200))),
    CONSTRAINT "post_drafts_media_type_check" CHECK ((("media_type" IS NULL) OR ("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"]))))
);


ALTER TABLE "public"."post_drafts" OWNER TO "postgres";

--
-- Name: post_dwell_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."post_dwell_log" (
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "view_count" integer DEFAULT 1 NOT NULL,
    "last_dwell_ms" integer,
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_dwell_log" OWNER TO "postgres";

--
-- Name: post_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."post_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "post_reports_reason_check" CHECK (("reason" = ANY (ARRAY['report'::"text", 'not_interested'::"text"])))
);


ALTER TABLE "public"."post_reports" OWNER TO "postgres";

--
-- Name: post_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."post_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_views" OWNER TO "postgres";

--
-- Name: post_views_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."post_views_log" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_views_log" OWNER TO "postgres";

--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "caption" "text",
    "media_url" "text",
    "media_type" "text" DEFAULT 'image'::"text",
    "dwell_time_score" double precision DEFAULT 0,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "guild_id" "uuid",
    "is_guild_post" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "score_explore" double precision DEFAULT 0.5,
    "score_brain" double precision DEFAULT 0.5,
    "view_count" integer DEFAULT 0 NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    "bookmark_count" integer DEFAULT 0 NOT NULL,
    "thumbnail_url" "text",
    "privacy" "text" DEFAULT 'public'::"text" NOT NULL,
    "allow_comments" boolean DEFAULT true NOT NULL,
    "allow_download" boolean DEFAULT true NOT NULL,
    "allow_duet" boolean DEFAULT true NOT NULL,
    "cover_time_ms" integer DEFAULT 0,
    "audio_url" "text",
    "audio_volume" real DEFAULT 0.8,
    "is_flagged" boolean DEFAULT false NOT NULL,
    "flag_reason" "text",
    "is_visible" boolean DEFAULT true NOT NULL,
    "women_only" boolean DEFAULT false NOT NULL,
    "aspect_ratio" "text" DEFAULT 'portrait'::"text" NOT NULL,
    "bunny_video_id" "text",
    "bunny_status" "text",
    "product_id" "uuid",
    CONSTRAINT "posts_aspect_ratio_check" CHECK (("aspect_ratio" = ANY (ARRAY['portrait'::"text", 'landscape'::"text", 'square'::"text"]))),
    CONSTRAINT "posts_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"]))),
    CONSTRAINT "posts_privacy_check" CHECK (("privacy" = ANY (ARRAY['public'::"text", 'friends'::"text", 'private'::"text"]))),
    CONSTRAINT "posts_score_brain_check" CHECK ((("score_brain" >= (0)::double precision) AND ("score_brain" <= (1)::double precision))),
    CONSTRAINT "posts_score_explore_check" CHECK ((("score_explore" >= (0)::double precision) AND ("score_explore" <= (1)::double precision)))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";

--
-- Name: COLUMN "posts"."women_only"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."posts"."women_only" IS 'Wenn true: nur für verifizierte Frauen sichtbar (RLS)';


--
-- Name: preorder_rounds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."preorder_rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "guild_id" "uuid",
    "title" "text" NOT NULL,
    "target_qty" integer NOT NULL,
    "closes_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "preorder_rounds_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'arrived'::"text"]))),
    CONSTRAINT "preorder_rounds_target_qty_check" CHECK ((("target_qty" >= 1) AND ("target_qty" <= 9999))),
    CONSTRAINT "preorder_rounds_title_check" CHECK ((("char_length"("title") >= 3) AND ("char_length"("title") <= 80)))
);


ALTER TABLE "public"."preorder_rounds" OWNER TO "postgres";

--
-- Name: product_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."product_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "preorder_id" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price_eur" numeric(10,2) NOT NULL,
    "amount_eur" numeric(10,2) NOT NULL,
    "platform_fee_eur" numeric(10,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'eur'::"text" NOT NULL,
    "status" "text" DEFAULT 'reserved'::"text" NOT NULL,
    "ship_name" "text",
    "ship_street" "text",
    "ship_zip" "text",
    "ship_city" "text",
    "ship_country" "text" DEFAULT 'DE'::"text",
    "tracking_carrier" "text",
    "tracking_number" "text",
    "stripe_session_id" "text",
    "stripe_payment_intent" "text",
    "payment_requested_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "shipped_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reminded_at" timestamp with time zone,
    "cart_id" "uuid",
    "title" "text",
    CONSTRAINT "product_orders_amount_eur_check" CHECK (("amount_eur" >= (0)::numeric)),
    CONSTRAINT "product_orders_platform_fee_eur_check" CHECK (("platform_fee_eur" >= (0)::numeric)),
    CONSTRAINT "product_orders_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "product_orders_status_check" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'payment_requested'::"text", 'paid'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text", 'refunded'::"text", 'disputed'::"text"]))),
    CONSTRAINT "product_orders_unit_price_eur_check" CHECK (("unit_price_eur" >= (0)::numeric))
);


ALTER TABLE "public"."product_orders" OWNER TO "postgres";

--
-- Name: product_preorders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."product_preorders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'interested'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "round_id" "uuid",
    CONSTRAINT "product_preorders_quantity_check" CHECK ((("quantity" >= 1) AND ("quantity" <= 999))),
    CONSTRAINT "product_preorders_status_check" CHECK (("status" = ANY (ARRAY['interested'::"text", 'notified'::"text", 'paid'::"text", 'shipped'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."product_preorders" OWNER TO "postgres";

--
-- Name: product_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."product_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."product_reviews" OWNER TO "postgres";

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "price_coins" integer NOT NULL,
    "category" "text" NOT NULL,
    "cover_url" "text",
    "file_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "stock" integer DEFAULT '-1'::integer NOT NULL,
    "women_only" boolean DEFAULT false NOT NULL,
    "sold_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "avg_rating" numeric(3,2) DEFAULT NULL::numeric,
    "review_count" integer DEFAULT 0 NOT NULL,
    "sale_price_coins" integer,
    "free_shipping" boolean DEFAULT false NOT NULL,
    "location" "text",
    "sale_mode" "text" DEFAULT 'coins'::"text" NOT NULL,
    "price_eur" numeric(10,2),
    CONSTRAINT "products_category_check" CHECK (("category" = ANY (ARRAY['digital'::"text", 'physical'::"text", 'service'::"text", 'collectible'::"text"]))),
    CONSTRAINT "products_price_coins_check" CHECK (("price_coins" > 0)),
    CONSTRAINT "products_price_eur_check" CHECK ((("price_eur" IS NULL) OR ("price_eur" > (0)::numeric))),
    CONSTRAINT "products_sale_lower_than_price" CHECK ((("sale_price_coins" IS NULL) OR (("sale_price_coins" > 0) AND ("sale_price_coins" < "price_coins")))),
    CONSTRAINT "products_sale_mode_check" CHECK (("sale_mode" = ANY (ARRAY['coins'::"text", 'preorder'::"text", 'cash'::"text"])))
);

ALTER TABLE ONLY "public"."products" REPLICA IDENTITY FULL;


ALTER TABLE "public"."products" OWNER TO "postgres";

--
-- Name: COLUMN "products"."sale_mode"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."sale_mode" IS 'Verkaufsart: coins (Standard, Coin-Kauf) | preorder (Sammelbestellung ohne Geld, Phase 0) | cash (echtes Geld/Stripe, Phase 1). Nur Admin darf <> coins setzen (Trigger).';


--
-- Name: COLUMN "products"."price_eur"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."price_eur" IS 'Echter Euro-Preis (numeric, optional). Relevant für sale_mode <> coins (preorder/cash). Coin-Produkte ignorieren es. UI zeigt es statt "Preis siehe Beschreibung".';


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" DEFAULT 'other'::"text",
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "app" "text" DEFAULT 'serlo'::"text" NOT NULL,
    CONSTRAINT "push_tokens_app_check" CHECK (("app" = ANY (ARRAY['serlo'::"text", 'berkat'::"text"]))),
    CONSTRAINT "push_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";

--
-- Name: r2_delete_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."r2_delete_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "author_id" "uuid",
    "media_url" "text",
    "thumbnail_url" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "r2_delete_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'deleted'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."r2_delete_queue" OWNER TO "postgres";

--
-- Name: reposts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."reposts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."reposts" REPLICA IDENTITY FULL;


ALTER TABLE "public"."reposts" OWNER TO "postgres";

--
-- Name: saved_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."saved_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_products" OWNER TO "postgres";

--
-- Name: scheduled_lives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."scheduled_lives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "host_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "scheduled_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "allow_comments" boolean DEFAULT true NOT NULL,
    "allow_gifts" boolean DEFAULT true NOT NULL,
    "women_only" boolean DEFAULT false NOT NULL,
    "session_id" "uuid",
    "reminded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scheduled_lives_desc_len" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 500))),
    CONSTRAINT "scheduled_lives_future" CHECK (("scheduled_at" > ("created_at" - '00:01:00'::interval))),
    CONSTRAINT "scheduled_lives_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'reminded'::"text", 'live'::"text", 'expired'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "scheduled_lives_title_len" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120)))
);


ALTER TABLE "public"."scheduled_lives" OWNER TO "postgres";

--
-- Name: scheduled_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."scheduled_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "caption" "text",
    "media_url" "text",
    "media_type" "text",
    "thumbnail_url" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_guild_post" boolean DEFAULT false NOT NULL,
    "guild_id" "uuid",
    "audio_url" "text",
    "audio_volume" numeric,
    "privacy" "text" DEFAULT 'public'::"text" NOT NULL,
    "allow_comments" boolean DEFAULT true NOT NULL,
    "allow_download" boolean DEFAULT false NOT NULL,
    "allow_duet" boolean DEFAULT true NOT NULL,
    "women_only" boolean DEFAULT false NOT NULL,
    "cover_time_ms" integer,
    "publish_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "retries" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "published_post_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aspect_ratio" "text" DEFAULT 'portrait'::"text" NOT NULL,
    CONSTRAINT "scheduled_posts_aspect_ratio_check" CHECK (("aspect_ratio" = ANY (ARRAY['portrait'::"text", 'landscape'::"text", 'square'::"text"]))),
    CONSTRAINT "scheduled_posts_caption_len" CHECK ((("caption" IS NULL) OR ("char_length"("caption") <= 2200))),
    CONSTRAINT "scheduled_posts_future" CHECK (("publish_at" > ("created_at" - '00:01:00'::interval))),
    CONSTRAINT "scheduled_posts_media_type_check" CHECK ((("media_type" IS NULL) OR ("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))),
    CONSTRAINT "scheduled_posts_privacy_check" CHECK (("privacy" = ANY (ARRAY['public'::"text", 'friends'::"text", 'private'::"text"]))),
    CONSTRAINT "scheduled_posts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'publishing'::"text", 'published'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."scheduled_posts" OWNER TO "postgres";

--
-- Name: seller_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."seller_accounts" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "stripe_connect_id" "text",
    "kyc_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "payout_enabled" boolean DEFAULT false NOT NULL,
    "platform_fee_bps" integer DEFAULT 1000 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."seller_accounts" OWNER TO "postgres";

--
-- Name: stories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "interactive" "jsonb",
    "archived" boolean DEFAULT false NOT NULL,
    "thumbnail_url" "text"
);


ALTER TABLE "public"."stories" OWNER TO "postgres";

--
-- Name: COLUMN "stories"."thumbnail_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."stories"."thumbnail_url" IS 'Explicit preview image used by feeds/admin dashboards. Image stories may reuse media_url; video stories require generated JPEG thumbnails.';


--
-- Name: story_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."story_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_emoji" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "story_comments_content_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 300)))
);


ALTER TABLE "public"."story_comments" OWNER TO "postgres";

--
-- Name: story_highlights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."story_highlights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "story_id" "uuid",
    "title" "text" DEFAULT 'Highlight'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "media_url" "text",
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "post_id" "uuid",
    "thumbnail_url" "text",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."story_highlights" OWNER TO "postgres";

--
-- Name: story_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."story_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."story_likes" OWNER TO "postgres";

--
-- Name: story_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."story_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."story_views" OWNER TO "postgres";

--
-- Name: story_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."story_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "option_idx" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."story_votes" OWNER TO "postgres";

--
-- Name: user_battle_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."user_battle_stats" AS
 SELECT "user_id",
    "count"(*) FILTER (WHERE ("result" = 'win'::"text")) AS "wins",
    "count"(*) FILTER (WHERE ("result" = 'loss'::"text")) AS "losses",
    "count"(*) FILTER (WHERE ("result" = 'draw'::"text")) AS "draws",
    "count"(*) AS "total_battles"
   FROM ( SELECT "live_battle_history"."host_id" AS "user_id",
                CASE
                    WHEN ("live_battle_history"."winner" = 'host'::"text") THEN 'win'::"text"
                    WHEN ("live_battle_history"."winner" = 'draw'::"text") THEN 'draw'::"text"
                    ELSE 'loss'::"text"
                END AS "result"
           FROM "public"."live_battle_history"
        UNION ALL
         SELECT "live_battle_history"."guest_id" AS "user_id",
                CASE
                    WHEN ("live_battle_history"."winner" = 'guest'::"text") THEN 'win'::"text"
                    WHEN ("live_battle_history"."winner" = 'draw'::"text") THEN 'draw'::"text"
                    ELSE 'loss'::"text"
                END AS "result"
           FROM "public"."live_battle_history") "x"
  GROUP BY "user_id";


ALTER VIEW "public"."user_battle_stats" OWNER TO "postgres";

--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";

--
-- Name: user_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reported_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'harassment'::"text", 'inappropriate'::"text", 'fake_account'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."user_reports" OWNER TO "postgres";

--
-- Name: user_tag_affinity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_tag_affinity" (
    "user_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    "affinity" double precision DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_tag_affinity" OWNER TO "postgres";

--
-- Name: user_vibe_profile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_vibe_profile" (
    "user_id" "uuid" NOT NULL,
    "learned_explore" double precision DEFAULT 0.5 NOT NULL,
    "learned_brain" double precision DEFAULT 0.5 NOT NULL,
    "interaction_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_vibe_profile" OWNER TO "postgres";

--
-- Name: user_whip_ingresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_whip_ingresses" (
    "user_id" "uuid" NOT NULL,
    "ingress_id" "text" NOT NULL,
    "ingress_url" "text" NOT NULL,
    "stream_key" "text" NOT NULL,
    "room_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_whip_ingresses" OWNER TO "postgres";

--
-- Name: web_coin_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."web_coin_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tier_id" "text" NOT NULL,
    "coins" integer NOT NULL,
    "bonus_coins" integer DEFAULT 0 NOT NULL,
    "price_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'eur'::"text" NOT NULL,
    "status" "public"."coin_order_status" DEFAULT 'pending'::"public"."coin_order_status" NOT NULL,
    "stripe_session_id" "text",
    "stripe_payment_intent" "text",
    "invoice_url" "text",
    "receipt_url" "text",
    "paid_at" timestamp with time zone,
    "failed_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "web_coin_orders_coins_check" CHECK (("coins" > 0))
);


ALTER TABLE "public"."web_coin_orders" OWNER TO "postgres";

--
-- Name: web_push_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."web_push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "device_label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."web_push_subscriptions" OWNER TO "postgres";

--
-- Name: TABLE "web_push_subscriptions"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."web_push_subscriptions" IS 'W3C Web-Push-Subscriptions (VAPID). Getrennt von push_tokens (Expo) weil Shape + Dispatch-Pfad fundamental anders.';


--
-- Name: women_only_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."women_only_requests" (
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "method" "text" DEFAULT 'self'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "note" "text",
    CONSTRAINT "women_only_requests_method_check" CHECK (("method" = ANY (ARRAY['self'::"text", 'admin'::"text", 'grandfather'::"text"]))),
    CONSTRAINT "women_only_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."women_only_requests" OWNER TO "postgres";

--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: admin_campaign_daily_metrics admin_campaign_daily_metrics_campaign_id_metric_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_campaign_daily_metrics"
    ADD CONSTRAINT "admin_campaign_daily_metrics_campaign_id_metric_date_key" UNIQUE ("campaign_id", "metric_date");


--
-- Name: admin_campaign_daily_metrics admin_campaign_daily_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_campaign_daily_metrics"
    ADD CONSTRAINT "admin_campaign_daily_metrics_pkey" PRIMARY KEY ("id");


--
-- Name: admin_campaigns admin_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_campaigns"
    ADD CONSTRAINT "admin_campaigns_pkey" PRIMARY KEY ("id");


--
-- Name: admin_region_daily_metrics admin_region_daily_metrics_country_code_metric_date_source_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_region_daily_metrics"
    ADD CONSTRAINT "admin_region_daily_metrics_country_code_metric_date_source_key" UNIQUE ("country_code", "metric_date", "source");


--
-- Name: admin_region_daily_metrics admin_region_daily_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_region_daily_metrics"
    ADD CONSTRAINT "admin_region_daily_metrics_pkey" PRIMARY KEY ("id");


--
-- Name: admin_support_messages admin_support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_support_messages"
    ADD CONSTRAINT "admin_support_messages_pkey" PRIMARY KEY ("id");


--
-- Name: admin_support_threads admin_support_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_support_threads"
    ADD CONSTRAINT "admin_support_threads_pkey" PRIMARY KEY ("id");


--
-- Name: ai_image_generations ai_image_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_image_generations"
    ADD CONSTRAINT "ai_image_generations_pkey" PRIMARY KEY ("id");


--
-- Name: algo_experiments algo_experiments_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."algo_experiments"
    ADD CONSTRAINT "algo_experiments_name_key" UNIQUE ("name");


--
-- Name: algo_experiments algo_experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."algo_experiments"
    ADD CONSTRAINT "algo_experiments_pkey" PRIMARY KEY ("id");


--
-- Name: algo_user_variants algo_user_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."algo_user_variants"
    ADD CONSTRAINT "algo_user_variants_pkey" PRIMARY KEY ("user_id", "experiment_name");


--
-- Name: auction_carts auction_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."auction_carts"
    ADD CONSTRAINT "auction_carts_pkey" PRIMARY KEY ("id");


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id");


--
-- Name: bookmarks bookmarks_user_id_post_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_user_id_post_id_key" UNIQUE ("user_id", "post_id");


--
-- Name: coin_pricing_tiers coin_pricing_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coin_pricing_tiers"
    ADD CONSTRAINT "coin_pricing_tiers_pkey" PRIMARY KEY ("id");


--
-- Name: coin_purchases coin_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coin_purchases"
    ADD CONSTRAINT "coin_purchases_pkey" PRIMARY KEY ("id");


--
-- Name: coin_purchases coin_purchases_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coin_purchases"
    ADD CONSTRAINT "coin_purchases_transaction_id_key" UNIQUE ("transaction_id");


--
-- Name: coins_wallets coins_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coins_wallets"
    ADD CONSTRAINT "coins_wallets_pkey" PRIMARY KEY ("user_id");


--
-- Name: comment_likes comment_likes_comment_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");


--
-- Name: comment_likes comment_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");


--
-- Name: content_reports content_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");


--
-- Name: conversations conversations_participant_1_participant_2_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_1_participant_2_key" UNIQUE ("participant_1", "participant_2");


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");


--
-- Name: creator_tips creator_tips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."creator_tips"
    ADD CONSTRAINT "creator_tips_pkey" PRIMARY KEY ("id");


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("flag_key");


--
-- Name: follow_requests follow_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."follow_requests"
    ADD CONSTRAINT "follow_requests_pkey" PRIMARY KEY ("id");


--
-- Name: follow_requests follow_requests_sender_id_receiver_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."follow_requests"
    ADD CONSTRAINT "follow_requests_sender_id_receiver_id_key" UNIQUE ("sender_id", "receiver_id");


--
-- Name: follows follows_follower_id_following_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");


--
-- Name: gift_catalog gift_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."gift_catalog"
    ADD CONSTRAINT "gift_catalog_pkey" PRIMARY KEY ("id");


--
-- Name: gift_transactions gift_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."gift_transactions"
    ADD CONSTRAINT "gift_transactions_pkey" PRIMARY KEY ("id");


--
-- Name: guilds guilds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."guilds"
    ADD CONSTRAINT "guilds_pkey" PRIMARY KEY ("id");


--
-- Name: likes likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");


--
-- Name: likes likes_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");


--
-- Name: live_auctions live_auctions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auctions"
    ADD CONSTRAINT "live_auctions_pkey" PRIMARY KEY ("id");


--
-- Name: live_auto_bids live_auto_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auto_bids"
    ADD CONSTRAINT "live_auto_bids_pkey" PRIMARY KEY ("auction_id", "bidder_id");


--
-- Name: live_battle_history live_battle_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_battle_history"
    ADD CONSTRAINT "live_battle_history_pkey" PRIMARY KEY ("id");


--
-- Name: live_bids live_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_bids"
    ADD CONSTRAINT "live_bids_pkey" PRIMARY KEY ("id");


--
-- Name: live_chat_timeouts live_chat_timeouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_chat_timeouts"
    ADD CONSTRAINT "live_chat_timeouts_pkey" PRIMARY KEY ("session_id", "user_id");


--
-- Name: live_clip_markers live_clip_markers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_clip_markers"
    ADD CONSTRAINT "live_clip_markers_pkey" PRIMARY KEY ("id");


--
-- Name: live_cohost_blocks live_cohost_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_cohost_blocks"
    ADD CONSTRAINT "live_cohost_blocks_pkey" PRIMARY KEY ("host_id", "blocked_user_id");


--
-- Name: live_cohosts live_cohosts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_cohosts"
    ADD CONSTRAINT "live_cohosts_pkey" PRIMARY KEY ("session_id", "user_id");


--
-- Name: live_comments live_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_comments"
    ADD CONSTRAINT "live_comments_pkey" PRIMARY KEY ("id");


--
-- Name: live_duet_history live_duet_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_duet_history"
    ADD CONSTRAINT "live_duet_history_pkey" PRIMARY KEY ("id");


--
-- Name: live_duet_invites live_duet_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_duet_invites"
    ADD CONSTRAINT "live_duet_invites_pkey" PRIMARY KEY ("id");


--
-- Name: live_giveaway_entries live_giveaway_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_giveaway_entries"
    ADD CONSTRAINT "live_giveaway_entries_pkey" PRIMARY KEY ("giveaway_id", "user_id");


--
-- Name: live_giveaways live_giveaways_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_giveaways"
    ADD CONSTRAINT "live_giveaways_pkey" PRIMARY KEY ("id");


--
-- Name: live_moderators live_moderators_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_moderators"
    ADD CONSTRAINT "live_moderators_pkey" PRIMARY KEY ("session_id", "user_id");


--
-- Name: live_placed_products live_placed_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_placed_products"
    ADD CONSTRAINT "live_placed_products_pkey" PRIMARY KEY ("id");


--
-- Name: live_poll_votes live_poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_poll_votes"
    ADD CONSTRAINT "live_poll_votes_pkey" PRIMARY KEY ("poll_id", "user_id");


--
-- Name: live_polls live_polls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_polls"
    ADD CONSTRAINT "live_polls_pkey" PRIMARY KEY ("id");


--
-- Name: live_reactions live_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_reactions"
    ADD CONSTRAINT "live_reactions_pkey" PRIMARY KEY ("id");


--
-- Name: live_recordings live_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_recordings"
    ADD CONSTRAINT "live_recordings_pkey" PRIMARY KEY ("id");


--
-- Name: live_reports live_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_reports"
    ADD CONSTRAINT "live_reports_pkey" PRIMARY KEY ("id");


--
-- Name: live_session_viewers live_session_viewers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_session_viewers"
    ADD CONSTRAINT "live_session_viewers_pkey" PRIMARY KEY ("session_id", "user_id");


--
-- Name: live_sessions live_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: live_stickers live_stickers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_stickers"
    ADD CONSTRAINT "live_stickers_pkey" PRIMARY KEY ("id");


--
-- Name: live_viewer_welcomes live_viewer_welcomes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_viewer_welcomes"
    ADD CONSTRAINT "live_viewer_welcomes_pkey" PRIMARY KEY ("session_id", "user_id");


--
-- Name: message_reactions message_reactions_message_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");


--
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id");


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");


--
-- Name: moderation_auto_flags moderation_auto_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_auto_flags"
    ADD CONSTRAINT "moderation_auto_flags_pkey" PRIMARY KEY ("id");


--
-- Name: muted_live_hosts muted_live_hosts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."muted_live_hosts"
    ADD CONSTRAINT "muted_live_hosts_pkey" PRIMARY KEY ("user_id", "host_id");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: order_disputes order_disputes_order_id_reporter_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_disputes"
    ADD CONSTRAINT "order_disputes_order_id_reporter_id_key" UNIQUE ("order_id", "reporter_id");


--
-- Name: order_disputes order_disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_disputes"
    ADD CONSTRAINT "order_disputes_pkey" PRIMARY KEY ("id");


--
-- Name: order_reviews order_reviews_order_id_reviewer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_reviews"
    ADD CONSTRAINT "order_reviews_order_id_reviewer_id_key" UNIQUE ("order_id", "reviewer_id");


--
-- Name: order_reviews order_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_reviews"
    ADD CONSTRAINT "order_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");


--
-- Name: payout_requests payout_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payout_requests"
    ADD CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id");


--
-- Name: post_drafts post_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_drafts"
    ADD CONSTRAINT "post_drafts_pkey" PRIMARY KEY ("id");


--
-- Name: post_dwell_log post_dwell_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_dwell_log"
    ADD CONSTRAINT "post_dwell_log_pkey" PRIMARY KEY ("user_id", "post_id");


--
-- Name: post_reports post_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_pkey" PRIMARY KEY ("id");


--
-- Name: post_reports post_reports_reporter_id_post_id_reason_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_reporter_id_post_id_reason_key" UNIQUE ("reporter_id", "post_id", "reason");


--
-- Name: post_views_log post_views_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_views_log"
    ADD CONSTRAINT "post_views_log_pkey" PRIMARY KEY ("post_id", "user_id");


--
-- Name: post_views post_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_views"
    ADD CONSTRAINT "post_views_pkey" PRIMARY KEY ("id");


--
-- Name: post_views post_views_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_views"
    ADD CONSTRAINT "post_views_post_id_user_id_key" UNIQUE ("post_id", "user_id");


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");


--
-- Name: preorder_rounds preorder_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preorder_rounds"
    ADD CONSTRAINT "preorder_rounds_pkey" PRIMARY KEY ("id");


--
-- Name: product_orders product_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_pkey" PRIMARY KEY ("id");


--
-- Name: product_orders product_orders_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_stripe_session_id_key" UNIQUE ("stripe_session_id");


--
-- Name: product_preorders product_preorders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_preorders"
    ADD CONSTRAINT "product_preorders_pkey" PRIMARY KEY ("id");


--
-- Name: product_preorders product_preorders_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_preorders"
    ADD CONSTRAINT "product_preorders_unique" UNIQUE ("product_id", "user_id");


--
-- Name: product_reviews product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: product_reviews product_reviews_reviewer_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_reviewer_id_product_id_key" UNIQUE ("reviewer_id", "product_id");


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: push_tokens push_tokens_user_token_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_token_unique" UNIQUE ("user_id", "token");


--
-- Name: r2_delete_queue r2_delete_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."r2_delete_queue"
    ADD CONSTRAINT "r2_delete_queue_pkey" PRIMARY KEY ("id");


--
-- Name: reposts reposts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_pkey" PRIMARY KEY ("id");


--
-- Name: reposts reposts_user_id_post_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_user_id_post_id_key" UNIQUE ("user_id", "post_id");


--
-- Name: saved_products saved_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."saved_products"
    ADD CONSTRAINT "saved_products_pkey" PRIMARY KEY ("id");


--
-- Name: saved_products saved_products_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."saved_products"
    ADD CONSTRAINT "saved_products_user_id_product_id_key" UNIQUE ("user_id", "product_id");


--
-- Name: scheduled_lives scheduled_lives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scheduled_lives"
    ADD CONSTRAINT "scheduled_lives_pkey" PRIMARY KEY ("id");


--
-- Name: scheduled_posts scheduled_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scheduled_posts"
    ADD CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id");


--
-- Name: seller_accounts seller_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seller_accounts"
    ADD CONSTRAINT "seller_accounts_pkey" PRIMARY KEY ("user_id");


--
-- Name: shop_banners shop_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."shop_banners"
    ADD CONSTRAINT "shop_banners_pkey" PRIMARY KEY ("id");


--
-- Name: stories stories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");


--
-- Name: story_comments story_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_comments"
    ADD CONSTRAINT "story_comments_pkey" PRIMARY KEY ("id");


--
-- Name: story_highlights story_highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_highlights"
    ADD CONSTRAINT "story_highlights_pkey" PRIMARY KEY ("id");


--
-- Name: story_highlights story_highlights_user_id_story_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_highlights"
    ADD CONSTRAINT "story_highlights_user_id_story_id_key" UNIQUE ("user_id", "story_id");


--
-- Name: story_likes story_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_pkey" PRIMARY KEY ("id");


--
-- Name: story_likes story_likes_story_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_story_id_user_id_key" UNIQUE ("story_id", "user_id");


--
-- Name: story_views story_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_pkey" PRIMARY KEY ("id");


--
-- Name: story_views story_views_story_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_story_id_user_id_key" UNIQUE ("story_id", "user_id");


--
-- Name: story_votes story_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_votes"
    ADD CONSTRAINT "story_votes_pkey" PRIMARY KEY ("id");


--
-- Name: story_votes story_votes_story_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_votes"
    ADD CONSTRAINT "story_votes_story_id_user_id_key" UNIQUE ("story_id", "user_id");


--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id");


--
-- Name: user_reports user_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id");


--
-- Name: user_reports user_reports_reporter_id_reported_id_reason_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reporter_id_reported_id_reason_key" UNIQUE ("reporter_id", "reported_id", "reason");


--
-- Name: user_tag_affinity user_tag_affinity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_tag_affinity"
    ADD CONSTRAINT "user_tag_affinity_pkey" PRIMARY KEY ("user_id", "tag");


--
-- Name: user_vibe_profile user_vibe_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_vibe_profile"
    ADD CONSTRAINT "user_vibe_profile_pkey" PRIMARY KEY ("user_id");


--
-- Name: user_whip_ingresses user_whip_ingresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_whip_ingresses"
    ADD CONSTRAINT "user_whip_ingresses_pkey" PRIMARY KEY ("user_id");


--
-- Name: web_coin_orders web_coin_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."web_coin_orders"
    ADD CONSTRAINT "web_coin_orders_pkey" PRIMARY KEY ("id");


--
-- Name: web_coin_orders web_coin_orders_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."web_coin_orders"
    ADD CONSTRAINT "web_coin_orders_stripe_session_id_key" UNIQUE ("stripe_session_id");


--
-- Name: web_push_subscriptions web_push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."web_push_subscriptions"
    ADD CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id");


--
-- Name: web_push_subscriptions web_push_user_endpoint_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."web_push_subscriptions"
    ADD CONSTRAINT "web_push_user_endpoint_unique" UNIQUE ("user_id", "endpoint");


--
-- Name: women_only_requests women_only_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."women_only_requests"
    ADD CONSTRAINT "women_only_requests_pkey" PRIMARY KEY ("user_id");


--
-- Name: auction_carts_one_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "auction_carts_one_open" ON "public"."auction_carts" USING "btree" ("buyer_id", "seller_id") WHERE ("status" = 'open'::"text");


--
-- Name: comment_likes_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "comment_likes_user_idx" ON "public"."comment_likes" USING "btree" ("user_id");


--
-- Name: conv_p1_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "conv_p1_idx" ON "public"."conversations" USING "btree" ("participant_1", "last_message_at" DESC);


--
-- Name: conv_p2_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "conv_p2_idx" ON "public"."conversations" USING "btree" ("participant_2", "last_message_at" DESC);


--
-- Name: follow_requests_receiver_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "follow_requests_receiver_idx" ON "public"."follow_requests" USING "btree" ("receiver_id");


--
-- Name: follow_requests_sender_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "follow_requests_sender_idx" ON "public"."follow_requests" USING "btree" ("sender_id");


--
-- Name: idx_admin_audit_log_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_audit_log_actor" ON "public"."admin_audit_log" USING "btree" ("actor_id", "created_at" DESC);


--
-- Name: idx_admin_audit_log_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_audit_log_target" ON "public"."admin_audit_log" USING "btree" ("target_type", "target_id", "created_at" DESC);


--
-- Name: idx_admin_campaign_daily_metrics_campaign_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_campaign_daily_metrics_campaign_date" ON "public"."admin_campaign_daily_metrics" USING "btree" ("campaign_id", "metric_date" DESC);


--
-- Name: idx_admin_campaigns_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_campaigns_status_updated" ON "public"."admin_campaigns" USING "btree" ("status", "updated_at" DESC);


--
-- Name: idx_admin_region_daily_metrics_country; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_region_daily_metrics_country" ON "public"."admin_region_daily_metrics" USING "btree" ("country_code", "metric_date" DESC);


--
-- Name: idx_admin_region_daily_metrics_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_region_daily_metrics_date" ON "public"."admin_region_daily_metrics" USING "btree" ("metric_date" DESC, "active_users" DESC);


--
-- Name: idx_admin_region_daily_metrics_total_profiles; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_region_daily_metrics_total_profiles" ON "public"."admin_region_daily_metrics" USING "btree" ("metric_date" DESC, "total_profiles" DESC);


--
-- Name: idx_admin_support_messages_thread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_support_messages_thread" ON "public"."admin_support_messages" USING "btree" ("thread_id", "created_at" DESC);


--
-- Name: idx_admin_support_threads_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_support_threads_status_priority" ON "public"."admin_support_threads" USING "btree" ("status", "priority", "last_message_at" DESC);


--
-- Name: idx_admin_support_threads_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_support_threads_user" ON "public"."admin_support_threads" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_ai_image_gen_cost_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_image_gen_cost_month" ON "public"."ai_image_generations" USING "btree" ("user_id", "created_at") WHERE ("cost_cents" > 0);


--
-- Name: idx_ai_image_gen_unconsumed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_image_gen_unconsumed" ON "public"."ai_image_generations" USING "btree" ("created_at") WHERE ("consumed_at" IS NULL);


--
-- Name: idx_ai_image_gen_user_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_image_gen_user_time" ON "public"."ai_image_generations" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_algo_experiments_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_algo_experiments_active" ON "public"."algo_experiments" USING "btree" ("is_active") WHERE ("is_active" = true);


--
-- Name: idx_algo_user_variants_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_algo_user_variants_lookup" ON "public"."algo_user_variants" USING "btree" ("user_id", "experiment_name");


--
-- Name: idx_auction_carts_reminder_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_auction_carts_reminder_due" ON "public"."auction_carts" USING "btree" ("closes_at") WHERE (("reminded_at" IS NULL) AND ("status" = ANY (ARRAY['open'::"text", 'checkout_pending'::"text"])));


--
-- Name: idx_battle_history_guest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_battle_history_guest" ON "public"."live_battle_history" USING "btree" ("guest_id", "ended_at" DESC);


--
-- Name: idx_battle_history_host; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_battle_history_host" ON "public"."live_battle_history" USING "btree" ("host_id", "ended_at" DESC);


--
-- Name: idx_bookmarks_user_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_bookmarks_user_post" ON "public"."bookmarks" USING "btree" ("user_id", "post_id");


--
-- Name: idx_chat_timeouts_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_chat_timeouts_session" ON "public"."live_chat_timeouts" USING "btree" ("session_id");


--
-- Name: idx_clip_markers_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clip_markers_session" ON "public"."live_clip_markers" USING "btree" ("session_id", "ts_secs");


--
-- Name: idx_clip_markers_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clip_markers_user" ON "public"."live_clip_markers" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_cohost_blocks_blocked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cohost_blocks_blocked" ON "public"."live_cohost_blocks" USING "btree" ("blocked_user_id");


--
-- Name: idx_cohost_blocks_host; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cohost_blocks_host" ON "public"."live_cohost_blocks" USING "btree" ("host_id");


--
-- Name: idx_coin_purchases_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_coin_purchases_transaction_id" ON "public"."coin_purchases" USING "btree" ("transaction_id");


--
-- Name: idx_coin_purchases_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_coin_purchases_user_id" ON "public"."coin_purchases" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_comment_likes_comment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_comment_likes_comment" ON "public"."comment_likes" USING "btree" ("comment_id");


--
-- Name: idx_comment_likes_user_comment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_comment_likes_user_comment" ON "public"."comment_likes" USING "btree" ("user_id", "comment_id");


--
-- Name: idx_comments_parent_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_comments_parent_created" ON "public"."comments" USING "btree" ("parent_id", "created_at") WHERE ("parent_id" IS NOT NULL);


--
-- Name: idx_comments_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_comments_parent_id" ON "public"."comments" USING "btree" ("parent_id");


--
-- Name: idx_comments_post_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_comments_post_created" ON "public"."comments" USING "btree" ("post_id", "created_at" DESC);


--
-- Name: idx_comments_post_parent_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_comments_post_parent_created_at_id" ON "public"."comments" USING "btree" ("post_id", "parent_id", "created_at", "id");


--
-- Name: idx_comments_post_root_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_comments_post_root_created_at_id" ON "public"."comments" USING "btree" ("post_id", "created_at", "id") WHERE ("parent_id" IS NULL);


--
-- Name: idx_content_reports_pending_sla; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_content_reports_pending_sla" ON "public"."content_reports" USING "btree" ("status", "created_at") WHERE ("status" = 'pending'::"text");


--
-- Name: idx_creator_tips_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_creator_tips_recipient" ON "public"."creator_tips" USING "btree" ("recipient_id", "created_at" DESC);


--
-- Name: idx_creator_tips_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_creator_tips_sender" ON "public"."creator_tips" USING "btree" ("sender_id", "created_at" DESC);


--
-- Name: idx_duet_history_guest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_duet_history_guest" ON "public"."live_duet_history" USING "btree" ("guest_id", "started_at" DESC);


--
-- Name: idx_duet_history_host; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_duet_history_host" ON "public"."live_duet_history" USING "btree" ("host_id", "started_at" DESC);


--
-- Name: idx_duet_history_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_duet_history_session" ON "public"."live_duet_history" USING "btree" ("session_id");


--
-- Name: idx_duet_invites_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_duet_invites_expires" ON "public"."live_duet_invites" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"text");


--
-- Name: idx_duet_invites_host_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_duet_invites_host_pending" ON "public"."live_duet_invites" USING "btree" ("host_id", "created_at" DESC) WHERE ("status" = 'pending'::"text");


--
-- Name: idx_duet_invites_invitee_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_duet_invites_invitee_pending" ON "public"."live_duet_invites" USING "btree" ("invitee_id", "created_at" DESC) WHERE ("status" = 'pending'::"text");


--
-- Name: idx_dwell_log_user_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_dwell_log_user_post" ON "public"."post_dwell_log" USING "btree" ("user_id", "post_id");


--
-- Name: idx_follows_follower_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_follows_follower_id" ON "public"."follows" USING "btree" ("follower_id");


--
-- Name: idx_follows_following_follower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_follows_following_follower" ON "public"."follows" USING "btree" ("following_id", "follower_id");


--
-- Name: idx_follows_following_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_follows_following_id" ON "public"."follows" USING "btree" ("following_id");


--
-- Name: idx_follows_pair; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_follows_pair" ON "public"."follows" USING "btree" ("follower_id", "following_id");


--
-- Name: idx_gift_catalog_window; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_gift_catalog_window" ON "public"."gift_catalog" USING "btree" ("available_from", "available_until");


--
-- Name: idx_gift_tx_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_gift_tx_recipient" ON "public"."gift_transactions" USING "btree" ("recipient_id", "created_at" DESC);


--
-- Name: idx_gift_tx_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_gift_tx_sender" ON "public"."gift_transactions" USING "btree" ("sender_id", "created_at" DESC);


--
-- Name: idx_gift_tx_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_gift_tx_session" ON "public"."gift_transactions" USING "btree" ("live_session_id", "created_at" DESC);


--
-- Name: idx_likes_user_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_likes_user_post" ON "public"."likes" USING "btree" ("user_id", "post_id");


--
-- Name: idx_live_cohosts_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_cohosts_session" ON "public"."live_cohosts" USING "btree" ("session_id") WHERE ("revoked_at" IS NULL);


--
-- Name: idx_live_cohosts_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_cohosts_user" ON "public"."live_cohosts" USING "btree" ("user_id") WHERE ("revoked_at" IS NULL);


--
-- Name: idx_live_comments_session_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_comments_session_created" ON "public"."live_comments" USING "btree" ("session_id", "created_at" DESC);


--
-- Name: idx_live_comments_session_pinned_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_comments_session_pinned_created" ON "public"."live_comments" USING "btree" ("session_id", "pinned" DESC, "created_at" DESC);


--
-- Name: idx_live_comments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_comments_user_id" ON "public"."live_comments" USING "btree" ("user_id");


--
-- Name: idx_live_moderators_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_moderators_session" ON "public"."live_moderators" USING "btree" ("session_id");


--
-- Name: idx_live_placed_products_session_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_placed_products_session_active" ON "public"."live_placed_products" USING "btree" ("session_id", "created_at" DESC) WHERE ("removed_at" IS NULL);


--
-- Name: idx_live_poll_votes_poll; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_poll_votes_poll" ON "public"."live_poll_votes" USING "btree" ("poll_id");


--
-- Name: idx_live_polls_session_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_polls_session_active" ON "public"."live_polls" USING "btree" ("session_id", "created_at" DESC) WHERE ("closed_at" IS NULL);


--
-- Name: idx_live_reactions_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_reactions_session" ON "public"."live_reactions" USING "btree" ("session_id", "created_at" DESC);


--
-- Name: idx_live_recordings_host; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_recordings_host" ON "public"."live_recordings" USING "btree" ("host_id", "started_at" DESC);


--
-- Name: idx_live_recordings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_recordings_status" ON "public"."live_recordings" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['ready'::"text", 'recording'::"text"]));


--
-- Name: idx_live_session_viewers_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_session_viewers_session" ON "public"."live_session_viewers" USING "btree" ("session_id");


--
-- Name: idx_live_session_viewers_user_joined; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_session_viewers_user_joined" ON "public"."live_session_viewers" USING "btree" ("user_id", "joined_at" DESC);


--
-- Name: idx_live_sessions_active_full; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_active_full" ON "public"."live_sessions" USING "btree" ("status", "started_at" DESC, "viewer_count" DESC) WHERE ("status" = 'active'::"text");


--
-- Name: idx_live_sessions_active_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_active_listing" ON "public"."live_sessions" USING "btree" ("viewer_count" DESC, "started_at", "id") WHERE ("status" = 'active'::"text");


--
-- Name: idx_live_sessions_active_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_active_updated" ON "public"."live_sessions" USING "btree" ("updated_at") WHERE ("status" = 'active'::"text");


--
-- Name: idx_live_sessions_followers_only; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_followers_only" ON "public"."live_sessions" USING "btree" ("followers_only") WHERE ("followers_only" = true);


--
-- Name: idx_live_sessions_host_active_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_host_active_started" ON "public"."live_sessions" USING "btree" ("host_id", "started_at" DESC, "id") WHERE ("status" = 'active'::"text");


--
-- Name: idx_live_sessions_host_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_host_id" ON "public"."live_sessions" USING "btree" ("host_id");


--
-- Name: idx_live_sessions_host_public_active_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_host_public_active_started" ON "public"."live_sessions" USING "btree" ("host_id", "started_at" DESC, "id") WHERE (("status" = 'active'::"text") AND ("women_only" = false));


--
-- Name: idx_live_sessions_ingress; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_ingress" ON "public"."live_sessions" USING "btree" ("ingress_id") WHERE ("ingress_id" IS NOT NULL);


--
-- Name: idx_live_sessions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_status" ON "public"."live_sessions" USING "btree" ("status");


--
-- Name: idx_live_sessions_status_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_status_started" ON "public"."live_sessions" USING "btree" ("status", "started_at" DESC) WHERE ("status" = 'active'::"text");


--
-- Name: idx_live_sessions_women_only; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_sessions_women_only" ON "public"."live_sessions" USING "btree" ("women_only") WHERE ("women_only" = true);


--
-- Name: idx_live_stickers_session_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_stickers_session_active" ON "public"."live_stickers" USING "btree" ("session_id", "created_at" DESC) WHERE ("removed_at" IS NULL);


--
-- Name: idx_live_viewer_welcomes_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_live_viewer_welcomes_session" ON "public"."live_viewer_welcomes" USING "btree" ("session_id", "created_at" DESC);


--
-- Name: idx_messages_unread_by_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_messages_unread_by_conversation" ON "public"."messages" USING "btree" ("conversation_id", "sender_id") WHERE ("read" = false);


--
-- Name: idx_moderation_auto_flags_reason_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moderation_auto_flags_reason_created" ON "public"."moderation_auto_flags" USING "btree" ("reason", "created_at" DESC);


--
-- Name: idx_moderation_auto_flags_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moderation_auto_flags_target" ON "public"."moderation_auto_flags" USING "btree" ("target_type", "target_id", "created_at" DESC);


--
-- Name: idx_muted_live_hosts_host; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_muted_live_hosts_host" ON "public"."muted_live_hosts" USING "btree" ("host_id", "user_id");


--
-- Name: idx_notifications_live_unread_age; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notifications_live_unread_age" ON "public"."notifications" USING "btree" ("created_at") WHERE (("read" = false) AND ("type" = ANY (ARRAY['live'::"text", 'scheduled_live_reminder'::"text"])));


--
-- Name: idx_notifications_live_unread_recipient_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notifications_live_unread_recipient_sender" ON "public"."notifications" USING "btree" ("recipient_id", "sender_id", "created_at" DESC) WHERE (("read" = false) AND ("type" = ANY (ARRAY['live'::"text", 'scheduled_live_reminder'::"text"])));


--
-- Name: idx_notifications_recipient_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notifications_recipient_created" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);


--
-- Name: idx_notifications_recipient_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notifications_recipient_type" ON "public"."notifications" USING "btree" ("recipient_id", "type", "created_at" DESC);


--
-- Name: idx_notifications_recipient_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notifications_recipient_unread" ON "public"."notifications" USING "btree" ("recipient_id", "read") WHERE ("read" = false);


--
-- Name: idx_notifications_unread_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notifications_unread_created" ON "public"."notifications" USING "btree" ("created_at") WHERE ("read" = false);


--
-- Name: idx_notifications_unread_type_age; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notifications_unread_type_age" ON "public"."notifications" USING "btree" ("type", "created_at") WHERE ("read" = false);


--
-- Name: idx_order_disputes_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_order_disputes_order" ON "public"."order_disputes" USING "btree" ("order_id");


--
-- Name: idx_order_disputes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_order_disputes_status" ON "public"."order_disputes" USING "btree" ("status") WHERE ("status" = 'open'::"text");


--
-- Name: idx_order_reviews_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_order_reviews_order" ON "public"."order_reviews" USING "btree" ("order_id");


--
-- Name: idx_order_reviews_reviewee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_order_reviews_reviewee" ON "public"."order_reviews" USING "btree" ("reviewee_id");


--
-- Name: idx_orders_buyer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_buyer_id" ON "public"."orders" USING "btree" ("buyer_id", "created_at" DESC);


--
-- Name: idx_orders_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_product_id" ON "public"."orders" USING "btree" ("product_id");


--
-- Name: idx_orders_seller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_seller_id" ON "public"."orders" USING "btree" ("seller_id", "created_at" DESC);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");


--
-- Name: idx_post_drafts_author_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_post_drafts_author_updated" ON "public"."post_drafts" USING "btree" ("author_id", "updated_at" DESC);


--
-- Name: idx_post_dwell_log_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_post_dwell_log_user_id" ON "public"."post_dwell_log" USING "btree" ("user_id");


--
-- Name: idx_post_dwell_log_user_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_post_dwell_log_user_post" ON "public"."post_dwell_log" USING "btree" ("user_id", "post_id");


--
-- Name: idx_post_reports_post_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_post_reports_post_id" ON "public"."post_reports" USING "btree" ("post_id");


--
-- Name: idx_post_reports_reporter_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_post_reports_reporter_id" ON "public"."post_reports" USING "btree" ("reporter_id");


--
-- Name: idx_post_views_log_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_post_views_log_user_id" ON "public"."post_views_log" USING "btree" ("user_id");


--
-- Name: idx_post_views_user_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_post_views_user_post" ON "public"."post_views" USING "btree" ("user_id", "post_id");


--
-- Name: idx_posts_aspect_ratio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_aspect_ratio" ON "public"."posts" USING "btree" ("aspect_ratio") WHERE ("aspect_ratio" <> 'portrait'::"text");


--
-- Name: idx_posts_audio_url; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_audio_url" ON "public"."posts" USING "btree" ("audio_url") WHERE ("audio_url" IS NOT NULL);


--
-- Name: idx_posts_author_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_author_created" ON "public"."posts" USING "btree" ("author_id", "created_at" DESC);


--
-- Name: idx_posts_author_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_author_created_at_id" ON "public"."posts" USING "btree" ("author_id", "created_at" DESC, "id" DESC);


--
-- Name: idx_posts_author_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_author_id" ON "public"."posts" USING "btree" ("author_id", "dwell_time_score" DESC NULLS LAST);


--
-- Name: idx_posts_author_privacy_visible; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_author_privacy_visible" ON "public"."posts" USING "btree" ("author_id", "privacy", "created_at" DESC, "id" DESC) WHERE ("women_only" = false);


--
-- Name: idx_posts_author_profile_likes; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_author_profile_likes" ON "public"."posts" USING "btree" ("author_id", COALESCE("is_pinned", false) DESC, COALESCE("like_count", 0) DESC, "created_at" DESC, "id" DESC);


--
-- Name: idx_posts_author_profile_newest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_author_profile_newest" ON "public"."posts" USING "btree" ("author_id", COALESCE("is_pinned", false) DESC, "created_at" DESC, "id" DESC);


--
-- Name: idx_posts_author_profile_views; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_author_profile_views" ON "public"."posts" USING "btree" ("author_id", COALESCE("is_pinned", false) DESC, COALESCE("view_count", 0) DESC, "created_at" DESC, "id" DESC);


--
-- Name: idx_posts_author_public_profile_count; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_author_public_profile_count" ON "public"."posts" USING "btree" ("author_id") WHERE (("privacy" = 'public'::"text") AND ("women_only" = false));


--
-- Name: idx_posts_bookmark_count; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_bookmark_count" ON "public"."posts" USING "btree" ("bookmark_count" DESC) WHERE ("bookmark_count" > 0);


--
-- Name: idx_posts_bunny_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_bunny_pending" ON "public"."posts" USING "btree" ("created_at" DESC) WHERE (("bunny_status" IS NULL) AND ("media_type" = 'video'::"text"));


--
-- Name: idx_posts_bunny_video_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_bunny_video_id" ON "public"."posts" USING "btree" ("bunny_video_id") WHERE ("bunny_video_id" IS NOT NULL);


--
-- Name: idx_posts_comment_count; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_comment_count" ON "public"."posts" USING "btree" ("comment_count" DESC) WHERE ("comment_count" > 0);


--
-- Name: idx_posts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);


--
-- Name: idx_posts_feed_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_feed_score" ON "public"."posts" USING "btree" ("dwell_time_score" DESC NULLS LAST, "created_at" DESC) WHERE ("is_guild_post" IS NOT TRUE);


--
-- Name: idx_posts_like_count; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_like_count" ON "public"."posts" USING "btree" ("like_count" DESC) WHERE ("like_count" > 0);


--
-- Name: idx_posts_privacy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_privacy" ON "public"."posts" USING "btree" ("privacy") WHERE (NOT "is_guild_post");


--
-- Name: idx_posts_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_product_id" ON "public"."posts" USING "btree" ("product_id") WHERE ("product_id" IS NOT NULL);


--
-- Name: idx_posts_public_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_public_created_at_id" ON "public"."posts" USING "btree" ("created_at" DESC, "id" DESC) WHERE ("privacy" = 'public'::"text");


--
-- Name: idx_posts_public_tags_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_public_tags_gin" ON "public"."posts" USING "gin" ("tags") WHERE ("privacy" = 'public'::"text");


--
-- Name: idx_posts_public_view_count_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_public_view_count_id" ON "public"."posts" USING "btree" ("view_count" DESC NULLS LAST, "id" DESC) WHERE ("privacy" = 'public'::"text");


--
-- Name: idx_posts_public_visible_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_public_visible_created_at_id" ON "public"."posts" USING "btree" ("created_at" DESC, "id" DESC) WHERE (("privacy" = 'public'::"text") AND (COALESCE("women_only", false) = false));


--
-- Name: idx_posts_public_visible_recent_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_public_visible_recent_tags" ON "public"."posts" USING "btree" ("created_at" DESC, "id" DESC) WHERE (("privacy" = 'public'::"text") AND (COALESCE("women_only", false) = false) AND ("tags" IS NOT NULL));


--
-- Name: idx_posts_public_visible_trending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_public_visible_trending" ON "public"."posts" USING "btree" ("view_count" DESC, "created_at" DESC, "id" DESC) WHERE (("privacy" = 'public'::"text") AND (COALESCE("women_only", false) = false));


--
-- Name: idx_posts_tags_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_tags_gin" ON "public"."posts" USING "gin" ("tags");


--
-- Name: idx_posts_view_count; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_view_count" ON "public"."posts" USING "btree" ("view_count" DESC);


--
-- Name: idx_posts_women_only; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_posts_women_only" ON "public"."posts" USING "btree" ("women_only") WHERE ("women_only" = true);


--
-- Name: idx_preorder_rounds_one_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_preorder_rounds_one_open" ON "public"."preorder_rounds" USING "btree" ("product_id") WHERE ("status" = 'open'::"text");


--
-- Name: idx_preorder_rounds_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_preorder_rounds_status" ON "public"."preorder_rounds" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_preorders_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_preorders_product" ON "public"."product_preorders" USING "btree" ("product_id");


--
-- Name: idx_preorders_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_preorders_round" ON "public"."product_preorders" USING "btree" ("round_id") WHERE ("round_id" IS NOT NULL);


--
-- Name: idx_preorders_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_preorders_user" ON "public"."product_preorders" USING "btree" ("user_id");


--
-- Name: idx_product_orders_buyer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_orders_buyer" ON "public"."product_orders" USING "btree" ("buyer_id", "created_at" DESC);


--
-- Name: idx_product_orders_seller; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_orders_seller" ON "public"."product_orders" USING "btree" ("seller_id", "created_at" DESC);


--
-- Name: idx_product_orders_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_orders_session" ON "public"."product_orders" USING "btree" ("stripe_session_id") WHERE ("stripe_session_id" IS NOT NULL);


--
-- Name: idx_product_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_orders_status" ON "public"."product_orders" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_active" ON "public"."products" USING "btree" ("is_active", "created_at" DESC);


--
-- Name: idx_products_active_public_popular; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_active_public_popular" ON "public"."products" USING "btree" ("sold_count" DESC, "created_at" DESC, "id") WHERE (("is_active" = true) AND ("women_only" = false));


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category");


--
-- Name: idx_products_sale_mode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_sale_mode" ON "public"."products" USING "btree" ("sale_mode") WHERE ("sale_mode" <> 'coins'::"text");


--
-- Name: idx_products_sale_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_sale_price" ON "public"."products" USING "btree" ("sale_price_coins") WHERE ("sale_price_coins" IS NOT NULL);


--
-- Name: idx_products_seller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_seller_id" ON "public"."products" USING "btree" ("seller_id");


--
-- Name: idx_products_women_only; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_women_only" ON "public"."products" USING "btree" ("women_only") WHERE ("women_only" = true);


--
-- Name: idx_profiles_country_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_country_code" ON "public"."profiles" USING "btree" ("country_code") WHERE ("country_code" IS NOT NULL);


--
-- Name: idx_profiles_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_created_at_id" ON "public"."profiles" USING "btree" ("created_at" DESC, "id" DESC);


--
-- Name: idx_profiles_guild; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_guild" ON "public"."profiles" USING "btree" ("guild_id") WHERE ("guild_id" IS NOT NULL);


--
-- Name: idx_profiles_guild_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_guild_id" ON "public"."profiles" USING "btree" ("guild_id");


--
-- Name: idx_profiles_is_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_is_creator" ON "public"."profiles" USING "btree" ("is_creator") WHERE ("is_creator" = true);


--
-- Name: idx_profiles_is_verified; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_is_verified" ON "public"."profiles" USING "btree" ("is_verified") WHERE ("is_verified" = true);


--
-- Name: idx_profiles_lower_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_lower_username" ON "public"."profiles" USING "btree" ("lower"("username"));


--
-- Name: idx_profiles_moderation_flags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_moderation_flags" ON "public"."profiles" USING "btree" ("is_banned", "is_restricted", "is_shadow_banned") WHERE (("is_banned" = true) OR ("is_restricted" = true) OR ("is_shadow_banned" = true));


--
-- Name: idx_profiles_public_discover_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_public_discover_created_at_id" ON "public"."profiles" USING "btree" ("created_at" DESC, "id" DESC) WHERE (("username" IS NOT NULL) AND (COALESCE("is_private", false) = false));


--
-- Name: idx_profiles_public_discover_visible_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_public_discover_visible_created_at_id" ON "public"."profiles" USING "btree" ("created_at" DESC, "id" DESC) WHERE (("username" IS NOT NULL) AND (COALESCE("is_private", false) = false) AND (COALESCE("is_banned", false) = false) AND (COALESCE("is_shadow_banned", false) = false));


--
-- Name: idx_profiles_public_display_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_public_display_name_trgm" ON "public"."profiles" USING "gin" ("lower"("display_name") "public"."gin_trgm_ops") WHERE (("display_name" IS NOT NULL) AND (COALESCE("is_private", false) = false));


--
-- Name: idx_profiles_public_username_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_public_username_trgm" ON "public"."profiles" USING "gin" ("lower"("username") "public"."gin_trgm_ops") WHERE (("username" IS NOT NULL) AND (COALESCE("is_private", false) = false));


--
-- Name: idx_profiles_referred_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_referred_by" ON "public"."profiles" USING "btree" ("referred_by") WHERE ("referred_by" IS NOT NULL);


--
-- Name: idx_profiles_username_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_username_gin" ON "public"."profiles" USING "gin" ("username" "public"."gin_trgm_ops");


--
-- Name: idx_profiles_women_only_verified; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_women_only_verified" ON "public"."profiles" USING "btree" ("women_only_verified") WHERE ("women_only_verified" = true);


--
-- Name: idx_push_tokens_user_app; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_push_tokens_user_app" ON "public"."push_tokens" USING "btree" ("user_id", "app");


--
-- Name: idx_push_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_push_tokens_user_id" ON "public"."push_tokens" USING "btree" ("user_id");


--
-- Name: idx_r2_delete_queue_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_r2_delete_queue_pending" ON "public"."r2_delete_queue" USING "btree" ("created_at") WHERE ("status" = 'pending'::"text");


--
-- Name: idx_reports_reporter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reports_reporter" ON "public"."content_reports" USING "btree" ("reporter_id");


--
-- Name: idx_reports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reports_status" ON "public"."content_reports" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_reports_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reports_target" ON "public"."content_reports" USING "btree" ("target_type", "target_id");


--
-- Name: idx_reposts_user_post; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reposts_user_post" ON "public"."reposts" USING "btree" ("user_id", "post_id");


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reviews_product" ON "public"."product_reviews" USING "btree" ("product_id", "created_at" DESC);


--
-- Name: idx_reviews_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reviews_reviewer" ON "public"."product_reviews" USING "btree" ("reviewer_id");


--
-- Name: idx_saved_products_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_saved_products_product" ON "public"."saved_products" USING "btree" ("product_id");


--
-- Name: idx_saved_products_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_saved_products_user" ON "public"."saved_products" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_scheduled_lives_host_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_scheduled_lives_host_status" ON "public"."scheduled_lives" USING "btree" ("host_id", "status", "scheduled_at");


--
-- Name: idx_scheduled_lives_ready; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_scheduled_lives_ready" ON "public"."scheduled_lives" USING "btree" ("scheduled_at") WHERE ("status" = 'scheduled'::"text");


--
-- Name: idx_scheduled_lives_upcoming; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_scheduled_lives_upcoming" ON "public"."scheduled_lives" USING "btree" ("scheduled_at") WHERE ("status" = ANY (ARRAY['scheduled'::"text", 'reminded'::"text"]));


--
-- Name: idx_scheduled_posts_author_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_scheduled_posts_author_status" ON "public"."scheduled_posts" USING "btree" ("author_id", "status", "publish_at");


--
-- Name: idx_scheduled_posts_ready; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_scheduled_posts_ready" ON "public"."scheduled_posts" USING "btree" ("publish_at") WHERE ("status" = 'pending'::"text");


--
-- Name: idx_shop_banners_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_shop_banners_active" ON "public"."shop_banners" USING "btree" ("sort_order") WHERE ("active" = true);


--
-- Name: idx_stories_user_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_stories_user_archived" ON "public"."stories" USING "btree" ("user_id", "archived", "created_at" DESC);


--
-- Name: idx_stories_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_stories_user_created" ON "public"."stories" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_story_highlights_post_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_story_highlights_post_id" ON "public"."story_highlights" USING "btree" ("post_id");


--
-- Name: idx_story_highlights_story_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_story_highlights_story_id" ON "public"."story_highlights" USING "btree" ("story_id");


--
-- Name: idx_story_highlights_user_created_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_story_highlights_user_created_id" ON "public"."story_highlights" USING "btree" ("user_id", "created_at", "id");


--
-- Name: idx_user_reports_reported; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_reports_reported" ON "public"."user_reports" USING "btree" ("reported_id");


--
-- Name: idx_user_reports_reporter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_reports_reporter" ON "public"."user_reports" USING "btree" ("reporter_id");


--
-- Name: idx_user_vibe_profile_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_vibe_profile_user" ON "public"."user_vibe_profile" USING "btree" ("user_id");


--
-- Name: idx_web_coin_orders_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_web_coin_orders_session" ON "public"."web_coin_orders" USING "btree" ("stripe_session_id") WHERE ("stripe_session_id" IS NOT NULL);


--
-- Name: idx_web_coin_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_web_coin_orders_status" ON "public"."web_coin_orders" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_web_coin_orders_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_web_coin_orders_user_date" ON "public"."web_coin_orders" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_web_push_subs_recent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_web_push_subs_recent" ON "public"."web_push_subscriptions" USING "btree" ("user_id", "last_seen_at" DESC);


--
-- Name: idx_web_push_subs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_web_push_subs_user_id" ON "public"."web_push_subscriptions" USING "btree" ("user_id");


--
-- Name: idx_woz_requests_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_woz_requests_pending" ON "public"."women_only_requests" USING "btree" ("requested_at") WHERE ("status" = 'pending'::"text");


--
-- Name: live_auctions_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "live_auctions_due" ON "public"."live_auctions" USING "btree" ("ends_at") WHERE ("status" = 'running'::"text");


--
-- Name: live_auctions_session_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "live_auctions_session_order" ON "public"."live_auctions" USING "btree" ("session_id", "sort_index") WHERE ("status" = ANY (ARRAY['scheduled'::"text", 'running'::"text"]));


--
-- Name: live_auctions_winner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "live_auctions_winner" ON "public"."live_auctions" USING "btree" ("winner_id") WHERE ("status" = 'sold'::"text");


--
-- Name: live_auto_bids_ranking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "live_auto_bids_ranking" ON "public"."live_auto_bids" USING "btree" ("auction_id", "max_cents" DESC, "created_at");


--
-- Name: live_bids_auction_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "live_bids_auction_time" ON "public"."live_bids" USING "btree" ("auction_id", "created_at" DESC);


--
-- Name: live_bids_unique_amount; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "live_bids_unique_amount" ON "public"."live_bids" USING "btree" ("auction_id", "amount_cents");


--
-- Name: live_giveaways_one_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "live_giveaways_one_open" ON "public"."live_giveaways" USING "btree" ("session_id") WHERE ("status" = 'open'::"text");


--
-- Name: live_giveaways_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "live_giveaways_session" ON "public"."live_giveaways" USING "btree" ("session_id", "created_at" DESC);


--
-- Name: live_sessions_room_name_active_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "live_sessions_room_name_active_unique" ON "public"."live_sessions" USING "btree" ("room_name") WHERE ("status" = 'active'::"text");


--
-- Name: messages_reply_to_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "messages_reply_to_id_idx" ON "public"."messages" USING "btree" ("reply_to_id");


--
-- Name: msg_conv_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "msg_conv_idx" ON "public"."messages" USING "btree" ("conversation_id", "created_at");


--
-- Name: msg_post_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "msg_post_idx" ON "public"."messages" USING "btree" ("post_id") WHERE ("post_id" IS NOT NULL);


--
-- Name: notifications_session_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "notifications_session_idx" ON "public"."notifications" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);


--
-- Name: posts_author_pinned_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "posts_author_pinned_idx" ON "public"."posts" USING "btree" ("author_id", "is_pinned" DESC, "created_at" DESC);


--
-- Name: posts_feed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "posts_feed_idx" ON "public"."posts" USING "btree" ("created_at" DESC) WHERE ("is_visible" = true);


--
-- Name: posts_is_visible_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "posts_is_visible_created_idx" ON "public"."posts" USING "btree" ("created_at" DESC) WHERE ("is_visible" = true);


--
-- Name: product_orders_cart; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "product_orders_cart" ON "public"."product_orders" USING "btree" ("cart_id") WHERE ("cart_id" IS NOT NULL);


--
-- Name: profiles_teip_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "profiles_teip_idx" ON "public"."profiles" USING "btree" ("teip") WHERE ("teip" IS NOT NULL);


--
-- Name: reposts_post_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "reposts_post_id_idx" ON "public"."reposts" USING "btree" ("post_id");


--
-- Name: reposts_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "reposts_user_id_idx" ON "public"."reposts" USING "btree" ("user_id");


--
-- Name: story_comments_story_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "story_comments_story_id_idx" ON "public"."story_comments" USING "btree" ("story_id", "created_at" DESC);


--
-- Name: story_highlights_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "story_highlights_user_id_idx" ON "public"."story_highlights" USING "btree" ("user_id");


--
-- Name: story_votes_story_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "story_votes_story_idx" ON "public"."story_votes" USING "btree" ("story_id");


--
-- Name: uniq_live_placed_products_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uniq_live_placed_products_active" ON "public"."live_placed_products" USING "btree" ("session_id", "product_id") WHERE ("removed_at" IS NULL);


--
-- Name: uq_clip_marker_session_user_ts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uq_clip_marker_session_user_ts" ON "public"."live_clip_markers" USING "btree" ("session_id", "user_id", "ts_secs");


--
-- Name: uq_duet_invites_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uq_duet_invites_pending" ON "public"."live_duet_invites" USING "btree" ("session_id", "invitee_id") WHERE ("status" = 'pending'::"text");


--
-- Name: uq_live_recordings_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uq_live_recordings_session" ON "public"."live_recordings" USING "btree" ("session_id");


--
-- Name: posts auto_vibe_scores; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "auto_vibe_scores" BEFORE INSERT OR UPDATE OF "tags", "caption" ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_vibe_scores"();


--
-- Name: posts enqueue_r2_media_delete_on_post_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "enqueue_r2_media_delete_on_post_delete" AFTER DELETE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_r2_media_delete"();


--
-- Name: comments on_comment_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_comment_insert" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_comment"();


--
-- Name: comments on_comment_notif; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_comment_notif" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_comment_to_table"();


--
-- Name: follows on_follow_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_follow_insert" AFTER INSERT ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_follow"();


--
-- Name: follows on_follow_notif; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_follow_notif" AFTER INSERT ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_follow_to_table"();


--
-- Name: likes on_like_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_like_insert" AFTER INSERT ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_like"();


--
-- Name: likes on_like_notif; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_like_notif" AFTER INSERT ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_like_to_table"();


--
-- Name: live_sessions on_live_session_active; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_live_session_active" AFTER INSERT OR UPDATE OF "status" ON "public"."live_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_followers_on_live"();


--
-- Name: messages on_message_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_message_insert" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_dm"();


--
-- Name: messages on_message_insert_web_push; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_message_insert_web_push" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_web_push_on_dm"();


--
-- Name: messages on_new_message; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_new_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_timestamp"();


--
-- Name: posts on_post_insert_moderate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_post_insert_moderate" AFTER INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_nsfw_moderation"();


--
-- Name: profiles on_profile_created_create_wallet; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_profile_created_create_wallet" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_user_wallet"();


--
-- Name: admin_campaign_daily_metrics set_admin_campaign_daily_metrics_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_admin_campaign_daily_metrics_updated_at" BEFORE UPDATE ON "public"."admin_campaign_daily_metrics" FOR EACH ROW EXECUTE FUNCTION "public"."set_admin_campaign_updated_at"();


--
-- Name: admin_campaigns set_admin_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_admin_campaigns_updated_at" BEFORE UPDATE ON "public"."admin_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."set_admin_campaign_updated_at"();


--
-- Name: admin_region_daily_metrics set_admin_region_daily_metrics_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_admin_region_daily_metrics_updated_at" BEFORE INSERT OR UPDATE ON "public"."admin_region_daily_metrics" FOR EACH ROW EXECUTE FUNCTION "public"."set_admin_region_metric_updated_at"();


--
-- Name: admin_support_threads trg_admin_support_threads_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_admin_support_threads_updated_at" BEFORE UPDATE ON "public"."admin_support_threads" FOR EACH ROW EXECUTE FUNCTION "public"."set_admin_support_thread_updated_at"();


--
-- Name: product_preorders trg_assign_preorder_round; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_assign_preorder_round" BEFORE INSERT OR UPDATE OF "status", "quantity" ON "public"."product_preorders" FOR EACH ROW EXECUTE FUNCTION "public"."assign_preorder_round"();


--
-- Name: posts trg_auto_score_post; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_auto_score_post" BEFORE INSERT OR UPDATE OF "tags" ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."auto_score_post"();


--
-- Name: bookmarks trg_bookmark_learn; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_bookmark_learn" AFTER INSERT ON "public"."bookmarks" FOR EACH ROW EXECUTE FUNCTION "public"."_on_bookmark_learn"();


--
-- Name: live_recordings trg_clear_replay_on_recording_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_clear_replay_on_recording_delete" AFTER DELETE ON "public"."live_recordings" FOR EACH ROW EXECUTE FUNCTION "public"."_clear_replay_on_recording_delete"();


--
-- Name: product_orders trg_close_cart_on_order_paid; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_close_cart_on_order_paid" AFTER UPDATE ON "public"."product_orders" FOR EACH ROW EXECUTE FUNCTION "public"."close_cart_on_order_paid"();


--
-- Name: live_cohosts trg_close_duet_history_on_revoke; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_close_duet_history_on_revoke" AFTER UPDATE ON "public"."live_cohosts" FOR EACH ROW EXECUTE FUNCTION "public"."_close_duet_history_on_revoke"();


--
-- Name: live_sessions trg_close_duet_history_on_session_end; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_close_duet_history_on_session_end" AFTER UPDATE ON "public"."live_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."_close_duet_history_on_session_end"();


--
-- Name: comments trg_comment_learn; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_comment_learn" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."_on_comment_learn"();


--
-- Name: comments trg_comment_not_blocked; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_comment_not_blocked" BEFORE INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_comment_not_blocked"();


--
-- Name: conversations trg_conversation_not_blocked; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_conversation_not_blocked" BEFORE INSERT ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_conversation_not_blocked"();


--
-- Name: follows trg_follow_not_blocked; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_follow_not_blocked" BEFORE INSERT ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_follow_not_blocked"();


--
-- Name: profiles trg_guard_women_only_verified; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_guard_women_only_verified" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_women_only_verified"();


--
-- Name: live_giveaway_entries trg_incr_giveaway_entries; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_incr_giveaway_entries" AFTER INSERT ON "public"."live_giveaway_entries" FOR EACH ROW EXECUTE FUNCTION "public"."incr_giveaway_entries"();


--
-- Name: likes trg_like_learn; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_like_learn" AFTER INSERT ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."_on_like_learn"();


--
-- Name: live_comments trg_live_comment_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_live_comment_count" AFTER INSERT ON "public"."live_comments" FOR EACH ROW EXECUTE FUNCTION "public"."incr_live_comment_count"();


--
-- Name: live_placed_products trg_live_placed_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_live_placed_products_updated_at" BEFORE UPDATE ON "public"."live_placed_products" FOR EACH ROW EXECUTE FUNCTION "public"."_set_live_placed_products_updated_at"();


--
-- Name: live_sessions trg_live_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_live_sessions_updated_at" BEFORE UPDATE ON "public"."live_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."_set_live_sessions_updated_at"();


--
-- Name: live_stickers trg_live_stickers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_live_stickers_updated_at" BEFORE UPDATE ON "public"."live_stickers" FOR EACH ROW EXECUTE FUNCTION "public"."_set_live_stickers_updated_at"();


--
-- Name: messages trg_message_not_blocked; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_message_not_blocked" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_message_not_blocked"();


--
-- Name: live_auctions trg_notify_auction_won; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_notify_auction_won" AFTER UPDATE OF "status" ON "public"."live_auctions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_auction_won"();


--
-- Name: live_sessions trg_notify_followers_on_go_live; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_notify_followers_on_go_live" AFTER INSERT ON "public"."live_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_followers_on_go_live"();


--
-- Name: gift_transactions trg_notify_on_gift; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_notify_on_gift" AFTER INSERT ON "public"."gift_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_gift"();


--
-- Name: product_orders trg_notify_order_shipped; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_notify_order_shipped" AFTER UPDATE OF "status" ON "public"."product_orders" FOR EACH ROW EXECUTE FUNCTION "public"."notify_order_shipped"();


--
-- Name: saved_products trg_notify_seller_on_save; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_notify_seller_on_save" AFTER INSERT ON "public"."saved_products" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_seller_on_save"();


--
-- Name: order_reviews trg_order_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_order_reviews_updated_at" BEFORE UPDATE ON "public"."order_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_reviews_updated_at"();


--
-- Name: posts trg_post_consistency; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_post_consistency" AFTER INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."_on_post_update_consistency"();


--
-- Name: post_drafts trg_post_drafts_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_post_drafts_touch" BEFORE UPDATE ON "public"."post_drafts" FOR EACH ROW EXECUTE FUNCTION "public"."post_drafts_touch"();


--
-- Name: posts trg_posts_automated_moderation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_posts_automated_moderation" AFTER INSERT OR UPDATE OF "caption", "tags", "media_type", "media_url" ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_automated_post_moderation"();


--
-- Name: product_preorders trg_preorders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_preorders_updated_at" BEFORE UPDATE ON "public"."product_preorders" FOR EACH ROW EXECUTE FUNCTION "public"."set_product_preorders_updated_at"();


--
-- Name: product_orders trg_product_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_product_orders_updated_at" BEFORE UPDATE ON "public"."product_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_product_orders_updated_at"();


--
-- Name: products trg_products_sale_mode_admin; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_products_sale_mode_admin" BEFORE INSERT OR UPDATE OF "sale_mode" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_sale_mode_admin"();


--
-- Name: products trg_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_products_updated_at"();


--
-- Name: live_sessions trg_purge_live_session_viewers_on_end; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_purge_live_session_viewers_on_end" AFTER UPDATE OF "status" ON "public"."live_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."_purge_live_session_viewers_on_end"();


--
-- Name: notifications trg_push_notification; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_push_notification" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."fn_send_push_on_notification"();


--
-- Name: scheduled_lives trg_scheduled_lives_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_scheduled_lives_touch" BEFORE UPDATE ON "public"."scheduled_lives" FOR EACH ROW EXECUTE FUNCTION "public"."scheduled_lives_touch"();


--
-- Name: scheduled_posts trg_scheduled_post_failure_alert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_scheduled_post_failure_alert" AFTER UPDATE OF "status" ON "public"."scheduled_posts" FOR EACH ROW EXECUTE FUNCTION "public"."notify_scheduled_post_failure"();


--
-- Name: TRIGGER "trg_scheduled_post_failure_alert" ON "scheduled_posts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TRIGGER "trg_scheduled_post_failure_alert" ON "public"."scheduled_posts" IS 'Sendet Push-Notification an Autor wenn ein geplanter Post endgültig fehlschlägt (status → failed nach 3 Versuchen). Nutzt send-push-notification Edge Function via pg_net.';


--
-- Name: scheduled_posts trg_scheduled_posts_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_scheduled_posts_touch" BEFORE UPDATE ON "public"."scheduled_posts" FOR EACH ROW EXECUTE FUNCTION "public"."scheduled_posts_touch"();


--
-- Name: profiles trg_single_owner_push_token; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_single_owner_push_token" AFTER UPDATE OF "push_token" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_single_owner_push_token"();


--
-- Name: push_tokens trg_single_owner_push_tokens_row; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_single_owner_push_tokens_row" AFTER INSERT ON "public"."push_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_single_owner_push_tokens_row"();


--
-- Name: bookmarks trg_sync_bookmark_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_sync_bookmark_count" AFTER INSERT OR DELETE ON "public"."bookmarks" FOR EACH ROW EXECUTE FUNCTION "public"."_sync_bookmark_count"();


--
-- Name: comments trg_sync_comment_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_sync_comment_count" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."_sync_comment_count"();


--
-- Name: likes trg_sync_like_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_sync_like_count" AFTER INSERT OR DELETE ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."_sync_like_count"();


--
-- Name: live_recordings trg_sync_recording_to_session; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_sync_recording_to_session" AFTER INSERT OR UPDATE ON "public"."live_recordings" FOR EACH ROW EXECUTE FUNCTION "public"."_sync_recording_to_session"();


--
-- Name: live_auctions trg_touch_live_auction; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_touch_live_auction" BEFORE UPDATE ON "public"."live_auctions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_live_auction"();


--
-- Name: live_sessions trg_touch_live_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_touch_live_sessions_updated_at" BEFORE UPDATE ON "public"."live_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_live_sessions_updated_at"();


--
-- Name: product_reviews trg_update_product_rating; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_update_product_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_rating"();


--
-- Name: user_whip_ingresses trg_user_whip_ingresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_user_whip_ingresses_updated_at" BEFORE UPDATE ON "public"."user_whip_ingresses" FOR EACH ROW EXECUTE FUNCTION "public"."_update_user_whip_ingresses_updated_at"();


--
-- Name: web_coin_orders trg_web_coin_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_web_coin_orders_updated_at" BEFORE UPDATE ON "public"."web_coin_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_web_coin_orders_updated_at"();


--
-- Name: admin_audit_log admin_audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: admin_campaign_daily_metrics admin_campaign_daily_metrics_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_campaign_daily_metrics"
    ADD CONSTRAINT "admin_campaign_daily_metrics_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."admin_campaigns"("id") ON DELETE CASCADE;


--
-- Name: admin_campaigns admin_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_campaigns"
    ADD CONSTRAINT "admin_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: admin_support_messages admin_support_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_support_messages"
    ADD CONSTRAINT "admin_support_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: admin_support_messages admin_support_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_support_messages"
    ADD CONSTRAINT "admin_support_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."admin_support_threads"("id") ON DELETE CASCADE;


--
-- Name: admin_support_threads admin_support_threads_assigned_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_support_threads"
    ADD CONSTRAINT "admin_support_threads_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: admin_support_threads admin_support_threads_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_support_threads"
    ADD CONSTRAINT "admin_support_threads_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: admin_support_threads admin_support_threads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_support_threads"
    ADD CONSTRAINT "admin_support_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: ai_image_generations ai_image_generations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_image_generations"
    ADD CONSTRAINT "ai_image_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: algo_user_variants algo_user_variants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."algo_user_variants"
    ADD CONSTRAINT "algo_user_variants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: auction_carts auction_carts_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."auction_carts"
    ADD CONSTRAINT "auction_carts_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: auction_carts auction_carts_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."auction_carts"
    ADD CONSTRAINT "auction_carts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: coin_purchases coin_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coin_purchases"
    ADD CONSTRAINT "coin_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: coins_wallets coins_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coins_wallets"
    ADD CONSTRAINT "coins_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: comment_likes comment_likes_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;


--
-- Name: comment_likes comment_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: content_reports content_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: content_reports content_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: conversations conversations_participant_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_1_fkey" FOREIGN KEY ("participant_1") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: conversations conversations_participant_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_2_fkey" FOREIGN KEY ("participant_2") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: creator_tips creator_tips_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."creator_tips"
    ADD CONSTRAINT "creator_tips_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: creator_tips creator_tips_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."creator_tips"
    ADD CONSTRAINT "creator_tips_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: feature_flags feature_flags_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: follow_requests follow_requests_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."follow_requests"
    ADD CONSTRAINT "follow_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: follow_requests follow_requests_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."follow_requests"
    ADD CONSTRAINT "follow_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: follows follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: gift_transactions gift_transactions_gift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."gift_transactions"
    ADD CONSTRAINT "gift_transactions_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "public"."gift_catalog"("id");


--
-- Name: gift_transactions gift_transactions_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."gift_transactions"
    ADD CONSTRAINT "gift_transactions_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: gift_transactions gift_transactions_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."gift_transactions"
    ADD CONSTRAINT "gift_transactions_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: likes likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: likes likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_auctions live_auctions_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auctions"
    ADD CONSTRAINT "live_auctions_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."auction_carts"("id") ON DELETE SET NULL;


--
-- Name: live_auctions live_auctions_current_bidder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auctions"
    ADD CONSTRAINT "live_auctions_current_bidder_id_fkey" FOREIGN KEY ("current_bidder_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: live_auctions live_auctions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auctions"
    ADD CONSTRAINT "live_auctions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;


--
-- Name: live_auctions live_auctions_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auctions"
    ADD CONSTRAINT "live_auctions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_auctions live_auctions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auctions"
    ADD CONSTRAINT "live_auctions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_auctions live_auctions_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auctions"
    ADD CONSTRAINT "live_auctions_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: live_auto_bids live_auto_bids_auction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auto_bids"
    ADD CONSTRAINT "live_auto_bids_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "public"."live_auctions"("id") ON DELETE CASCADE;


--
-- Name: live_auto_bids live_auto_bids_bidder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_auto_bids"
    ADD CONSTRAINT "live_auto_bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_battle_history live_battle_history_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_battle_history"
    ADD CONSTRAINT "live_battle_history_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_battle_history live_battle_history_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_battle_history"
    ADD CONSTRAINT "live_battle_history_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_battle_history live_battle_history_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_battle_history"
    ADD CONSTRAINT "live_battle_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_bids live_bids_auction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_bids"
    ADD CONSTRAINT "live_bids_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "public"."live_auctions"("id") ON DELETE CASCADE;


--
-- Name: live_bids live_bids_bidder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_bids"
    ADD CONSTRAINT "live_bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_chat_timeouts live_chat_timeouts_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_chat_timeouts"
    ADD CONSTRAINT "live_chat_timeouts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_chat_timeouts live_chat_timeouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_chat_timeouts"
    ADD CONSTRAINT "live_chat_timeouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_clip_markers live_clip_markers_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_clip_markers"
    ADD CONSTRAINT "live_clip_markers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_clip_markers live_clip_markers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_clip_markers"
    ADD CONSTRAINT "live_clip_markers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_cohost_blocks live_cohost_blocks_blocked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_cohost_blocks"
    ADD CONSTRAINT "live_cohost_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_cohost_blocks live_cohost_blocks_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_cohost_blocks"
    ADD CONSTRAINT "live_cohost_blocks_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_cohosts live_cohosts_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_cohosts"
    ADD CONSTRAINT "live_cohosts_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_cohosts live_cohosts_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_cohosts"
    ADD CONSTRAINT "live_cohosts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_cohosts live_cohosts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_cohosts"
    ADD CONSTRAINT "live_cohosts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_comments live_comments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_comments"
    ADD CONSTRAINT "live_comments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_comments live_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_comments"
    ADD CONSTRAINT "live_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_duet_history live_duet_history_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_duet_history"
    ADD CONSTRAINT "live_duet_history_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_duet_history live_duet_history_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_duet_history"
    ADD CONSTRAINT "live_duet_history_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_duet_history live_duet_history_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_duet_history"
    ADD CONSTRAINT "live_duet_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_duet_invites live_duet_invites_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_duet_invites"
    ADD CONSTRAINT "live_duet_invites_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_duet_invites live_duet_invites_invitee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_duet_invites"
    ADD CONSTRAINT "live_duet_invites_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_duet_invites live_duet_invites_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_duet_invites"
    ADD CONSTRAINT "live_duet_invites_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_giveaway_entries live_giveaway_entries_giveaway_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_giveaway_entries"
    ADD CONSTRAINT "live_giveaway_entries_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "public"."live_giveaways"("id") ON DELETE CASCADE;


--
-- Name: live_giveaway_entries live_giveaway_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_giveaway_entries"
    ADD CONSTRAINT "live_giveaway_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_giveaways live_giveaways_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_giveaways"
    ADD CONSTRAINT "live_giveaways_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_giveaways live_giveaways_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_giveaways"
    ADD CONSTRAINT "live_giveaways_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_giveaways live_giveaways_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_giveaways"
    ADD CONSTRAINT "live_giveaways_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: live_moderators live_moderators_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_moderators"
    ADD CONSTRAINT "live_moderators_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_moderators live_moderators_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_moderators"
    ADD CONSTRAINT "live_moderators_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_moderators live_moderators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_moderators"
    ADD CONSTRAINT "live_moderators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_placed_products live_placed_products_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_placed_products"
    ADD CONSTRAINT "live_placed_products_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_placed_products live_placed_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_placed_products"
    ADD CONSTRAINT "live_placed_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: live_placed_products live_placed_products_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_placed_products"
    ADD CONSTRAINT "live_placed_products_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_poll_votes live_poll_votes_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_poll_votes"
    ADD CONSTRAINT "live_poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."live_polls"("id") ON DELETE CASCADE;


--
-- Name: live_poll_votes live_poll_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_poll_votes"
    ADD CONSTRAINT "live_poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_polls live_polls_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_polls"
    ADD CONSTRAINT "live_polls_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_polls live_polls_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_polls"
    ADD CONSTRAINT "live_polls_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_reactions live_reactions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_reactions"
    ADD CONSTRAINT "live_reactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_reactions live_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_reactions"
    ADD CONSTRAINT "live_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_recordings live_recordings_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_recordings"
    ADD CONSTRAINT "live_recordings_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_recordings live_recordings_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_recordings"
    ADD CONSTRAINT "live_recordings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_reports live_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_reports"
    ADD CONSTRAINT "live_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_reports live_reports_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_reports"
    ADD CONSTRAINT "live_reports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_session_viewers live_session_viewers_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_session_viewers"
    ADD CONSTRAINT "live_session_viewers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_session_viewers live_session_viewers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_session_viewers"
    ADD CONSTRAINT "live_session_viewers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_sessions live_sessions_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_sessions live_sessions_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "public"."live_recordings"("id") ON DELETE SET NULL;


--
-- Name: live_stickers live_stickers_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_stickers"
    ADD CONSTRAINT "live_stickers_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: live_stickers live_stickers_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_stickers"
    ADD CONSTRAINT "live_stickers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_viewer_welcomes live_viewer_welcomes_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_viewer_welcomes"
    ADD CONSTRAINT "live_viewer_welcomes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: live_viewer_welcomes live_viewer_welcomes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."live_viewer_welcomes"
    ADD CONSTRAINT "live_viewer_welcomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;


--
-- Name: messages messages_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;


--
-- Name: messages messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: muted_live_hosts muted_live_hosts_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."muted_live_hosts"
    ADD CONSTRAINT "muted_live_hosts_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: muted_live_hosts muted_live_hosts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."muted_live_hosts"
    ADD CONSTRAINT "muted_live_hosts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: notifications notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE SET NULL;


--
-- Name: notifications notifications_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: notifications notifications_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;


--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: notifications notifications_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: notifications notifications_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;


--
-- Name: order_disputes order_disputes_against_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_disputes"
    ADD CONSTRAINT "order_disputes_against_id_fkey" FOREIGN KEY ("against_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: order_disputes order_disputes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_disputes"
    ADD CONSTRAINT "order_disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."product_orders"("id") ON DELETE CASCADE;


--
-- Name: order_disputes order_disputes_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_disputes"
    ADD CONSTRAINT "order_disputes_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: order_reviews order_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_reviews"
    ADD CONSTRAINT "order_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."product_orders"("id") ON DELETE CASCADE;


--
-- Name: order_reviews order_reviews_reviewee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_reviews"
    ADD CONSTRAINT "order_reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: order_reviews order_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_reviews"
    ADD CONSTRAINT "order_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: orders orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: orders orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;


--
-- Name: orders orders_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: payout_requests payout_requests_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payout_requests"
    ADD CONSTRAINT "payout_requests_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: post_drafts post_drafts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_drafts"
    ADD CONSTRAINT "post_drafts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: post_dwell_log post_dwell_log_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_dwell_log"
    ADD CONSTRAINT "post_dwell_log_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: post_dwell_log post_dwell_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_dwell_log"
    ADD CONSTRAINT "post_dwell_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: post_reports post_reports_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: post_reports post_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: post_views_log post_views_log_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_views_log"
    ADD CONSTRAINT "post_views_log_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: post_views_log post_views_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_views_log"
    ADD CONSTRAINT "post_views_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: post_views post_views_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_views"
    ADD CONSTRAINT "post_views_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: post_views post_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."post_views"
    ADD CONSTRAINT "post_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: posts posts_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id");


--
-- Name: posts posts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;


--
-- Name: preorder_rounds preorder_rounds_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preorder_rounds"
    ADD CONSTRAINT "preorder_rounds_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE SET NULL;


--
-- Name: preorder_rounds preorder_rounds_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preorder_rounds"
    ADD CONSTRAINT "preorder_rounds_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: preorder_rounds preorder_rounds_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preorder_rounds"
    ADD CONSTRAINT "preorder_rounds_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: product_orders product_orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: product_orders product_orders_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."auction_carts"("id") ON DELETE SET NULL;


--
-- Name: product_orders product_orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;


--
-- Name: product_orders product_orders_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: product_preorders product_preorders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_preorders"
    ADD CONSTRAINT "product_preorders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: product_preorders product_preorders_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_preorders"
    ADD CONSTRAINT "product_preorders_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."preorder_rounds"("id") ON DELETE SET NULL;


--
-- Name: product_preorders product_preorders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_preorders"
    ADD CONSTRAINT "product_preorders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: products products_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: profiles profiles_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id");


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: profiles profiles_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: reposts reposts_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


--
-- Name: reposts reposts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: saved_products saved_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."saved_products"
    ADD CONSTRAINT "saved_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: saved_products saved_products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."saved_products"
    ADD CONSTRAINT "saved_products_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: scheduled_lives scheduled_lives_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scheduled_lives"
    ADD CONSTRAINT "scheduled_lives_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: scheduled_lives scheduled_lives_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scheduled_lives"
    ADD CONSTRAINT "scheduled_lives_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE SET NULL;


--
-- Name: scheduled_posts scheduled_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scheduled_posts"
    ADD CONSTRAINT "scheduled_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: scheduled_posts scheduled_posts_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scheduled_posts"
    ADD CONSTRAINT "scheduled_posts_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE SET NULL;


--
-- Name: scheduled_posts scheduled_posts_published_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scheduled_posts"
    ADD CONSTRAINT "scheduled_posts_published_post_id_fkey" FOREIGN KEY ("published_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;


--
-- Name: seller_accounts seller_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seller_accounts"
    ADD CONSTRAINT "seller_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: stories stories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: story_comments story_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_comments"
    ADD CONSTRAINT "story_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: story_comments story_comments_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_comments"
    ADD CONSTRAINT "story_comments_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;


--
-- Name: story_highlights story_highlights_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_highlights"
    ADD CONSTRAINT "story_highlights_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;


--
-- Name: story_highlights story_highlights_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_highlights"
    ADD CONSTRAINT "story_highlights_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;


--
-- Name: story_highlights story_highlights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_highlights"
    ADD CONSTRAINT "story_highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: story_likes story_likes_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;


--
-- Name: story_likes story_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: story_views story_views_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;


--
-- Name: story_views story_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: story_votes story_votes_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_votes"
    ADD CONSTRAINT "story_votes_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;


--
-- Name: story_votes story_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."story_votes"
    ADD CONSTRAINT "story_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: user_reports user_reports_reported_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: user_reports user_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: user_tag_affinity user_tag_affinity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_tag_affinity"
    ADD CONSTRAINT "user_tag_affinity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: user_vibe_profile user_vibe_profile_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_vibe_profile"
    ADD CONSTRAINT "user_vibe_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: user_whip_ingresses user_whip_ingresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_whip_ingresses"
    ADD CONSTRAINT "user_whip_ingresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: web_coin_orders web_coin_orders_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."web_coin_orders"
    ADD CONSTRAINT "web_coin_orders_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."coin_pricing_tiers"("id");


--
-- Name: web_coin_orders web_coin_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."web_coin_orders"
    ADD CONSTRAINT "web_coin_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: web_push_subscriptions web_push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."web_push_subscriptions"
    ADD CONSTRAINT "web_push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: women_only_requests women_only_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."women_only_requests"
    ADD CONSTRAINT "women_only_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: women_only_requests women_only_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."women_only_requests"
    ADD CONSTRAINT "women_only_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: posts Autor kann eigene Posts bearbeiten; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Autor kann eigene Posts bearbeiten" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));


--
-- Name: posts Autor kann eigene Posts löschen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Autor kann eigene Posts löschen" ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "author_id"));


--
-- Name: reposts Eigene Reposts anlegen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Eigene Reposts anlegen" ON "public"."reposts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: reposts Eigene Reposts löschen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Eigene Reposts löschen" ON "public"."reposts" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: likes Eingeloggte User können liken; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Eingeloggte User können liken" ON "public"."likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: posts Eingeloggte User können posten; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Eingeloggte User können posten" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));


--
-- Name: guilds Guilds sind öffentlich lesbar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Guilds sind öffentlich lesbar" ON "public"."guilds" FOR SELECT USING (true);


--
-- Name: live_sessions Host kann replay_url setzen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Host kann replay_url setzen" ON "public"."live_sessions" FOR UPDATE TO "authenticated" USING (("host_id" = "auth"."uid"())) WITH CHECK (("host_id" = "auth"."uid"()));


--
-- Name: comments Kommentare sind öffentlich lesbar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Kommentare sind öffentlich lesbar" ON "public"."comments" FOR SELECT USING (true);


--
-- Name: likes Likes sind öffentlich lesbar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Likes sind öffentlich lesbar" ON "public"."likes" FOR SELECT USING (true);


--
-- Name: profiles Profiles sind öffentlich lesbar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Profiles sind öffentlich lesbar" ON "public"."profiles" FOR SELECT USING (true);


--
-- Name: reposts Reposts sehen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reposts sehen" ON "public"."reposts" FOR SELECT USING (true);


--
-- Name: live_reports User kann eigene Reports einfügen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User kann eigene Reports einfügen" ON "public"."live_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));


--
-- Name: profiles User kann eigenes Profil bearbeiten; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User kann eigenes Profil bearbeiten" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));


--
-- Name: profiles User kann eigenes Profil erstellen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User kann eigenes Profil erstellen" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: comments User können eigene Kommentare löschen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User können eigene Kommentare löschen" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: likes User können eigene Likes entfernen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User können eigene Likes entfernen" ON "public"."likes" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: push_tokens User manages own tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User manages own tokens" ON "public"."push_tokens" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: post_views Users can insert own views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own views" ON "public"."post_views" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: post_drafts Users can manage own drafts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own drafts" ON "public"."post_drafts" USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));


--
-- Name: scheduled_posts Users can manage own scheduled_posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own scheduled_posts" ON "public"."scheduled_posts" USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));


--
-- Name: post_views Users can read own views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own views" ON "public"."post_views" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: post_dwell_log Users manage own dwell log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own dwell log" ON "public"."post_dwell_log" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_vibe_profile Users manage own vibe profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own vibe profile" ON "public"."user_vibe_profile" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log admin_audit_log_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_audit_log_admin_select" ON "public"."admin_audit_log" FOR SELECT USING (("public"."is_admin"() OR "public"."can_moderate"() OR "public"."can_operate"() OR "public"."can_creator_ops"()));


--
-- Name: admin_campaign_daily_metrics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_campaign_daily_metrics" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_campaign_daily_metrics admin_campaign_metrics_admin_mutate; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_campaign_metrics_admin_mutate" ON "public"."admin_campaign_daily_metrics" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: admin_campaign_daily_metrics admin_campaign_metrics_console_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_campaign_metrics_console_select" ON "public"."admin_campaign_daily_metrics" FOR SELECT USING ("public"."can_operate"());


--
-- Name: admin_campaigns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_campaigns" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_campaigns admin_campaigns_admin_mutate; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_campaigns_admin_mutate" ON "public"."admin_campaigns" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: admin_campaigns admin_campaigns_console_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_campaigns_console_select" ON "public"."admin_campaigns" FOR SELECT USING ("public"."can_operate"());


--
-- Name: live_reports admin_read_live_reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_read_live_reports" ON "public"."live_reports" FOR SELECT TO "authenticated" USING (("reporter_id" = "auth"."uid"()));


--
-- Name: admin_region_daily_metrics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_region_daily_metrics" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_region_daily_metrics admin_region_metrics_admin_mutate; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_region_metrics_admin_mutate" ON "public"."admin_region_daily_metrics" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: admin_region_daily_metrics admin_region_metrics_console_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_region_metrics_console_select" ON "public"."admin_region_daily_metrics" FOR SELECT USING ("public"."can_operate"());


--
-- Name: admin_support_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_support_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_support_messages admin_support_messages_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_support_messages_insert" ON "public"."admin_support_messages" FOR INSERT WITH CHECK (("public"."has_admin_console_access"() OR (EXISTS ( SELECT 1
   FROM "public"."admin_support_threads" "t"
  WHERE (("t"."id" = "admin_support_messages"."thread_id") AND ("t"."user_id" = "auth"."uid"()))))));


--
-- Name: admin_support_messages admin_support_messages_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_support_messages_select" ON "public"."admin_support_messages" FOR SELECT USING (("public"."has_admin_console_access"() OR (EXISTS ( SELECT 1
   FROM "public"."admin_support_threads" "t"
  WHERE (("t"."id" = "admin_support_messages"."thread_id") AND ("t"."user_id" = "auth"."uid"()))))));


--
-- Name: admin_support_threads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_support_threads" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_support_threads admin_support_threads_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_support_threads_admin_update" ON "public"."admin_support_threads" FOR UPDATE USING (("public"."can_moderate"() OR "public"."can_operate"()));


--
-- Name: admin_support_threads admin_support_threads_user_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_support_threads_user_insert" ON "public"."admin_support_threads" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."has_admin_console_access"()));


--
-- Name: admin_support_threads admin_support_threads_user_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_support_threads_user_select" ON "public"."admin_support_threads" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."has_admin_console_access"()));


--
-- Name: ai_image_generations ai_image_gen_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_image_gen_select_own" ON "public"."ai_image_generations" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ai_image_generations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_image_generations" ENABLE ROW LEVEL SECURITY;

--
-- Name: auction_carts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."auction_carts" ENABLE ROW LEVEL SECURITY;

--
-- Name: auction_carts auction_carts_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "auction_carts_select" ON "public"."auction_carts" FOR SELECT USING ((("auth"."uid"() = "buyer_id") OR ("auth"."uid"() = "seller_id")));


--
-- Name: live_battle_history battle_history_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "battle_history_select_all" ON "public"."live_battle_history" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: bookmarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."bookmarks" ENABLE ROW LEVEL SECURITY;

--
-- Name: bookmarks bookmarks_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bookmarks_delete" ON "public"."bookmarks" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: bookmarks bookmarks_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bookmarks_insert" ON "public"."bookmarks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: bookmarks bookmarks_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bookmarks_select" ON "public"."bookmarks" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: live_chat_timeouts chat_timeouts_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "chat_timeouts_select_all" ON "public"."live_chat_timeouts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: live_chat_timeouts chat_timeouts_write_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "chat_timeouts_write_host" ON "public"."live_chat_timeouts" USING ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_chat_timeouts"."session_id") AND ("s"."host_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_chat_timeouts"."session_id") AND ("s"."host_id" = "auth"."uid"())))));


--
-- Name: live_clip_markers clip_markers_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "clip_markers_delete_own" ON "public"."live_clip_markers" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: live_clip_markers clip_markers_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "clip_markers_insert" ON "public"."live_clip_markers" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: live_clip_markers clip_markers_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "clip_markers_select" ON "public"."live_clip_markers" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() IN ( SELECT "live_sessions"."host_id"
   FROM "public"."live_sessions"
  WHERE ("live_sessions"."id" = "live_clip_markers"."session_id")))));


--
-- Name: live_cohost_blocks cohost_blocks_delete_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cohost_blocks_delete_host" ON "public"."live_cohost_blocks" FOR DELETE USING (("auth"."uid"() = "host_id"));


--
-- Name: live_cohost_blocks cohost_blocks_insert_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cohost_blocks_insert_host" ON "public"."live_cohost_blocks" FOR INSERT WITH CHECK (("auth"."uid"() = "host_id"));


--
-- Name: live_cohost_blocks cohost_blocks_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cohost_blocks_select_own" ON "public"."live_cohost_blocks" FOR SELECT USING ((("auth"."uid"() = "host_id") OR ("auth"."uid"() = "blocked_user_id")));


--
-- Name: live_cohost_blocks cohost_blocks_update_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cohost_blocks_update_host" ON "public"."live_cohost_blocks" FOR UPDATE USING (("auth"."uid"() = "host_id")) WITH CHECK (("auth"."uid"() = "host_id"));


--
-- Name: coin_pricing_tiers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."coin_pricing_tiers" ENABLE ROW LEVEL SECURITY;

--
-- Name: coin_purchases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."coin_purchases" ENABLE ROW LEVEL SECURITY;

--
-- Name: coin_purchases coin_purchases_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coin_purchases_select_own" ON "public"."coin_purchases" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: coin_purchases coin_purchases_service_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coin_purchases_service_only" ON "public"."coin_purchases" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: coin_pricing_tiers coin_tiers_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coin_tiers_public_read" ON "public"."coin_pricing_tiers" FOR SELECT USING (("active" = true));


--
-- Name: coin_pricing_tiers coin_tiers_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coin_tiers_service_write" ON "public"."coin_pricing_tiers" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: coins_wallets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."coins_wallets" ENABLE ROW LEVEL SECURITY;

--
-- Name: comment_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;

--
-- Name: comment_likes comment_likes_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comment_likes_delete" ON "public"."comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: comment_likes comment_likes_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comment_likes_insert" ON "public"."comment_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: comment_likes comment_likes_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comment_likes_select" ON "public"."comment_likes" FOR SELECT USING (true);


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: comments comments_insert_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comments_insert_policy" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "comments"."post_id") AND ((COALESCE("p"."allow_comments", true) = true) OR ("p"."author_id" = "auth"."uid"())) AND (("p"."is_guild_post" = false) OR (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."guild_id" = "p"."guild_id"))))))))));


--
-- Name: content_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conv_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "conv_insert" ON "public"."conversations" FOR INSERT WITH CHECK ((("auth"."uid"() = "participant_1") OR ("auth"."uid"() = "participant_2")));


--
-- Name: conversations conv_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "conv_select" ON "public"."conversations" FOR SELECT USING ((("auth"."uid"() = "participant_1") OR ("auth"."uid"() = "participant_2")));


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_tips; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."creator_tips" ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_tips creator_tips_select_recipient; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "creator_tips_select_recipient" ON "public"."creator_tips" FOR SELECT USING (("auth"."uid"() = "recipient_id"));


--
-- Name: creator_tips creator_tips_select_sender; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "creator_tips_select_sender" ON "public"."creator_tips" FOR SELECT USING (("auth"."uid"() = "sender_id"));


--
-- Name: live_duet_history duet_history_select_participants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "duet_history_select_participants" ON "public"."live_duet_history" FOR SELECT USING ((("auth"."uid"() = "host_id") OR ("auth"."uid"() = "guest_id")));


--
-- Name: live_duet_invites duet_invites_select_participants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "duet_invites_select_participants" ON "public"."live_duet_invites" FOR SELECT USING ((("auth"."uid"() = "host_id") OR ("auth"."uid"() = "invitee_id")));


--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags feature_flags_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "feature_flags_select_all" ON "public"."feature_flags" FOR SELECT TO "authenticated" USING (true);


--
-- Name: follow_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: follow_requests follow_requests_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "follow_requests_delete" ON "public"."follow_requests" FOR DELETE USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));


--
-- Name: follow_requests follow_requests_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "follow_requests_insert" ON "public"."follow_requests" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND ("sender_id" <> "receiver_id")));


--
-- Name: follow_requests follow_requests_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "follow_requests_select" ON "public"."follow_requests" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));


--
-- Name: follows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;

--
-- Name: follows follows_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "follows_delete" ON "public"."follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));


--
-- Name: follows follows_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "follows_insert" ON "public"."follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));


--
-- Name: follows follows_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "follows_select" ON "public"."follows" FOR SELECT USING (true);


--
-- Name: gift_catalog; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."gift_catalog" ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_catalog gift_catalog_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gift_catalog_public_read" ON "public"."gift_catalog" FOR SELECT USING (true);


--
-- Name: gift_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."gift_transactions" ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_transactions gift_tx_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gift_tx_insert" ON "public"."gift_transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));


--
-- Name: gift_transactions gift_tx_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gift_tx_select" ON "public"."gift_transactions" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "recipient_id")));


--
-- Name: gift_transactions gift_tx_select_visible_live_session; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gift_tx_select_visible_live_session" ON "public"."gift_transactions" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "recipient_id") OR (EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id")::"text" = "gift_transactions"."live_session_id")))));


--
-- Name: guilds; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."guilds" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_reports insert_own_live_reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "insert_own_live_reports" ON "public"."live_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));


--
-- Name: live_reports insert_own_reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "insert_own_reports" ON "public"."live_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));


--
-- Name: likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_auctions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_auctions" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_auctions live_auctions_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_auctions_select" ON "public"."live_auctions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_auctions"."session_id") AND (("s"."women_only" = false) OR ("s"."host_id" = "auth"."uid"()) OR "public"."is_women_only_verified"())))));


--
-- Name: live_auto_bids; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_auto_bids" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_auto_bids live_auto_bids_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_auto_bids_select_own" ON "public"."live_auto_bids" FOR SELECT USING (("auth"."uid"() = "bidder_id"));


--
-- Name: live_battle_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_battle_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_bids; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_bids" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_bids live_bids_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_bids_select" ON "public"."live_bids" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."live_auctions" "a"
     JOIN "public"."live_sessions" "s" ON (("s"."id" = "a"."session_id")))
  WHERE (("a"."id" = "live_bids"."auction_id") AND (("s"."women_only" = false) OR ("s"."host_id" = "auth"."uid"()) OR "public"."is_women_only_verified"())))));


--
-- Name: live_chat_timeouts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_chat_timeouts" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_clip_markers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_clip_markers" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_cohost_blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_cohost_blocks" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_cohosts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_cohosts" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_cohosts live_cohosts_delete_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_cohosts_delete_host" ON "public"."live_cohosts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_cohosts"."session_id") AND ("s"."host_id" = "auth"."uid"())))));


--
-- Name: live_cohosts live_cohosts_insert_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_cohosts_insert_host" ON "public"."live_cohosts" FOR INSERT WITH CHECK ((("auth"."uid"() = "invited_by") AND (EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_cohosts"."session_id") AND ("s"."host_id" = "auth"."uid"()) AND ("s"."status" = 'active'::"text"))))));


--
-- Name: live_cohosts live_cohosts_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_cohosts_select" ON "public"."live_cohosts" FOR SELECT USING (true);


--
-- Name: live_cohosts live_cohosts_update_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_cohosts_update_host" ON "public"."live_cohosts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_cohosts"."session_id") AND ("s"."host_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_cohosts"."session_id") AND ("s"."host_id" = "auth"."uid"())))));


--
-- Name: live_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_comments live_comments_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_comments_delete" ON "public"."live_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: live_comments live_comments_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_comments_insert" ON "public"."live_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: live_comments live_comments_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_comments_select" ON "public"."live_comments" FOR SELECT USING (true);


--
-- Name: live_duet_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_duet_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_duet_invites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_duet_invites" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_giveaway_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_giveaway_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_giveaway_entries live_giveaway_entries_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_giveaway_entries_select_own" ON "public"."live_giveaway_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: live_giveaways; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_giveaways" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_giveaways live_giveaways_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_giveaways_select" ON "public"."live_giveaways" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_giveaways"."session_id") AND (("s"."women_only" = false) OR ("s"."host_id" = "auth"."uid"()) OR "public"."is_women_only_verified"())))));


--
-- Name: live_moderators; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_moderators" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_placed_products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_placed_products" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_placed_products live_placed_products_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_placed_products_delete" ON "public"."live_placed_products" FOR DELETE USING (("auth"."uid"() = "host_id"));


--
-- Name: live_placed_products live_placed_products_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_placed_products_insert" ON "public"."live_placed_products" FOR INSERT WITH CHECK ((("auth"."uid"() = "host_id") AND (EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_placed_products"."session_id") AND ("s"."host_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "live_placed_products"."product_id") AND ("p"."seller_id" = "auth"."uid"()))))));


--
-- Name: live_placed_products live_placed_products_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_placed_products_select" ON "public"."live_placed_products" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: live_placed_products live_placed_products_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_placed_products_update" ON "public"."live_placed_products" FOR UPDATE USING (("auth"."uid"() = "host_id")) WITH CHECK ((("auth"."uid"() = "host_id") AND (EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_placed_products"."session_id") AND ("s"."host_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "live_placed_products"."product_id") AND ("p"."seller_id" = "auth"."uid"()))))));


--
-- Name: live_poll_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_poll_votes" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_poll_votes live_poll_votes_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_poll_votes_insert" ON "public"."live_poll_votes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."live_polls" "p"
  WHERE (("p"."id" = "live_poll_votes"."poll_id") AND ("p"."closed_at" IS NULL))))));


--
-- Name: live_poll_votes live_poll_votes_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_poll_votes_select" ON "public"."live_poll_votes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: live_polls; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_polls" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_polls live_polls_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_polls_delete" ON "public"."live_polls" FOR DELETE USING ((("auth"."uid"() = "host_id") OR (EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_polls"."session_id") AND ("s"."host_id" = "auth"."uid"())))) OR "public"."is_live_session_moderator"("session_id", "auth"."uid"())));


--
-- Name: live_polls live_polls_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_polls_insert" ON "public"."live_polls" FOR INSERT WITH CHECK ((("auth"."uid"() = "host_id") AND ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_polls"."session_id") AND ("s"."host_id" = "auth"."uid"())))) OR "public"."is_live_session_moderator"("session_id", "auth"."uid"()))));


--
-- Name: live_polls live_polls_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_polls_select" ON "public"."live_polls" FOR SELECT USING (true);


--
-- Name: live_polls live_polls_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_polls_update" ON "public"."live_polls" FOR UPDATE USING ((("auth"."uid"() = "host_id") OR (EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_polls"."session_id") AND ("s"."host_id" = "auth"."uid"())))) OR "public"."is_live_session_moderator"("session_id", "auth"."uid"()))) WITH CHECK ((("auth"."uid"() = "host_id") OR (EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_polls"."session_id") AND ("s"."host_id" = "auth"."uid"())))) OR "public"."is_live_session_moderator"("session_id", "auth"."uid"())));


--
-- Name: live_reactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_reactions" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_reactions live_reactions_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_reactions_insert" ON "public"."live_reactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: live_reactions live_reactions_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_reactions_select" ON "public"."live_reactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_reactions"."session_id") AND (("s"."women_only" = false) OR ("s"."host_id" = "auth"."uid"()) OR "public"."is_women_only_verified"())))));


--
-- Name: live_recordings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_recordings" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_recordings live_recordings_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_recordings_delete_own" ON "public"."live_recordings" FOR DELETE USING (("auth"."uid"() = "host_id"));


--
-- Name: live_recordings live_recordings_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_recordings_select_own" ON "public"."live_recordings" FOR SELECT USING (("auth"."uid"() = "host_id"));


--
-- Name: live_recordings live_recordings_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_recordings_select_public" ON "public"."live_recordings" FOR SELECT USING ((("status" = 'ready'::"text") AND ("is_public" = true)));


--
-- Name: live_recordings live_recordings_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_recordings_update_own" ON "public"."live_recordings" FOR UPDATE USING (("auth"."uid"() = "host_id"));


--
-- Name: live_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_session_viewers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_session_viewers" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_sessions live_sessions_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_sessions_delete" ON "public"."live_sessions" FOR DELETE USING (("auth"."uid"() = "host_id"));


--
-- Name: live_sessions live_sessions_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_sessions_insert" ON "public"."live_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "host_id"));


--
-- Name: live_sessions live_sessions_select_with_women_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_sessions_select_with_women_only" ON "public"."live_sessions" FOR SELECT USING ((("women_only" = false) OR ("host_id" = "auth"."uid"()) OR "public"."is_women_only_verified"()));


--
-- Name: live_sessions live_sessions_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_sessions_update" ON "public"."live_sessions" FOR UPDATE USING (("auth"."uid"() = "host_id"));


--
-- Name: live_stickers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_stickers" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_stickers live_stickers_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_stickers_delete" ON "public"."live_stickers" FOR DELETE USING (("auth"."uid"() = "host_id"));


--
-- Name: live_stickers live_stickers_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_stickers_insert" ON "public"."live_stickers" FOR INSERT WITH CHECK ((("auth"."uid"() = "host_id") AND (EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_stickers"."session_id") AND ("s"."host_id" = "auth"."uid"()))))));


--
-- Name: live_stickers live_stickers_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_stickers_select" ON "public"."live_stickers" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: live_stickers live_stickers_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_stickers_update" ON "public"."live_stickers" FOR UPDATE USING (("auth"."uid"() = "host_id")) WITH CHECK (("auth"."uid"() = "host_id"));


--
-- Name: live_viewer_welcomes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."live_viewer_welcomes" ENABLE ROW LEVEL SECURITY;

--
-- Name: live_viewer_welcomes live_viewer_welcomes_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "live_viewer_welcomes_read_all" ON "public"."live_viewer_welcomes" FOR SELECT USING (true);


--
-- Name: live_session_viewers lsv_select_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "lsv_select_host" ON "public"."live_session_viewers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."live_sessions" "s"
  WHERE (("s"."id" = "live_session_viewers"."session_id") AND ("s"."host_id" = "auth"."uid"())))));


--
-- Name: live_session_viewers lsv_select_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "lsv_select_self" ON "public"."live_session_viewers" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: message_reactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."message_reactions" ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: moderation_auto_flags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."moderation_auto_flags" ENABLE ROW LEVEL SECURITY;

--
-- Name: moderation_auto_flags moderation_auto_flags_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "moderation_auto_flags_admin_select" ON "public"."moderation_auto_flags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));


--
-- Name: messages msg_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "msg_insert" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."participant_1" = "auth"."uid"()) OR ("c"."participant_2" = "auth"."uid"())))))));


--
-- Name: messages msg_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "msg_select" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."participant_1" = "auth"."uid"()) OR ("c"."participant_2" = "auth"."uid"()))))));


--
-- Name: messages msg_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "msg_update" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "sender_id")) WITH CHECK (("auth"."uid"() = "sender_id"));


--
-- Name: muted_live_hosts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."muted_live_hosts" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notif_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notif_insert" ON "public"."notifications" FOR INSERT WITH CHECK (true);


--
-- Name: notifications notif_insert_own_sender; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notif_insert_own_sender" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("sender_id" = "auth"."uid"()));


--
-- Name: notifications notif_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notif_select" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "recipient_id"));


--
-- Name: notifications notif_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notif_update" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "recipient_id"));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: order_disputes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."order_disputes" ENABLE ROW LEVEL SECURITY;

--
-- Name: order_disputes order_disputes_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "order_disputes_read" ON "public"."order_disputes" FOR SELECT USING ((("auth"."uid"() = "reporter_id") OR ("auth"."uid"() = "against_id") OR COALESCE("public"."is_admin"(), false)));


--
-- Name: order_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."order_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: order_reviews order_reviews_party_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "order_reviews_party_read" ON "public"."order_reviews" FOR SELECT USING ((("auth"."uid"() = "reviewer_id") OR ("auth"."uid"() = "reviewee_id")));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "orders_insert" ON "public"."orders" FOR INSERT WITH CHECK (("buyer_id" = "auth"."uid"()));


--
-- Name: orders orders_select_buyer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "orders_select_buyer" ON "public"."orders" FOR SELECT USING (("buyer_id" = "auth"."uid"()));


--
-- Name: orders orders_select_seller; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "orders_select_seller" ON "public"."orders" FOR SELECT USING (("seller_id" = "auth"."uid"()));


--
-- Name: orders orders_update_seller; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "orders_update_seller" ON "public"."orders" FOR UPDATE USING (("seller_id" = "auth"."uid"()));


--
-- Name: muted_live_hosts own mutes delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own mutes delete" ON "public"."muted_live_hosts" FOR DELETE USING (("user_id" = "auth"."uid"()));


--
-- Name: muted_live_hosts own mutes read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own mutes read" ON "public"."muted_live_hosts" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: muted_live_hosts own mutes write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own mutes write" ON "public"."muted_live_hosts" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: user_whip_ingresses own_ingress_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own_ingress_delete" ON "public"."user_whip_ingresses" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: user_whip_ingresses own_ingress_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own_ingress_insert" ON "public"."user_whip_ingresses" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_whip_ingresses own_ingress_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own_ingress_select" ON "public"."user_whip_ingresses" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: user_whip_ingresses own_ingress_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own_ingress_update" ON "public"."user_whip_ingresses" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: live_moderators p_live_moderators_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "p_live_moderators_select" ON "public"."live_moderators" FOR SELECT USING (true);


--
-- Name: payout_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."payout_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: payout_requests payout_requests_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payout_requests_insert_own" ON "public"."payout_requests" FOR INSERT WITH CHECK (("creator_id" = "auth"."uid"()));


--
-- Name: payout_requests payout_requests_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payout_requests_select_own" ON "public"."payout_requests" FOR SELECT USING (("creator_id" = "auth"."uid"()));


--
-- Name: post_drafts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."post_drafts" ENABLE ROW LEVEL SECURITY;

--
-- Name: post_dwell_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."post_dwell_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: post_dwell_log post_dwell_log_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_dwell_log_select_own" ON "public"."post_dwell_log" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: post_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."post_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: post_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."post_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: post_views_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."post_views_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: post_views_log post_views_log_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_views_log_select_own" ON "public"."post_views_log" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;

--
-- Name: posts posts_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts_select_own" ON "public"."posts" FOR SELECT USING (("author_id" = "auth"."uid"()));


--
-- Name: posts posts_select_public_friends_private; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts_select_public_friends_private" ON "public"."posts" FOR SELECT USING ((("author_id" = "auth"."uid"()) OR ((COALESCE("privacy", 'public'::"text") = 'public'::"text") AND ((COALESCE("women_only", false) = false) OR "public"."is_women_only_verified"())) OR ((COALESCE("privacy", 'public'::"text") = 'friends'::"text") AND ("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."follows" "f"
  WHERE (("f"."follower_id" = "auth"."uid"()) AND ("f"."following_id" = "posts"."author_id")))) AND ((COALESCE("women_only", false) = false) OR "public"."is_women_only_verified"()))));


--
-- Name: posts posts_visibility_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts_visibility_policy" ON "public"."posts" FOR SELECT USING ((("auth"."uid"() = "author_id") OR ("privacy" = 'public'::"text") OR (("privacy" = 'friends'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."follows"
  WHERE (("follows"."follower_id" = "auth"."uid"()) AND ("follows"."following_id" = "posts"."author_id")))))));


--
-- Name: preorder_rounds; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."preorder_rounds" ENABLE ROW LEVEL SECURITY;

--
-- Name: preorder_rounds preorder_rounds_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "preorder_rounds_read" ON "public"."preorder_rounds" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: product_preorders preorders_owner_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "preorders_owner_all" ON "public"."product_preorders" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: product_preorders preorders_seller_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "preorders_seller_read" ON "public"."product_preorders" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_preorders"."product_id") AND ("p"."seller_id" = "auth"."uid"())))) OR COALESCE("public"."is_admin"(), false)));


--
-- Name: product_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_orders product_orders_party_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "product_orders_party_read" ON "public"."product_orders" FOR SELECT USING ((("auth"."uid"() = "buyer_id") OR ("auth"."uid"() = "seller_id")));


--
-- Name: product_orders product_orders_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "product_orders_service_write" ON "public"."product_orders" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: product_preorders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_preorders" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_delete" ON "public"."products" FOR DELETE USING (("seller_id" = "auth"."uid"()));


--
-- Name: products products_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_insert" ON "public"."products" FOR INSERT WITH CHECK (("seller_id" = "auth"."uid"()));


--
-- Name: products products_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_select_own" ON "public"."products" FOR SELECT USING (("seller_id" = "auth"."uid"()));


--
-- Name: products products_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_select_public" ON "public"."products" FOR SELECT USING ((("is_active" = true) AND ("women_only" = false)));


--
-- Name: products products_select_woz; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_select_woz" ON "public"."products" FOR SELECT USING ((("is_active" = true) AND ("women_only" = true) AND "public"."is_women_only_verified"()));


--
-- Name: products products_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_update" ON "public"."products" FOR UPDATE USING (("seller_id" = "auth"."uid"()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: r2_delete_queue; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."r2_delete_queue" ENABLE ROW LEVEL SECURITY;

--
-- Name: message_reactions reactions delete own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reactions delete own" ON "public"."message_reactions" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: message_reactions reactions insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reactions insert own" ON "public"."message_reactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: message_reactions reactions public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reactions public read" ON "public"."message_reactions" FOR SELECT USING (true);


--
-- Name: content_reports reports_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reports_admin_select" ON "public"."content_reports" FOR SELECT USING ("public"."can_moderate"());


--
-- Name: content_reports reports_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reports_admin_update" ON "public"."content_reports" FOR UPDATE USING ("public"."can_moderate"());


--
-- Name: content_reports reports_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reports_insert" ON "public"."content_reports" FOR INSERT WITH CHECK (("reporter_id" = "auth"."uid"()));


--
-- Name: reposts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."reposts" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_reviews reviews_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reviews_delete" ON "public"."product_reviews" FOR DELETE USING (("auth"."uid"() = "reviewer_id"));


--
-- Name: product_reviews reviews_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reviews_insert" ON "public"."product_reviews" FOR INSERT WITH CHECK ((("auth"."uid"() = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "product_reviews"."order_id") AND ("o"."buyer_id" = "auth"."uid"()) AND ("o"."product_id" = "product_reviews"."product_id") AND ("o"."status" = 'completed'::"text"))))));


--
-- Name: product_reviews reviews_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reviews_select" ON "public"."product_reviews" FOR SELECT USING (true);


--
-- Name: product_reviews reviews_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reviews_update" ON "public"."product_reviews" FOR UPDATE USING (("auth"."uid"() = "reviewer_id"));


--
-- Name: saved_products saved_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "saved_delete_own" ON "public"."saved_products" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: saved_products saved_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "saved_insert_own" ON "public"."saved_products" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: saved_products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."saved_products" ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_products saved_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "saved_select_own" ON "public"."saved_products" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: scheduled_lives; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."scheduled_lives" ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_lives scheduled_lives_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_lives_delete_own" ON "public"."scheduled_lives" FOR DELETE USING (("auth"."uid"() = "host_id"));


--
-- Name: scheduled_lives scheduled_lives_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_lives_insert_own" ON "public"."scheduled_lives" FOR INSERT WITH CHECK (("auth"."uid"() = "host_id"));


--
-- Name: scheduled_lives scheduled_lives_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_lives_select_own" ON "public"."scheduled_lives" FOR SELECT USING (("auth"."uid"() = "host_id"));


--
-- Name: scheduled_lives scheduled_lives_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_lives_select_public" ON "public"."scheduled_lives" FOR SELECT USING (("status" = ANY (ARRAY['scheduled'::"text", 'reminded'::"text", 'live'::"text"])));


--
-- Name: scheduled_lives scheduled_lives_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_lives_update_own" ON "public"."scheduled_lives" FOR UPDATE USING (("auth"."uid"() = "host_id"));


--
-- Name: scheduled_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."scheduled_posts" ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."seller_accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_accounts seller_accounts_read_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "seller_accounts_read_own" ON "public"."seller_accounts" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: seller_accounts seller_accounts_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "seller_accounts_service_write" ON "public"."seller_accounts" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: shop_banners; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."shop_banners" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_banners shop_banners_admin_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "shop_banners_admin_all" ON "public"."shop_banners" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))));


--
-- Name: shop_banners shop_banners_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "shop_banners_read" ON "public"."shop_banners" FOR SELECT USING ((("active" = true) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" > "now"()))));


--
-- Name: stories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;

--
-- Name: stories stories_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "stories_delete" ON "public"."stories" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: stories stories_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "stories_insert" ON "public"."stories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: stories stories_own_archived_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "stories_own_archived_select" ON "public"."stories" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("archived" = false)));


--
-- Name: stories stories_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "stories_select" ON "public"."stories" FOR SELECT USING (true);


--
-- Name: story_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."story_comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: story_comments story_comments_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_comments_delete" ON "public"."story_comments" FOR DELETE USING (("auth"."uid"() = "author_id"));


--
-- Name: story_comments story_comments_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_comments_insert" ON "public"."story_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));


--
-- Name: story_comments story_comments_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_comments_read" ON "public"."story_comments" FOR SELECT USING (true);


--
-- Name: story_highlights; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."story_highlights" ENABLE ROW LEVEL SECURITY;

--
-- Name: story_highlights story_highlights_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_highlights_delete" ON "public"."story_highlights" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: story_highlights story_highlights_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_highlights_insert" ON "public"."story_highlights" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: story_highlights story_highlights_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_highlights_select" ON "public"."story_highlights" FOR SELECT USING (true);


--
-- Name: story_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."story_likes" ENABLE ROW LEVEL SECURITY;

--
-- Name: story_likes story_likes delete own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_likes delete own" ON "public"."story_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: story_likes story_likes insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_likes insert own" ON "public"."story_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: story_likes story_likes public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_likes public read" ON "public"."story_likes" FOR SELECT USING (true);


--
-- Name: story_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."story_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: story_views story_views_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_views_insert" ON "public"."story_views" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: story_views story_views_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_views_select" ON "public"."story_views" FOR SELECT USING (true);


--
-- Name: story_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."story_votes" ENABLE ROW LEVEL SECURITY;

--
-- Name: story_votes story_votes_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_votes_delete" ON "public"."story_votes" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: story_votes story_votes_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_votes_insert" ON "public"."story_votes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: story_votes story_votes_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "story_votes_select" ON "public"."story_votes" FOR SELECT USING (true);


--
-- Name: post_reports user can insert own reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user can insert own reports" ON "public"."post_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reporter_id"));


--
-- Name: post_reports user can read own reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user can read own reports" ON "public"."post_reports" FOR SELECT USING (("auth"."uid"() = "reporter_id"));


--
-- Name: user_blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_blocks user_blocks_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_blocks_delete" ON "public"."user_blocks" FOR DELETE USING (("blocker_id" = "auth"."uid"()));


--
-- Name: user_blocks user_blocks_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_blocks_insert" ON "public"."user_blocks" FOR INSERT WITH CHECK (("blocker_id" = "auth"."uid"()));


--
-- Name: user_blocks user_blocks_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_blocks_select" ON "public"."user_blocks" FOR SELECT USING (("blocker_id" = "auth"."uid"()));


--
-- Name: web_push_subscriptions user_manages_own_web_push_subs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_manages_own_web_push_subs" ON "public"."web_push_subscriptions" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_reports user_reports_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_reports_insert" ON "public"."user_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reporter_id"));


--
-- Name: user_reports user_reports_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_reports_select_own" ON "public"."user_reports" FOR SELECT USING (("auth"."uid"() = "reporter_id"));


--
-- Name: user_tag_affinity; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_tag_affinity" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_tag_affinity user_tag_affinity_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_tag_affinity_select_own" ON "public"."user_tag_affinity" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: user_vibe_profile; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_vibe_profile" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_whip_ingresses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_whip_ingresses" ENABLE ROW LEVEL SECURITY;

--
-- Name: coins_wallets wallet_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "wallet_select_own" ON "public"."coins_wallets" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: coins_wallets wallet_update_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "wallet_update_service" ON "public"."coins_wallets" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: web_coin_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."web_coin_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: web_coin_orders web_coin_orders_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "web_coin_orders_select_own" ON "public"."web_coin_orders" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: web_coin_orders web_coin_orders_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "web_coin_orders_service_write" ON "public"."web_coin_orders" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: web_push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."web_push_subscriptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: women_only_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."women_only_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: women_only_requests woz_requests_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "woz_requests_select_own" ON "public"."women_only_requests" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));


--
-- PostgreSQL database dump complete
--

-- \unrestrict gf26gkQhJL3bsIhblDyKMmTk5KAVWMZtVvbKmxlRbahok4BER0asdKBpm0pdgzq

