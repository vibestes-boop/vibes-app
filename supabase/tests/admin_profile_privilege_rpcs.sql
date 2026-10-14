-- ============================================================================
-- admin_profile_privilege_rpcs.sql — Test der Admin-RPCs aus
-- 20261014160000_admin_profile_privilege_rpcs.sql
--
-- Prüft: Admin darf (Rolle, Admin-Recht, Haken, Sperre, Einschränkung,
-- Shadowban), Nicht-Admins und Moderatoren bekommen 42501, anon hat kein
-- EXECUTE, Selbst-Herabstufung und Selbst-Sanktion werden abgelehnt, jede
-- Änderung steht im Audit-Log — und der alte Direktweg (PATCH auf profiles)
-- ändert weiterhin nichts.
--
-- AUSFÜHREN: kompletten Block in Supabase → SQL Editor einfügen + Run.
-- SICHER: läuft in EINER Transaktion und endet mit ROLLBACK — es bleibt
-- NICHTS in der DB zurück. Ausgabe erscheint im "Messages/Notices"-Tab.
-- Ein Fehlschlag bricht mit „✗ …“ ab.
--
-- Fixtures wie in buy_product.sql: `session_replication_role = replica` nur
-- für das Anlegen der Test-Profile (ohne auth.users-Kette), danach wieder
-- `origin`, damit die Wächter auf profiles bei den Proben scharf sind.
-- ============================================================================
BEGIN;
SET LOCAL session_replication_role = replica;

INSERT INTO public.profiles (id, username, is_admin, is_moderator) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'test_rpc_admin',     true,  false),
  ('a0000000-0000-4000-8000-00000000000b', 'test_rpc_admin2',    true,  false),
  ('a0000000-0000-4000-8000-00000000000c', 'test_rpc_member',    false, false),
  ('a0000000-0000-4000-8000-00000000000d', 'test_rpc_moderator', false, true);

SET LOCAL session_replication_role = origin;

