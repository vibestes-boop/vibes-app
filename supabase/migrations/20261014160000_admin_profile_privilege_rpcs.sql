-- ─────────────────────────────────────────────────────────────────────────────
-- Admin-Konsole: Rollen, Sperren und Verifizierung über SECURITY-DEFINER-RPCs
--
-- WOHER (14.10.2026)
-- Zaur hat entschieden: Den Creator-Status vergibt nur ein Admin (a95bb611).
-- Der Admin-Weg in der Web-Konsole (/admin/users) hat aber nie fremde Profile
-- geändert. Die fünf Server-Actions in apps/web/app/actions/admin.ts
--   adminSetUserRole, adminBanUser, adminVerifyUser, adminToggleAdmin,
--   adminSetUserSafetyState
-- schrieben mit der Sitzung des Admins (Rolle `authenticated`) per
--   .from('profiles').update(...).eq('id', fremdeId)
-- Auf profiles gibt es genau EINE UPDATE-Policy: „User kann eigenes Profil
-- bearbeiten" USING (auth.uid() = id). Die fremde Zeile wird weggefiltert →
-- 0 Zeilen, KEIN Fehler → die Konsole meldete „Rolle gesetzt", der Audit-Log
-- bekam einen Eintrag, am Profil änderte sich nichts.
-- Selbst mit einer Admin-Policy käme der Schreibzugriff nicht durch: Der
-- Wächter guard_profile_privileges (20260822150000, neueste Fassung in
-- 20260825120000) blockt jede Änderung an den Rechte-Spalten durch
-- anon/authenticated mit 42501. Beides im Wegwerf-Postgres nachgestellt.
--
-- WIE
-- Fünf schmale SECURITY-DEFINER-Funktionen, eine pro Aktion. Sie laufen als
-- Eigentümer (postgres) und kommen damit am Wächter vorbei — genau wie
-- admin_enforce_content_report und approve_women_only. Jede Funktion
--   1. verlangt eine Anmeldung und public.is_admin()   → sonst 42501
--   2. verweigert Selbst-Herabstufung und Selbst-Sanktion → 42501
--   3. sperrt die Zielzeile (FOR UPDATE), fehlt sie → P0002 profile_not_found
--   4. schreibt die Änderung UND den Audit-Eintrag in derselben Transaktion
--      (vorher: Audit getrennt per admin_record_user_action, auch bei 0 Zeilen)
-- Fehler werden geworfen, nicht als {error: …} zurückgegeben: Die Web-Action
-- kann sie dann nicht still verschlucken.
--
-- RECHTE
-- CREATE OR REPLACE behält Rechte, DROP + CREATE setzt sie auf den
-- Supabase-Standard zurück (EXECUTE für PUBLIC und anon). Deshalb unten für
-- jede Funktion ausdrücklich REVOKE von PUBLIC/anon und GRANT an authenticated.
-- Die Hilfsfunktion admin_profile_lock_target ist für Clients gar nicht
-- aufrufbar; die fünf Funktionen rufen sie als Eigentümer.
--
-- BEWUSST NICHT HIER
-- * Einladungen (adminInviteUser) setzen die Rolle weiter mit dem
--   service_role-Schlüssel — der Wächter lässt service_role durch.
-- * Die Datenbank-Sperre in auth.users (banned_until) bleibt unberührt; die
--   Konsole hat sie nie gesetzt.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Gemeinsame Prüfung: Aufrufer ist Admin, Zielprofil existiert ──────────────
CREATE OR REPLACE FUNCTION public.admin_profile_lock_target(p_user_id uuid)
RETURNS public.profiles
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_row FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_profile_lock_target(uuid) FROM PUBLIC, anon, authenticated;

-- ── 1 · Rolle setzen (Admin, Moderator, Operator, Creator-Ops, Creator, Mitglied)
-- Eine Rolle schließt die anderen aus — wie das Auswahlfeld in /admin/users.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old   public.profiles%ROWTYPE;
  v_new   jsonb;
BEGIN
  v_old := public.admin_profile_lock_target(p_user_id);

  IF p_role IS NULL OR p_role NOT IN ('admin', 'moderator', 'operator', 'creator_ops', 'creator', 'user') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_user_id = v_actor AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'cannot_demote_self' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.profiles
     SET is_admin       = (p_role = 'admin'),
         is_moderator   = (p_role = 'moderator'),
         is_operator    = (p_role = 'operator'),
         is_creator_ops = (p_role = 'creator_ops'),
         is_creator     = (p_role = 'creator')
   WHERE id = p_user_id;

  v_new := jsonb_build_object(
    'role',           p_role,
    'is_admin',       p_role = 'admin',
    'is_moderator',   p_role = 'moderator',
    'is_operator',    p_role = 'operator',
    'is_creator_ops', p_role = 'creator_ops',
    'is_creator',     p_role = 'creator'
  );

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (v_actor, 'admin.user.set_role', 'profile', p_user_id,
          v_new || jsonb_build_object('previous', jsonb_build_object(
            'is_admin',       v_old.is_admin,
            'is_moderator',   v_old.is_moderator,
            'is_operator',    v_old.is_operator,
            'is_creator_ops', v_old.is_creator_ops,
            'is_creator',     v_old.is_creator)));

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id) || v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

