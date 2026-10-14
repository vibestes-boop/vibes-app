-- ============================================================================
-- creator_engagement_watchtime_guard.sql — Test zu
-- 20261014150000_creator_engagement_watchtime_guard.sql
--
-- Prüft den auth.uid()-Abgleich in get_creator_engagement_hours und
-- get_creator_watch_time_estimate: eigene ID / Admin / service_role ja, fremde
-- oder leere ID 42501, anon gesperrt (PUBLIC und anon ohne EXECUTE) — und dass
-- die Umstellung von LANGUAGE sql auf plpgsql dieselben Zahlen liefert
-- (mehrere Wochentage/Stunden, Zeitfenster, fremde Beiträge ausgeschlossen).
--
-- Die Aufrufe laufen als `authenticated` mit JWT-Claims — genau der Weg, den
-- App und Web über PostgREST nehmen.
--
-- AUSFÜHREN: kompletten Block in Supabase → SQL Editor einfügen + Run.
-- SICHER: eine Transaktion mit ROLLBACK — nichts bleibt zurück. Ausgabe im
-- "Messages/Notices"-Tab. Ohne ERROR = alles grün.
--
-- Fixtures im replica-Modus (keine FK-/Trigger-Kette über auth.users), danach
-- ZURÜCK auf origin.
-- ============================================================================
BEGIN;
SET LOCAL session_replication_role = replica;

-- ── Fixtures ────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, username, is_admin) VALUES
  ('c0c0c0c0-1000-4000-8000-00000000000a', 'cew_test_creator_a', false),
  ('c0c0c0c0-1000-4000-8000-00000000000b', 'cew_test_viewer_b',  false),
  ('c0c0c0c0-1000-4000-8000-00000000000d', 'cew_test_admin',     true);

-- A: zwei Beiträge im Zeitraum (100 + 50 Aufrufe), ein alter (40 Tage, 30 Aufrufe).
-- B: ein eigener Beitrag (999 Aufrufe) — darf bei A nirgends mitzählen.
INSERT INTO public.posts (id, author_id, caption, view_count, created_at) VALUES
  ('c0c0c0c0-1000-4000-8000-0000000000f1', 'c0c0c0c0-1000-4000-8000-00000000000a', 'cew 1', 100, now() - interval '3 days'),
  ('c0c0c0c0-1000-4000-8000-0000000000f2', 'c0c0c0c0-1000-4000-8000-00000000000a', 'cew 2',  50, now() - interval '4 days'),
  ('c0c0c0c0-1000-4000-8000-0000000000f3', 'c0c0c0c0-1000-4000-8000-00000000000a', 'cew alt', 30, now() - interval '40 days'),
  ('c0c0c0c0-1000-4000-8000-0000000000f4', 'c0c0c0c0-1000-4000-8000-00000000000b', 'cew B', 999, now() - interval '1 day');

-- Zeitpunkte: t1 = vor 2 Tagen, t2 = vor 5 Tagen 3 Stunden (anderer Tag, andere Stunde).
-- Auf A's Beiträge: t1 → 2 Likes + 1 Kommentar, t2 → 1 Like. Dazu ein Like
-- außerhalb des Zeitfensters und ein Like auf B's Beitrag (beide zählen nicht).
INSERT INTO public.likes (post_id, user_id, created_at) VALUES
  ('c0c0c0c0-1000-4000-8000-0000000000f1', 'c0c0c0c0-1000-4000-8000-00000000000b', date_trunc('hour', now() - interval '2 days') + interval '10 minutes'),
  ('c0c0c0c0-1000-4000-8000-0000000000f2', 'c0c0c0c0-1000-4000-8000-00000000000d', date_trunc('hour', now() - interval '2 days') + interval '20 minutes'),
  ('c0c0c0c0-1000-4000-8000-0000000000f1', 'c0c0c0c0-1000-4000-8000-00000000000d', date_trunc('hour', now() - interval '5 days 3 hours') + interval '5 minutes'),
  ('c0c0c0c0-1000-4000-8000-0000000000f1', 'c0c0c0c0-1000-4000-8000-00000000000a', now() - interval '35 days'),
  ('c0c0c0c0-1000-4000-8000-0000000000f4', 'c0c0c0c0-1000-4000-8000-00000000000a', now() - interval '1 hour');
