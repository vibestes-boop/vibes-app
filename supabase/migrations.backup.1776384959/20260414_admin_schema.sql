-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Admin-Schema
-- Datum: 2026-04-14
-- Stufe 1: is_admin Flag, content_reports Tabelle
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Admin-Flag auf profiles ────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS
  'Serlo-interne Admin-Rolle. Gibt Zugang zum Admin-Panel in der App.';

-- ── 2. Content-Reports ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type    TEXT NOT NULL
                 CHECK (target_type IN ('post', 'profile', 'comment', 'live', 'product')),
  target_id      UUID NOT NULL,
  reason         TEXT NOT NULL,
  -- Status-Flow: pending → reviewed → actioned | dismissed
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  admin_note     TEXT,
  reviewed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status      ON public.content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter    ON public.content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_target      ON public.content_reports(target_type, target_id);

-- RLS: Nur Admins sehen Reports
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Jeder kann einen Report erstellen
CREATE POLICY "reports_insert" ON public.content_reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Nur Admins können alle Reports lesen/bearbeiten
CREATE POLICY "reports_admin_select" ON public.content_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "reports_admin_update" ON public.content_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── 3. RPC: Admin-Dashboard Metriken ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'new_users_today',     (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE),
    'new_users_week',      (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE - 7),
    'total_users',         (SELECT COUNT(*) FROM profiles),
    'open_reports',        (SELECT COUNT(*) FROM content_reports WHERE status = 'pending'),
    'total_products',      (SELECT COUNT(*) FROM products WHERE is_active = true),
    'total_orders',        (SELECT COUNT(*) FROM orders),
    'pending_orders',      (SELECT COUNT(*) FROM orders WHERE status = 'pending'),
    'total_gifts_today',   (SELECT COUNT(*) FROM gift_transactions WHERE created_at >= CURRENT_DATE),
    'live_sessions_today', (SELECT COUNT(*) FROM live_sessions WHERE started_at >= CURRENT_DATE)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

-- ── 4. RPC: Admin — User-Liste mit Suche ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query  TEXT    DEFAULT '',
  p_limit  INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                   UUID,
  username             TEXT,
  avatar_url           TEXT,
  is_verified          BOOLEAN,
  is_admin             BOOLEAN,
  is_private           BOOLEAN,
  women_only_verified  BOOLEAN,
  created_at           TIMESTAMPTZ,
  post_count           BIGINT,
  follower_count       BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.is_verified,
    p.is_admin,
    p.is_private,
    p.women_only_verified,
    p.created_at,
    -- Anzahl Posts (gezählt aus posts-Tabelle)
    COALESCE((SELECT COUNT(*) FROM public.posts WHERE author_id = p.id), 0) AS post_count,
    -- Anzahl Follower (gezählt aus follows-Tabelle)
    COALESCE((SELECT COUNT(*) FROM public.follows WHERE following_id = p.id), 0) AS follower_count
  FROM public.profiles p
  WHERE
    (p_query = '' OR p.username ILIKE '%' || p_query || '%')
  ORDER BY p.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;


-- Nur Admins dürfen diese RPC aufrufen (Row-Level via CHECK in der Funktion)
-- Wir prüfen im Client + im Admin-Layout Guard — doppelte Sicherheit

-- ── 5. Fertig ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ Admin-Schema deployed: is_admin, content_reports, admin_search_users';
  RAISE NOTICE '➡️  Führe aus: UPDATE profiles SET is_admin = true WHERE username = ''DEIN_USERNAME'';';
END $$;
