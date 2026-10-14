-- ─────────────────────────────────────────────────────────────────────────────
-- Creator-Auswertungen: nur die eigenen Zahlen (Nachtrag zu 20260822170000/190000)
--
-- BEFUND (bewusst offen gelassen in 20260822170000, „WAS DIESE MIGRATION NICHT
-- LÖST"): Vier SECURITY-DEFINER-Funktionen nehmen eine Nutzer-ID als Parameter
-- und vergleichen sie nie mit auth.uid(). Seit 22.08. sind sie für anon zu, aber
-- jeder ANGEMELDETE Nutzer kann eine fremde ID übergeben:
--
--   get_creator_top_posts(p_user_id, p_sort, p_limit)  → Bildpfad + Text auch
--                                                        privater und Frauen-Only-
--                                                        Beiträge (einziges Prädikat:
--                                                        p.author_id = p_user_id)
--   get_creator_gift_history(p_user_id, p_limit)       → Namen + Avatare der Schenker
--   get_creator_overview(p_user_id, p_days)            → Reichweite, Likes, Follower
--   get_creator_follower_growth(p_user_id, p_days)     → Follower-Verlauf pro Tag
--
-- Lokal nachgestellt (Wegwerf-Postgres mit den Live-Definitionen): Nutzer B
-- bekommt Overview und Follower-Verlauf von Nutzer A ohne Fehler heraus.
-- Die fünfte im Bunde, get_creator_earnings, schließt 20261014120000 Abschnitt (d)
-- (Zweig fix/payout-server-guard). Hier dieselbe Bauart.
--
-- FIX: CREATE OR REPLACE mit GLEICHER Signatur (Namen, Typen, Defaults), gleichem
-- Rückgabetyp, gleicher Volatilität (VOLATILE, wie live) und gepinntem search_path
-- (wie live seit 20260614190000). CREATE OR REPLACE behält die Grants; ein DROP
-- würde die ausgelieferte App brechen und die Rechte auf anon zurückfallen lassen.
-- Rumpf = Live-Stand aus schema_live.sql — per diff byte-identisch mit
-- 20260407010000 (overview, top_posts, follower_growth) bzw. 20260414040000
-- (gift_history); keine spätere Migration hat die Rümpfe angefasst. Neu ist nur
-- der Guard vorne:
--   Externe Aufrufer (anon/authenticated) nur für die eigene ID, Admins
--   (is_admin()) alles; service_role und direkte DB-Verbindung unverändert.
--   Fremde ID → 42501 (wie „gesperrt"), keine geschönte leere Antwort.
--
-- AUFRUFER (alle mit der eigenen ID, nachgesehen 14.10.2026):
--   App: lib/useAnalytics.ts ← app/creator/dashboard.tsx und
--        components/profile/AnalyticsTab.tsx, das nur im EIGENEN Profil-Tab
--        app/(tabs)/profile.tsx hängt — beide mit useAuthStore().profile.id.
--   Web: apps/web/lib/data/studio.ts (user.id aus auth.getUser())
--        ← apps/web/app/studio/{page,analytics/page,revenue/page}.tsx.
--   Kein fremdes Profil, keine Edge Function, keine SQL-Funktion ruft sie.
--
-- ⚠️ BEKANNT, BEWUSST NICHT HIER: get_creator_top_posts scheitert live bei JEDEM
-- Aufruf, auch mit der eigenen ID, mit 42702 („column reference "post_id" is
-- ambiguous"): `SELECT post_id … GROUP BY post_id` in den beiden Unterabfragen
-- kollidiert mit der OUT-Spalte post_id (gemessen 22.08., siehe 20260822190000;
-- lokal nachgestellt). Die Top-Beiträge in App und Web sind deshalb leer. Der
-- Guard steht VOR der Abfrage: Eine fremde ID bekommt schon jetzt 42501, und das
-- Leck bleibt zu, wenn der Rumpf repariert wird. Die Reparatur selbst ist eine
-- eigene Änderung (sichtbare Funktion, die es nie gab), kein Anhängsel hiervon.
--
-- Tests: supabase/tests/creator_analytics_guard.sql
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. get_creator_top_posts ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_creator_top_posts(
  p_user_id UUID,
  p_sort    TEXT    DEFAULT 'views',
  p_limit   INT     DEFAULT 5
)
RETURNS TABLE (
  post_id       UUID,
  caption       TEXT,
  media_url     TEXT,
  media_type    TEXT,
  thumbnail_url TEXT,
  view_count    INT,
  like_count    BIGINT,
  comment_count BIGINT,
  created_at    TIMESTAMPTZ,
  rank          BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  -- 14.10.2026: Externe Aufrufer nur für sich selbst (Admins ausgenommen).
  IF auth.role() IN ('anon', 'authenticated')
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Zugriff auf die Beiträge-Auswertung anderer Creator.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

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

-- CREATE OR REPLACE mit gleicher Signatur behält die Grants — trotzdem
-- ausdrücklich, damit ein späterer Leser nicht raten muss (PUBLIC UND anon).
REVOKE ALL ON FUNCTION public.get_creator_top_posts(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_top_posts(uuid, text, integer) TO authenticated, service_role;


-- ── 2. get_creator_gift_history ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_creator_gift_history(
  p_user_id  UUID,
  p_limit    INT DEFAULT 10
)
RETURNS TABLE (
  gift_name     TEXT,
  gift_emoji    TEXT,
  diamond_value INTEGER,
  sender_name   TEXT,
  sender_avatar TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  -- 14.10.2026: Externe Aufrufer nur für sich selbst (Admins ausgenommen).
  IF auth.role() IN ('anon', 'authenticated')
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Zugriff auf die Geschenk-Historie anderer Creator.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

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

REVOKE ALL ON FUNCTION public.get_creator_gift_history(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_gift_history(uuid, integer) TO authenticated, service_role;


-- ── 3. get_creator_overview ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_creator_overview(
  p_user_id  UUID,
  p_days     INT DEFAULT 28
)
RETURNS TABLE (
  total_views       BIGINT,
  total_likes       BIGINT,
  total_comments    BIGINT,
  prev_views        BIGINT,
  prev_likes        BIGINT,
  prev_comments     BIGINT,
  total_followers   BIGINT,
  new_followers     BIGINT,
  prev_followers    BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_cutoff      TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
  v_prev_cutoff TIMESTAMPTZ := NOW() - (p_days * 2 || ' days')::INTERVAL;
BEGIN
  -- 14.10.2026: Externe Aufrufer nur für sich selbst (Admins ausgenommen).
  IF auth.role() IN ('anon', 'authenticated')
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Zugriff auf die Auswertung anderer Creator.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

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

REVOKE ALL ON FUNCTION public.get_creator_overview(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_overview(uuid, integer) TO authenticated, service_role;


-- ── 4. get_creator_follower_growth ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_creator_follower_growth(
  p_user_id UUID,
  p_days    INT DEFAULT 28
)
RETURNS TABLE (
  day           DATE,
  new_followers BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  -- 14.10.2026: Externe Aufrufer nur für sich selbst (Admins ausgenommen).
  IF auth.role() IN ('anon', 'authenticated')
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kein Zugriff auf das Follower-Wachstum anderer Creator.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

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

REVOKE ALL ON FUNCTION public.get_creator_follower_growth(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_follower_growth(uuid, integer) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN nach dem Einspielen
--
-- 1. Von aussen, angemeldet als Creator A, mit A's JWT:
--      POST /rest/v1/rpc/get_creator_overview {"p_user_id":"<B>"}
--      → 403/42501 „Kein Zugriff auf die Auswertung anderer Creator."
--      Mit "<A>" → 200 wie bisher. Dasselbe für get_creator_gift_history und
--      get_creator_follower_growth.
--    get_creator_top_posts {"p_user_id":"<B>"} → 403/42501; mit "<A>" weiterhin
--      400/42702 (bekannter Rumpf-Fehler, siehe Kopf) — NICHT 42501.
-- 2. anon bleibt zu: alle vier mit dem öffentlichen Schlüssel → 401/42501.
-- 3. App: Profil → Analytics-Tab und Creator-Dashboard; Web: /studio,
--    /studio/analytics, /studio/revenue — Zahlen unverändert.
-- 4. Rechte (PUBLIC und anon müssen beide fehlen):
--      SELECT p.proname,
--             has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_darf,
--             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS user_darf
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public' AND p.proname LIKE 'get_creator_%'
--       ORDER BY 1;
--      -- erwartet: anon_darf = false, user_darf = true
-- ─────────────────────────────────────────────────────────────────────────────
