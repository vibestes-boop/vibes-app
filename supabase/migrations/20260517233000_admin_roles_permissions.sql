-- Admin role split for Command Center, moderation, operations, and creator ops.
-- Keeps is_admin as the superuser role while adding narrower operational roles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_operator BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_creator_ops BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_moderator IS
  'Can review and enforce content reports without full admin privileges.';
COMMENT ON COLUMN public.profiles.is_operator IS
  'Can view production health, release, queue, cost, and product command-center signals.';
COMMENT ON COLUMN public.profiles.is_creator_ops IS
  'Can view creator/shop payout operations without full admin privileges.';

CREATE OR REPLACE FUNCTION public.current_user_admin_roles()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.can_moderate()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.can_operate()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.can_creator_ops()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.has_admin_console_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

DROP POLICY IF EXISTS "reports_admin_select" ON public.content_reports;
CREATE POLICY "reports_admin_select" ON public.content_reports
  FOR SELECT USING (public.can_moderate());

DROP POLICY IF EXISTS "reports_admin_update" ON public.content_reports;
CREATE POLICY "reports_admin_update" ON public.content_reports
  FOR UPDATE USING (public.can_moderate());

DROP POLICY IF EXISTS "admin_audit_log_admin_select" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_admin_select" ON public.admin_audit_log
  FOR SELECT USING (
    public.is_admin() OR public.can_moderate() OR public.can_operate() OR public.can_creator_ops()
  );

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

DROP FUNCTION IF EXISTS public.admin_search_users(TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query  TEXT    DEFAULT '',
  p_limit  INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                   UUID,
  username             TEXT,
  display_name         TEXT,
  avatar_url           TEXT,
  is_verified          BOOLEAN,
  is_admin             BOOLEAN,
  is_moderator         BOOLEAN,
  is_operator          BOOLEAN,
  is_creator_ops       BOOLEAN,
  is_banned            BOOLEAN,
  is_restricted        BOOLEAN,
  restricted_until     TIMESTAMPTZ,
  is_shadow_banned     BOOLEAN,
  women_only_verified  BOOLEAN,
  is_creator           BOOLEAN,
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

DROP FUNCTION IF EXISTS public.admin_get_seller_balances();

CREATE OR REPLACE FUNCTION public.admin_get_seller_balances()
RETURNS TABLE (
  seller_id       UUID,
  username        TEXT,
  avatar_url      TEXT,
  diamond_balance BIGINT,
  total_earned    BIGINT,
  pending_orders  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.admin_resolve_content_report(
  p_report_id   UUID,
  p_status      TEXT,
  p_admin_note  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.admin_enforce_content_report(
  p_report_id  UUID,
  p_action     TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_report public.content_reports%ROWTYPE;
  v_note TEXT := NULLIF(trim(COALESCE(p_admin_note, '')), '');
  v_deleted_post RECORD;
  v_live_session RECORD;
  v_restricted_until TIMESTAMPTZ := NOW() + INTERVAL '7 days';
  v_live_mute_until TIMESTAMPTZ := NOW() + INTERVAL '1 hour';
  v_actor_roles JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT public.can_moderate() THEN
    RETURN jsonb_build_object('error', 'not_moderator');
  END IF;

  SELECT public.current_user_admin_roles() INTO v_actor_roles;

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
         reviewed_by = v_actor,
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
    v_actor,
    'moderation.enforcement.' || p_action,
    v_report.target_type,
    v_report.target_id,
    jsonb_build_object(
      'report_id', v_report.id,
      'reason', v_report.reason,
      'reporter_id', v_report.reporter_id,
      'actor_roles', v_actor_roles,
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

REVOKE ALL ON FUNCTION public.current_user_admin_roles() FROM public, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
REVOKE ALL ON FUNCTION public.can_moderate() FROM public, anon;
REVOKE ALL ON FUNCTION public.can_operate() FROM public, anon;
REVOKE ALL ON FUNCTION public.can_creator_ops() FROM public, anon;
REVOKE ALL ON FUNCTION public.has_admin_console_access() FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_search_users(TEXT, INTEGER, INTEGER) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_get_seller_balances() FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_content_report(UUID, TEXT, TEXT) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_enforce_content_report(UUID, TEXT, TEXT) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.current_user_admin_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_moderate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_operate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_creator_ops() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_console_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_users(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_seller_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_content_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_enforce_content_report(UUID, TEXT, TEXT) TO authenticated;