-- ── 2 · Admin-Recht einzeln vergeben/entziehen (andere Rollen bleiben) ────────
CREATE OR REPLACE FUNCTION public.admin_set_user_admin(p_user_id uuid, p_is_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old   public.profiles%ROWTYPE;
BEGIN
  v_old := public.admin_profile_lock_target(p_user_id);

  IF p_is_admin IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_user_id = v_actor AND NOT p_is_admin THEN
    RAISE EXCEPTION 'cannot_demote_self' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.profiles SET is_admin = p_is_admin WHERE id = p_user_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (v_actor,
          CASE WHEN p_is_admin THEN 'admin.user.make_admin' ELSE 'admin.user.remove_admin' END,
          'profile', p_user_id,
          jsonb_build_object('is_admin', p_is_admin,
                             'previous', jsonb_build_object('is_admin', v_old.is_admin)));

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'is_admin', p_is_admin);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_admin(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_admin(uuid, boolean) TO authenticated;

-- ── 3 · Verifizierungs-Haken ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_verified(p_user_id uuid, p_verified boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old   public.profiles%ROWTYPE;
BEGIN
  v_old := public.admin_profile_lock_target(p_user_id);

  IF p_verified IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.profiles SET is_verified = p_verified WHERE id = p_user_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (v_actor,
          CASE WHEN p_verified THEN 'admin.user.verify' ELSE 'admin.user.unverify' END,
          'profile', p_user_id,
          jsonb_build_object('is_verified', p_verified,
                             'previous', jsonb_build_object('is_verified', v_old.is_verified)));

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'is_verified', p_verified);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_verified(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_verified(uuid, boolean) TO authenticated;

-- ── 4 · Sperren / Entsperren ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_banned(p_user_id uuid, p_banned boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old   public.profiles%ROWTYPE;
BEGIN
  v_old := public.admin_profile_lock_target(p_user_id);

  IF p_banned IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_user_id = v_actor AND p_banned THEN
    RAISE EXCEPTION 'cannot_sanction_self' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.profiles SET is_banned = p_banned WHERE id = p_user_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (v_actor,
          CASE WHEN p_banned THEN 'admin.user.ban' ELSE 'admin.user.unban' END,
          'profile', p_user_id,
          jsonb_build_object('is_banned', p_banned,
                             'previous', jsonb_build_object('is_banned', v_old.is_banned)));

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'is_banned', p_banned);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_banned(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_banned(uuid, boolean) TO authenticated;

-- ── 5 · Einschränken (30 Tage) / Shadowban, jeweils mit Rückweg ──────────────
-- Einschränken verkürzt eine laufende längere Einschränkung nicht
-- (wie admin_enforce_content_report).
CREATE OR REPLACE FUNCTION public.admin_set_user_safety_state(p_user_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old   public.profiles%ROWTYPE;
  v_until timestamptz := now() + interval '30 days';
  v_row   public.profiles%ROWTYPE;
  v_new   jsonb;
BEGIN
  v_old := public.admin_profile_lock_target(p_user_id);

  IF p_action IS NULL OR p_action NOT IN ('restrict', 'unrestrict', 'shadowban', 'unshadowban') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_user_id = v_actor AND p_action IN ('restrict', 'shadowban') THEN
    RAISE EXCEPTION 'cannot_sanction_self' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_action = 'restrict' THEN
    UPDATE public.profiles
       SET is_restricted    = true,
           restricted_until = GREATEST(COALESCE(restricted_until, v_until), v_until)
     WHERE id = p_user_id
     RETURNING * INTO v_row;
  ELSIF p_action = 'unrestrict' THEN
    UPDATE public.profiles
       SET is_restricted = false, restricted_until = NULL
     WHERE id = p_user_id
     RETURNING * INTO v_row;
  ELSE
    UPDATE public.profiles
       SET is_shadow_banned = (p_action = 'shadowban')
     WHERE id = p_user_id
     RETURNING * INTO v_row;
  END IF;

  v_new := jsonb_build_object(
    'is_restricted',    v_row.is_restricted,
    'restricted_until', v_row.restricted_until,
    'is_shadow_banned', v_row.is_shadow_banned
  );

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (v_actor, 'admin.user.' || p_action, 'profile', p_user_id,
          v_new || jsonb_build_object('previous', jsonb_build_object(
            'is_restricted',    v_old.is_restricted,
            'restricted_until', v_old.restricted_until,
            'is_shadow_banned', v_old.is_shadow_banned)));

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id) || v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_safety_state(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_safety_state(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN nach dem Einspielen (SQL-Editor, nur lesend bzw. mit ROLLBACK)
--
-- 1 · Rechte: Für anon zu, für authenticated offen, Hilfsfunktion für beide zu.
--     SELECT p.proname,
--            has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
--            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
--       FROM pg_proc p
--      WHERE p.pronamespace = 'public'::regnamespace
--        AND (p.proname LIKE 'admin\_set\_user\_%' OR p.proname = 'admin_profile_lock_target');
--     -- erwartet: anon = false überall; auth = true außer admin_profile_lock_target
--
-- 2 · Verhalten: supabase/tests/admin_profile_privilege_rpcs.sql (endet mit
--     ROLLBACK, lässt nichts zurück).
--
-- 3 · Von außen: Ohne Anmeldung
--       curl -X POST "$U/rest/v1/rpc/admin_set_user_role" -H "apikey: $ANON" \
--            -H 'Content-Type: application/json' \
--            -d '{"p_user_id":"00000000-0000-0000-0000-000000000000","p_role":"creator"}'
--     -- erwartet: 401/42501 permission denied for function admin_set_user_role
-- ─────────────────────────────────────────────────────────────────────────────