-- Erwartet einen Fehler mit SQLSTATE p_state und Meldung LIKE p_msg.
-- Läuft mit der Rolle, die gerade gesetzt ist (SECURITY INVOKER).
CREATE FUNCTION pg_temp.expect_error(p_label text, p_sql text, p_state text, p_msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> p_state OR SQLERRM NOT LIKE p_msg THEN
      RAISE EXCEPTION '✗ %: erwartet % „%“, bekam % „%“', p_label, p_state, p_msg, SQLSTATE, SQLERRM;
    END IF;
    RAISE NOTICE '✓ % (% %)', p_label, SQLSTATE, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '✗ %: lief ohne Fehler durch, erwartet % „%“', p_label, p_state, p_msg;
END $$;

CREATE FUNCTION pg_temp.check(p_ok boolean, p_label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN
    RAISE EXCEPTION '✗ %', p_label;
  END IF;
  RAISE NOTICE '✓ %', p_label;
END $$;

-- Die Hilfen müssen auch nach SET ROLE aufrufbar sein.
GRANT EXECUTE ON FUNCTION pg_temp.expect_error(text, text, text, text), pg_temp.check(boolean, text)
  TO anon, authenticated;

-- ── 0 · Rechte ──────────────────────────────────────────────────────────────
SELECT pg_temp.check(
  NOT has_function_privilege('anon', 'public.admin_set_user_role(uuid,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_set_user_admin(uuid,boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_set_user_verified(uuid,boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_set_user_banned(uuid,boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_set_user_safety_state(uuid,text)', 'EXECUTE'),
  '0a) anon hat auf keine der fünf RPCs EXECUTE');
SELECT pg_temp.check(
  has_function_privilege('authenticated', 'public.admin_set_user_role(uuid,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.admin_set_user_admin(uuid,boolean)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.admin_set_user_verified(uuid,boolean)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.admin_set_user_banned(uuid,boolean)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.admin_set_user_safety_state(uuid,text)', 'EXECUTE'),
  '0b) authenticated darf alle fünf RPCs aufrufen (Prüfung im Rumpf)');
SELECT pg_temp.check(
  NOT has_function_privilege('anon', 'public.admin_profile_lock_target(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.admin_profile_lock_target(uuid)', 'EXECUTE'),
  '0c) Hilfsfunktion admin_profile_lock_target ist für Clients zu');
SELECT pg_temp.check(
  (SELECT bool_and(prosecdef) FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('admin_set_user_role', 'admin_set_user_admin', 'admin_set_user_verified',
                      'admin_set_user_banned', 'admin_set_user_safety_state')),
  '0d) alle fünf RPCs sind SECURITY DEFINER');

-- ── 1 · Ohne Anmeldung ──────────────────────────────────────────────────────
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('1a) anon → admin_set_user_role',
  $q$SELECT public.admin_set_user_role('a0000000-0000-4000-8000-00000000000c', 'creator')$q$,
  '42501', 'permission denied for function admin_set_user_role');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '', true);
SELECT pg_temp.expect_error('1b) authenticated ohne sub → not_authenticated',
  $q$SELECT public.admin_set_user_role('a0000000-0000-4000-8000-00000000000c', 'creator')$q$,
  '42501', 'not_authenticated');

-- ── 2 · Nicht-Admins (Mitglied, Moderator) ──────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
SELECT pg_temp.expect_error('2a) Mitglied → admin_set_user_role (sich selbst Creator)',
  $q$SELECT public.admin_set_user_role('a0000000-0000-4000-8000-00000000000c', 'creator')$q$, '42501', 'not_admin');
SELECT pg_temp.expect_error('2b) Mitglied → admin_set_user_admin (sich selbst Admin)',
  $q$SELECT public.admin_set_user_admin('a0000000-0000-4000-8000-00000000000c', true)$q$, '42501', 'not_admin');
SELECT pg_temp.expect_error('2c) Mitglied → admin_set_user_verified',
  $q$SELECT public.admin_set_user_verified('a0000000-0000-4000-8000-00000000000c', true)$q$, '42501', 'not_admin');
SELECT pg_temp.expect_error('2d) Mitglied → admin_set_user_banned (Admin sperren)',
  $q$SELECT public.admin_set_user_banned('a0000000-0000-4000-8000-00000000000a', true)$q$, '42501', 'not_admin');
SELECT pg_temp.expect_error('2e) Mitglied → admin_set_user_safety_state',
  $q$SELECT public.admin_set_user_safety_state('a0000000-0000-4000-8000-00000000000a', 'shadowban')$q$, '42501', 'not_admin');

SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
SELECT pg_temp.expect_error('2f) Moderator → admin_set_user_role',
  $q$SELECT public.admin_set_user_role('a0000000-0000-4000-8000-00000000000c', 'creator')$q$, '42501', 'not_admin');
SELECT pg_temp.expect_error('2g) Moderator → admin_set_user_banned',
  $q$SELECT public.admin_set_user_banned('a0000000-0000-4000-8000-00000000000c', true)$q$, '42501', 'not_admin');

-- Der Wächter auf profiles bleibt unverändert: eigenes is_creator direkt → 42501.
SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
SELECT pg_temp.expect_error('2h) Mitglied setzt eigenes is_creator direkt → Wächter',
  $q$UPDATE public.profiles SET is_creator = true WHERE id = 'a0000000-0000-4000-8000-00000000000c'$q$,
  '42501', 'is_creator darf nicht vom Client geaendert werden');

-- ── 3 · Admin: Selbstschutz und Eingaben ────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

SELECT pg_temp.expect_error('3a) Admin stuft sich per Rolle herab',
  $q$SELECT public.admin_set_user_role('a0000000-0000-4000-8000-00000000000a', 'creator')$q$, '42501', 'cannot_demote_self');
SELECT pg_temp.expect_error('3b) Admin entzieht sich das Admin-Recht',
  $q$SELECT public.admin_set_user_admin('a0000000-0000-4000-8000-00000000000a', false)$q$, '42501', 'cannot_demote_self');
SELECT pg_temp.expect_error('3c) Admin sperrt sich selbst',
  $q$SELECT public.admin_set_user_banned('a0000000-0000-4000-8000-00000000000a', true)$q$, '42501', 'cannot_sanction_self');
SELECT pg_temp.expect_error('3d) Admin schränkt sich selbst ein',
  $q$SELECT public.admin_set_user_safety_state('a0000000-0000-4000-8000-00000000000a', 'restrict')$q$, '42501', 'cannot_sanction_self');
SELECT pg_temp.expect_error('3e) Admin shadowbannt sich selbst',
  $q$SELECT public.admin_set_user_safety_state('a0000000-0000-4000-8000-00000000000a', 'shadowban')$q$, '42501', 'cannot_sanction_self');
SELECT pg_temp.expect_error('3f) unbekannte Rolle',
  $q$SELECT public.admin_set_user_role('a0000000-0000-4000-8000-00000000000c', 'superuser')$q$, '22023', 'invalid_role');
SELECT pg_temp.expect_error('3g) unbekannte Sicherheitsaktion',
  $q$SELECT public.admin_set_user_safety_state('a0000000-0000-4000-8000-00000000000c', 'ban')$q$, '22023', 'invalid_action');
SELECT pg_temp.expect_error('3h) NULL statt true/false',
  $q$SELECT public.admin_set_user_banned('a0000000-0000-4000-8000-00000000000c', NULL)$q$, '22023', 'invalid_input');
SELECT pg_temp.expect_error('3i) unbekanntes Profil',
  $q$SELECT public.admin_set_user_role('a0000000-0000-4000-8000-0000000000ff', 'creator')$q$, 'P0002', 'profile_not_found');

-- Der alte Direktweg der Konsole ändert weiterhin nichts (0 Zeilen, kein Fehler).
WITH u AS (UPDATE public.profiles SET is_creator = true
             WHERE id = 'a0000000-0000-4000-8000-00000000000c' RETURNING 1)
SELECT pg_temp.check((SELECT count(*) FROM u) = 0,
  '3j) Altweg: PATCH als Admin auf fremdes Profil trifft 0 Zeilen (RLS) — deshalb RPC');

-- ── 4 · Admin: die fünf Aktionen ────────────────────────────────────────────
SELECT pg_temp.check(
  (public.admin_set_user_role('a0000000-0000-4000-8000-00000000000a', 'admin') ->> 'success')::boolean,
  '4a) Admin bestätigt eigene Admin-Rolle (keine Herabstufung) → erlaubt');
SELECT pg_temp.check(
  (public.admin_set_user_role('a0000000-0000-4000-8000-00000000000c', 'creator') ->> 'is_creator')::boolean,
  '4b) Admin macht Mitglied zum Creator');
SELECT pg_temp.check(
  (public.admin_set_user_admin('a0000000-0000-4000-8000-00000000000c', true) ->> 'is_admin')::boolean,
  '4c) Admin vergibt Admin-Recht einzeln');
SELECT pg_temp.check(
  (public.admin_set_user_verified('a0000000-0000-4000-8000-00000000000c', true) ->> 'is_verified')::boolean,
  '4d) Admin verifiziert Mitglied');
SELECT pg_temp.check(
  (public.admin_set_user_banned('a0000000-0000-4000-8000-00000000000c', true) ->> 'is_banned')::boolean,
  '4e) Admin sperrt Mitglied');
SELECT pg_temp.check(
  (public.admin_set_user_safety_state('a0000000-0000-4000-8000-00000000000c', 'restrict') ->> 'is_restricted')::boolean,
  '4f) Admin schränkt Mitglied ein');
SELECT pg_temp.check(
  (public.admin_set_user_safety_state('a0000000-0000-4000-8000-00000000000c', 'shadowban') ->> 'is_shadow_banned')::boolean,
  '4g) Admin shadowbannt Mitglied');
SELECT pg_temp.check(
  (public.admin_set_user_role('a0000000-0000-4000-8000-00000000000b', 'user') ->> 'success')::boolean,
  '4h) Admin stuft einen ANDEREN Admin herab (erlaubt, wie bisher)');

RESET ROLE;
SELECT pg_temp.check(
  (SELECT is_creator AND is_admin AND is_verified AND is_banned AND is_restricted AND is_shadow_banned
          AND restricted_until = now() + interval '30 days'
          AND NOT is_moderator AND NOT is_operator AND NOT is_creator_ops
     FROM public.profiles WHERE id = 'a0000000-0000-4000-8000-00000000000c'),
  '4i) Mitglied trägt danach alle gesetzten Werte, Einschränkung bis jetzt + 30 Tage');
SELECT pg_temp.check(
  (SELECT NOT is_admin FROM public.profiles WHERE id = 'a0000000-0000-4000-8000-00000000000b'),
  '4j) zweiter Admin ist herabgestuft');

-- ── 5 · Rückwege ────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT public.admin_set_user_safety_state('a0000000-0000-4000-8000-00000000000c', 'unrestrict');
SELECT public.admin_set_user_safety_state('a0000000-0000-4000-8000-00000000000c', 'unshadowban');
SELECT public.admin_set_user_banned('a0000000-0000-4000-8000-00000000000c', false);
SELECT public.admin_set_user_verified('a0000000-0000-4000-8000-00000000000c', false);
SELECT public.admin_set_user_admin('a0000000-0000-4000-8000-00000000000c', false);
SELECT public.admin_set_user_role('a0000000-0000-4000-8000-00000000000c', 'user');

RESET ROLE;
SELECT pg_temp.check(
  (SELECT NOT (is_creator OR is_admin OR is_verified OR is_banned OR is_restricted OR is_shadow_banned)
          AND restricted_until IS NULL
     FROM public.profiles WHERE id = 'a0000000-0000-4000-8000-00000000000c'),
  '5a) alle Rückwege setzen das Mitglied wieder auf Grundzustand');

-- ── 6 · Audit ───────────────────────────────────────────────────────────────
-- Erfolgreich waren: 4a–4h (8) + 5 (6) = 14. Abgelehnte Aufrufe schreiben nichts.
SELECT pg_temp.check(
  (SELECT count(*) FROM public.admin_audit_log
    WHERE actor_id = 'a0000000-0000-4000-8000-00000000000a'
      AND target_id IN ('a0000000-0000-4000-8000-00000000000a',
                        'a0000000-0000-4000-8000-00000000000b',
                        'a0000000-0000-4000-8000-00000000000c',
                        'a0000000-0000-4000-8000-00000000000d',
                        'a0000000-0000-4000-8000-0000000000ff')) = 14,
  '6a) genau 14 Audit-Einträge — einer je erfolgreicher Änderung, keiner bei Ablehnung');
SELECT pg_temp.check(
  (SELECT count(*) FROM public.admin_audit_log
    WHERE target_id IN ('a0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-00000000000a')
      AND actor_id IN ('a0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-00000000000d')) = 0,
  '6b) kein Audit-Eintrag von Mitglied oder Moderator');
SELECT pg_temp.check(
  (SELECT metadata -> 'previous' ->> 'is_creator' = 'false' AND metadata ->> 'role' = 'creator'
     FROM public.admin_audit_log
    WHERE target_id = 'a0000000-0000-4000-8000-00000000000c' AND action = 'admin.user.set_role'
      AND metadata ->> 'role' = 'creator'),
  '6c) Audit hält alten und neuen Stand fest');

ROLLBACK;
