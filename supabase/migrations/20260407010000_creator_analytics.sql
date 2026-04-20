-- ─────────────────────────────────────────────────────────────────────────────
-- VIBES — Creator Analytics RPCs
-- Erstellt: April 2026
-- Zweck: Liefert aggregierte Metriken für das Creator Analytics Dashboard
--
-- 3 RPCs:
--   1. get_creator_overview     → Gesamt-Metriken (Views, Likes, Comments, Engagement)
--   2. get_creator_top_posts    → Top Posts nach Views oder Likes
--   3. get_creator_follower_growth → Follower-Wachstum pro Woche
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Übersicht: Gesamt-Metriken für einen Zeitraum ─────────────────────────
-- Gibt aktuelle Periode UND vorherige Periode zurück (für % Veränderung im UI)
-- p_days: 7, 28 oder 60
CREATE OR REPLACE FUNCTION public.get_creator_overview(
  p_user_id  UUID,
  p_days     INT DEFAULT 28
)
RETURNS TABLE (
  total_views       BIGINT,
  total_likes       BIGINT,
  total_comments    BIGINT,
  -- Vorherige Periode (für Delta-Berechnung im UI)
  prev_views        BIGINT,
  prev_likes        BIGINT,
  prev_comments     BIGINT,
  -- Follower gesamt (all-time) und neue im Zeitraum
  total_followers   BIGINT,
  new_followers     BIGINT,
  prev_followers    BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ── 2. Top Posts ──────────────────────────────────────────────────────────────
-- Gibt die Top p_limit Posts des Users zurück, sortiert nach Views oder Likes
-- p_sort: 'views' | 'likes' | 'comments'
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

-- ── 3. Follower-Wachstum ──────────────────────────────────────────────────────
-- Gibt neue Follower pro Tag für die letzten p_days Tage zurück
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

-- ── 4. is_verified Spalte für Verification Badge ──────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

-- Index für schnelle Abfrage
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON public.profiles(is_verified) WHERE is_verified = true;

-- Verifikation
DO $$
BEGIN
  RAISE NOTICE '✅ Creator Analytics RPCs und is_verified Spalte erstellt';
END $$;