INSERT INTO public.comments (post_id, user_id, text, created_at) VALUES
  ('c0c0c0c0-1000-4000-8000-0000000000f2', 'c0c0c0c0-1000-4000-8000-00000000000b', 'cew Kommentar', date_trunc('hour', now() - interval '2 days') + interval '30 minutes');

SET LOCAL session_replication_role = origin;

DO $$
DECLARE
  a    uuid := 'c0c0c0c0-1000-4000-8000-00000000000a';
  b    uuid := 'c0c0c0c0-1000-4000-8000-00000000000b';
  adm  uuid := 'c0c0c0c0-1000-4000-8000-00000000000d';
  t1   timestamptz := date_trunc('hour', now() - interval '2 days');
  t2   timestamptz := date_trunc('hour', now() - interval '5 days 3 hours');
  -- erwartete Heatmap: (Wochentag 0=Mo, Stunde UTC, Anzahl)
  soll text;
  ist  text;
  wt   record;
  n    bigint;
  ok   boolean;
  st   text;
  msg  text;
  q    text;
  who  text;
  r    record;
  calls text[] := ARRAY[
    'SELECT count(*) FROM public.get_creator_engagement_hours($1, 28)',
    'SELECT count(*) FROM public.get_creator_watch_time_estimate($1, 28)'
  ];
