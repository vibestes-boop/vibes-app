-- SERLO/VIBES — Live audience snapshot for viewer rail
--
-- The raw live_session_viewers table intentionally keeps strict RLS: users can
-- see their own row, hosts can see the full room. The desktop viewer rail needs
-- a limited product-facing snapshot, so expose only public profile fields for
-- active sessions through a SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.get_live_session_audience(
  p_session_id UUID,
  p_limit INT DEFAULT 24
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN,
  joined_at TIMESTAMPTZ,
  is_moderator BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_live_session_audience(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_session_audience(UUID, INT) TO authenticated;

COMMENT ON FUNCTION public.get_live_session_audience(UUID, INT) IS
  'Limited active live-room audience snapshot for authenticated viewers. Returns public profile fields only.';
