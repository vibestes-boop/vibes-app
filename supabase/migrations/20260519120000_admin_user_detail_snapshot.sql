-- Admin user detail snapshot for /admin/users.
-- Keeps auth identity data behind an admin-only SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.admin_record_user_action(
  p_target_user_id UUID,
  p_action         TEXT,
  p_metadata       JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
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

CREATE OR REPLACE FUNCTION public.admin_user_detail_snapshot(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.admin_record_user_action(UUID, TEXT, JSONB) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_user_detail_snapshot(UUID) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.admin_record_user_action(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_detail_snapshot(UUID) TO authenticated;