BEGIN
  soll := format('%s/%s=3 %s/%s=1',
    extract(isodow FROM t1 AT TIME ZONE 'UTC')::int - 1, extract(hour FROM t1 AT TIME ZONE 'UTC')::int,
    extract(isodow FROM t2 AT TIME ZONE 'UTC')::int - 1, extract(hour FROM t2 AT TIME ZONE 'UTC')::int);

  -- ── 0) Rahmen: Rückgabetyp, STABLE, SECURITY DEFINER, search_path wie live ─
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.prosecdef, p.provolatile, p.proconfig, l.lanname
      FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
     WHERE p.oid IN ('public.get_creator_engagement_hours(uuid,integer)'::regprocedure,
                     'public.get_creator_watch_time_estimate(uuid,integer)'::regprocedure)
  LOOP
    ASSERT r.lanname = 'plpgsql', '0) '||r.sig||' ist nicht plpgsql (Guard fehlt?): '||r.lanname;
    ASSERT r.prosecdef,           '0) '||r.sig||' ist nicht mehr SECURITY DEFINER';
    ASSERT r.provolatile = 's',   '0) '||r.sig||' nicht mehr STABLE: '||r.provolatile::text;
    ASSERT r.proconfig = ARRAY['search_path=public'],
           '0) '||r.sig||' search_path geändert: '||coalesce(r.proconfig::text, 'NULL');
  END LOOP;
  ASSERT pg_get_function_result('public.get_creator_engagement_hours(uuid,integer)'::regprocedure)
         = 'TABLE(weekday integer, hour_of_day integer, engagement_count bigint)',
         '0) Rückgabetyp get_creator_engagement_hours geändert';
  ASSERT pg_get_function_result('public.get_creator_watch_time_estimate(uuid,integer)'::regprocedure)
         = 'TABLE(total_seconds_est bigint, total_views bigint, avg_seconds_per_view numeric)',
         '0) Rückgabetyp get_creator_watch_time_estimate geändert';
  RAISE NOTICE '✓ 0) plpgsql, Rückgabetypen, STABLE, SECURITY DEFINER, search_path=public';

  -- ── 1) Rechte: PUBLIC und anon ohne EXECUTE, authenticated + service_role mit
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('get_creator_engagement_hours', 'get_creator_watch_time_estimate')
  LOOP
    ASSERT NOT has_function_privilege('public', r.oid, 'EXECUTE'), '1) PUBLIC darf '||r.sig;
    ASSERT NOT has_function_privilege('anon',   r.oid, 'EXECUTE'), '1) anon darf '||r.sig;
    ASSERT has_function_privilege('authenticated', r.oid, 'EXECUTE'), '1) authenticated darf nicht '||r.sig;
    ASSERT has_function_privilege('service_role',  r.oid, 'EXECUTE'), '1) service_role darf nicht '||r.sig;
  END LOOP;
  RAISE NOTICE '✓ 1) EXECUTE nur authenticated + service_role (PUBLIC und anon zu)';

  -- ── 2) A fragt sich selbst ab: dieselben Zahlen wie die alte sql-Fassung ───
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT string_agg(format('%s/%s=%s', weekday, hour_of_day, engagement_count), ' '
                    ORDER BY engagement_count DESC, weekday, hour_of_day)
    INTO ist FROM public.get_creator_engagement_hours(a, 28);
  ASSERT ist = soll, format('2) engagement_hours: erwartet %s, war %s', soll, coalesce(ist, 'NULL'));

  SELECT * INTO wt FROM public.get_creator_watch_time_estimate(a, 28);
  ASSERT wt.total_views = 150 AND wt.total_seconds_est = 1200 AND wt.avg_seconds_per_view = 8,
         format('2) watch_time: erwartet 150/1200/8, war %s/%s/%s', wt.total_views, wt.total_seconds_est, wt.avg_seconds_per_view);

  -- ohne Beiträge im Zeitraum: eine Nullzeile wie bisher
  SELECT * INTO wt FROM public.get_creator_watch_time_estimate(a, 1);
  ASSERT wt.total_views = 0 AND wt.total_seconds_est = 0 AND wt.avg_seconds_per_view = 0,
         format('2) watch_time 1 Tag: erwartet 0/0/0, war %s/%s/%s', wt.total_views, wt.total_seconds_est, wt.avg_seconds_per_view);
  RESET ROLE;
  RAISE NOTICE '✓ 2) eigene ID: Heatmap % und Watch-Time 150 Aufrufe / 1200 s wie vorher', soll;

  -- ── 3) Fremde ID und leere ID → 42501, für beide ───────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOREACH q IN ARRAY calls LOOP
    FOREACH who IN ARRAY ARRAY['fremd', 'leer'] LOOP
      ok := false; st := NULL; msg := NULL;
      BEGIN
        EXECUTE q USING CASE who WHEN 'fremd' THEN a END;
      EXCEPTION
        WHEN insufficient_privilege THEN ok := true; msg := SQLERRM;
        WHEN OTHERS THEN st := SQLSTATE; msg := SQLERRM;
      END;
      ASSERT ok, format('TESTFEHLER 3) %s mit %s ID: kein 42501 (%s)', q, who,
                        coalesce(st || ' ' || msg, 'lief durch'));
      ASSERT msg LIKE 'Kein Zugriff auf die % anderer Creator.', format('3) %s: falsche Meldung: %s', q, msg);
    END LOOP;
  END LOOP;
  RESET ROLE;
  RAISE NOTICE '✓ 3) fremde und leere ID → 42501 (beide)';

  -- ── 4) Admin und service_role dürfen fremde IDs abfragen ───────────────────
  FOREACH who IN ARRAY ARRAY['admin', 'service_role'] LOOP
    IF who = 'admin' THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
    ELSE
      PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
      SET LOCAL ROLE service_role;
    END IF;
    SELECT count(*) INTO n FROM public.get_creator_engagement_hours(a, 28);
    ASSERT n = 2, format('4) %s: engagement_hours 2 Zeilen erwartet, war %s', who, n);
    SELECT * INTO wt FROM public.get_creator_watch_time_estimate(a, 28);
    ASSERT wt.total_views = 150, format('4) %s: watch_time 150 erwartet, war %s', who, wt.total_views);
    RESET ROLE;
  END LOOP;
  RAISE NOTICE '✓ 4) Admin und service_role: fremde ID erlaubt';

  -- ── 5) anon: gesperrt ──────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  FOREACH q IN ARRAY calls LOOP
    ok := false; st := NULL; msg := NULL;
    BEGIN
      EXECUTE q USING a;
    EXCEPTION
      WHEN insufficient_privilege THEN ok := true;
      WHEN OTHERS THEN st := SQLSTATE; msg := SQLERRM;
    END;
    ASSERT ok, format('TESTFEHLER 5) anon: %s kein 42501 (%s)', q, coalesce(st || ' ' || msg, 'lief durch'));
  END LOOP;
  RESET ROLE;
  RAISE NOTICE '✓ 5) anon → 42501 (beide)';

  RAISE NOTICE '══ creator_engagement_watchtime_guard: alle Tests grün ══';
END $$;

ROLLBACK;
