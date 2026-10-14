-- ─────────────────────────────────────────────────────────────────────────────
-- get_creator_top_posts: 42702 „post_id is ambiguous" behoben
-- (Nachtrag zu 20261014130000_creator_analytics_guard.sql)
--
-- BEFUND: Die Funktion ist plpgsql mit RETURNS TABLE (post_id uuid, …). Die
-- RETURNS-TABLE-Spalten sind im Rumpf plpgsql-Variablen. Die beiden
-- Unterabfragen
--     SELECT post_id, COUNT(*) … FROM public.likes    GROUP BY post_id
--     SELECT post_id, COUNT(*) … FROM public.comments GROUP BY post_id
-- nennen post_id unqualifiziert → Postgres kann Variable und Tabellenspalte
-- nicht unterscheiden und bricht JEDEN Aufruf mit 42702 ab (live gemessen
-- 22.08., siehe Kopf 20260822190000; lokal mit 20261014130000 nachgestellt).
-- Folge: Die Top-Beiträge waren in App und Web schon immer leer —
--   App: lib/useAnalytics.ts useCreatorTopPosts ← app/creator/dashboard.tsx,
--        components/profile/AnalyticsTab.tsx
--   Web: apps/web/lib/data/studio.ts getCreatorTopPosts ← apps/web/app/studio/
--        page.tsx, apps/web/app/studio/analytics/page.tsx
--
-- FIX: CREATE OR REPLACE mit GLEICHER Signatur (Namen, Typen, Defaults),
-- gleichem Rückgabetyp, VOLATILE, SECURITY DEFINER und gepinntem search_path.
-- Rumpf = Stand aus 20261014130000 (per diff geprüft), Guard vorne unverändert.
-- Geändert sind NUR die beiden Unterabfragen: Tabellen-Alias lk / cm, alle
-- Spalten darin qualifiziert (auch cm.parent_id, damit die nächste OUT-Spalte
-- nicht wieder dieselbe Falle aufmacht). Sonst nichts — keine Zeitgrenze,
-- kein Gleichstand-Tiebreaker, keine neuen Spalten.
--
-- WAS JETZT SICHTBAR WIRD: Der Creator sieht seine Top-Beiträge, auch private
-- und Frauen-Only-Beiträge — gewollt, denn es sind seine eigenen. Fremde IDs
-- blockt der Guard aus 20261014130000 mit 42501, bevor die Abfrage läuft;
-- Admins und service_role dürfen wie bisher alles.
--
-- Tests: supabase/tests/creator_analytics_guard.sql (verlangt jetzt Zeilen
-- und die richtige Reihenfolge für views / likes / comments).
-- ─────────────────────────────────────────────────────────────────────────────

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
      -- 14.10.2026: qualifiziert — unqualifiziertes post_id kollidierte mit der
      -- OUT-Spalte post_id (42702 bei jedem Aufruf, siehe Kopf).
      SELECT lk.post_id, COUNT(*) AS like_count
      FROM public.likes lk
      GROUP BY lk.post_id
    ) l ON l.post_id = p.id
    LEFT JOIN (
      SELECT cm.post_id, COUNT(*) AS comment_count
      FROM public.comments cm
      WHERE cm.parent_id IS NULL
      GROUP BY cm.post_id
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
-- ausdrücklich (PUBLIC UND anon), siehe 20260822190000.
REVOKE ALL ON FUNCTION public.get_creator_top_posts(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_top_posts(uuid, text, integer) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN nach dem Einspielen (erst NACH 20261014130000)
--
-- 1. Angemeldet als Creator A, mit A's JWT:
--      POST /rest/v1/rpc/get_creator_top_posts {"p_user_id":"<A>","p_sort":"likes","p_limit":5}
--      → 200 mit A's Beiträgen (vorher 400/42702). Mit "<B>" → 403/42501.
-- 2. anon bleibt zu: derselbe Aufruf mit dem öffentlichen Schlüssel → 401/42501.
-- 3. App: Profil → Analytics-Tab „Top-Inhalte" (Umschalter Aufrufe/Likes/
--    Kommentare) und Creator-Dashboard „Top Posts"; Web: /studio und
--    /studio/analytics?sort=likes — die Listen sind jetzt gefüllt.
-- 4. Rechte wie in 20261014130000, Gegenprobe 4 (anon_darf = false).
-- ─────────────────────────────────────────────────────────────────────────────
