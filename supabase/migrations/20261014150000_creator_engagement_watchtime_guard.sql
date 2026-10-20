-- ─────────────────────────────────────────────────────────────────────────────
-- Creator-Auswertungen, Teil 2: Aktivitätszeiten + Watch-Time nur für die eigene ID
-- (Nachtrag zu 20261014130000_creator_analytics_guard.sql)
--
-- BEFUND 14.10.2026 (beim Live-Abgleich nach 20261014130000): Zwei weitere
-- SECURITY-DEFINER-Funktionen aus 20260418150000_creator_studio_pro.sql nehmen
-- eine Nutzer-ID und vergleichen sie nie mit auth.uid():
--
--   get_creator_engagement_hours(p_user_id, p_days)     → wann die Likes und
--                                                         Kommentare eines fremden
--                                                         Creators eintreffen (7×24)
--   get_creator_watch_time_estimate(p_user_id, p_days)  → Aufrufe der Beiträge eines
--                                                         fremden Creators im Zeitraum
--
-- anon und PUBLIC sind seit April zu (REVOKE in 20260418150000, live geprüft
-- 14.10.), aber jeder angemeldete Nutzer konnte eine fremde ID übergeben.
--
-- FIX: dieselbe Prüfung wie in 20261014130000 und get_creator_earnings —
-- Externe Aufrufer (anon/authenticated) nur für die eigene ID, Admins
-- (is_admin()) alles; service_role und direkte DB-Verbindung unverändert.
-- Fremde oder leere ID → 42501.
--
-- ⚠️ SPRACHE: Beide waren LANGUAGE sql. Dort gibt es kein RAISE, also hier
-- LANGUAGE plpgsql mit `RETURN QUERY` + dem bisherigen SQL-Text, ZEICHENGENAU
-- übernommen (Live-Stand schema_live.sql = 20260418150000, per diff geprüft).
-- Unverändert: Signatur (Namen, Typen, Defaults), Rückgabetyp, STABLE,
-- SECURITY DEFINER, search_path = public (wie live; Sprachwechsel ist per
-- CREATE OR REPLACE erlaubt, nur Signatur und Rückgabetyp nicht).
-- Die Falle bei plpgsql: RETURNS-TABLE-Spalten sind dort Variablen, und ein
-- gleichnamiger unqualifizierter Spaltenname in der Abfrage gibt 42702 (so ist
-- get_creator_top_posts kaputt). Hier geprüft: Die Abfragen benutzen keine
-- Spalte namens weekday/hour_of_day/engagement_count bzw. total_seconds_est/
-- total_views/avg_seconds_per_view; `GROUP BY weekday, hour_of_day` greift auf
-- die Ausgabe-Aliase (keine gleichnamige Eingabespalte). Der Test vergleicht die
-- Ergebnisse mit mehreren Wochentagen/Stunden gegen die alte sql-Fassung.
--
-- AUFRUFER (alle mit der eigenen ID, nachgesehen 14.10.2026):
--   App: lib/useAnalytics.ts (useCreatorEngagementHours, useCreatorWatchTime)
--        ← app/creator/dashboard.tsx mit useAuthStore().profile.id.
--   Web: apps/web/lib/data/studio.ts (getPeakHours, getWatchTime, user.id aus
--        auth.getUser()) ← apps/web/app/studio/analytics/page.tsx.
--   Keine Edge Function, keine SQL-Funktion ruft sie.
--
-- Tests: supabase/tests/creator_engagement_watchtime_guard.sql
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. get_creator_engagement_hours ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_creator_engagement_hours(
  p_user_id UUID,
  p_days    INT DEFAULT 28
)
RETURNS TABLE (
  weekday          INT,
  hour_of_day      INT,
  engagement_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 14.10.2026: Externe Aufrufer nur für sich selbst (Admins ausgenommen).
  IF auth.role() IN ('anon', 'authenticated')
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Zugriff auf die Aktivitätszeiten anderer Creator.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
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
END;
$$;

-- CREATE OR REPLACE mit gleicher Signatur behält die Grants — trotzdem
-- ausdrücklich, damit ein späterer Leser nicht raten muss (PUBLIC UND anon).
REVOKE ALL ON FUNCTION public.get_creator_engagement_hours(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_engagement_hours(uuid, integer) TO authenticated, service_role;


-- ── 2. get_creator_watch_time_estimate ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_creator_watch_time_estimate(
  p_user_id UUID,
  p_days    INT DEFAULT 28
)
RETURNS TABLE (
  total_seconds_est  BIGINT,
  total_views        BIGINT,
  avg_seconds_per_view NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 14.10.2026: Externe Aufrufer nur für sich selbst (Admins ausgenommen).
  IF auth.role() IN ('anon', 'authenticated')
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Zugriff auf die Watch-Time anderer Creator.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    (COALESCE(SUM(view_count), 0) * 8)::BIGINT                              AS total_seconds_est,
    COALESCE(SUM(view_count), 0)::BIGINT                                    AS total_views,
    CASE WHEN COALESCE(SUM(view_count), 0) > 0 THEN 8::NUMERIC ELSE 0 END   AS avg_seconds_per_view
    FROM public.posts
   WHERE author_id = p_user_id
     AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_creator_watch_time_estimate(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_watch_time_estimate(uuid, integer) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN nach dem Einspielen
--
-- 1. Angemeldet als Creator A, mit A's JWT:
--      POST /rest/v1/rpc/get_creator_engagement_hours {"p_user_id":"<B>"}
--      → 403/42501 „Kein Zugriff auf die Aktivitätszeiten anderer Creator."
--      Mit "<A>" → 200 wie bisher. Dasselbe für get_creator_watch_time_estimate.
-- 2. anon bleibt zu: beide mit dem öffentlichen Schlüssel → 401/42501.
-- 3. Web /studio/analytics (Aktivitäts-Heatmap, Watch-Time) und App
--    Creator-Dashboard: Zahlen unverändert.
-- 4. Live ist plpgsql, STABLE, search_path=public:
--      SELECT proname, l.lanname, provolatile, proconfig
--        FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
--       WHERE proname IN ('get_creator_engagement_hours', 'get_creator_watch_time_estimate');
-- ─────────────────────────────────────────────────────────────────────────────
