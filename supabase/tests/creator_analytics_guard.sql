-- ============================================================================
-- creator_analytics_guard.sql — Test zu 20261014130000_creator_analytics_guard.sql
--                                 und 20261014140000_creator_top_posts_ambiguous.sql
--
-- Prüft den auth.uid()-Abgleich in den vier Creator-Auswertungen
--   get_creator_overview, get_creator_follower_growth,
--   get_creator_gift_history, get_creator_top_posts:
-- eigene ID / Admin / service_role ja, fremde oder leere ID 42501, anon gesperrt
-- (PUBLIC und anon ohne EXECUTE), und dass die Rümpfe dieselben Zahlen liefern
-- wie vorher (Live-Stand).
--
-- Die Aufrufe laufen als `authenticated` mit JWT-Claims — genau der Weg, den
-- App und Web über PostgREST nehmen.
--
-- get_creator_top_posts scheiterte bis 20261014140000 bei jedem Aufruf mit
-- 42702 („post_id" mehrdeutig). Jetzt verlangt der Test Zeilen: die drei
-- eigenen Beiträge inkl. des privaten, in der richtigen Reihenfolge für
-- views / likes / comments, mit den richtigen Zahlen und Bildpfaden — und
-- nie den Beitrag eines anderen Creators.
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
INSERT INTO public.profiles (id, username, avatar_url, is_admin) VALUES
  ('c0c0c0c0-0000-4000-8000-00000000000a', 'cag_test_creator_a', NULL,               false),
  ('c0c0c0c0-0000-4000-8000-00000000000b', 'cag_test_viewer_b',  NULL,               false),
  ('c0c0c0c0-0000-4000-8000-00000000000d', 'cag_test_admin',     NULL,               true),
  ('c0c0c0c0-0000-4000-8000-00000000000e', 'cag_test_sender',    'avatars/cag_s.jpg', false);

-- Beiträge von A: ein öffentliches Video mit Vorschaubild, ein privater Frauen-
-- Only-Beitrag (darf nur A selbst sehen), ein alter außerhalb der 28 Tage.
-- Dazu ein Beitrag von B mit den meisten Aufrufen — darf in A's Liste nie stehen.
INSERT INTO public.posts (id, author_id, caption, media_url, media_type, thumbnail_url, privacy, women_only, view_count, created_at) VALUES
  ('c0c0c0c0-0000-4000-8000-0000000000f1', 'c0c0c0c0-0000-4000-8000-00000000000a', 'cag öffentlich', 'posts/cag1.mp4', 'video', 'thumbnails/cag1.jpg', 'public',  false, 100, now() - interval '1 day'),
  ('c0c0c0c0-0000-4000-8000-0000000000f2', 'c0c0c0c0-0000-4000-8000-00000000000a', 'cag GEHEIM',     'posts/cag2.jpg', 'image', NULL,                  'private', true,   50, now() - interval '2 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f3', 'c0c0c0c0-0000-4000-8000-00000000000a', 'cag alt',        'posts/cag3.jpg', 'image', NULL,                  'public',  false,  30, now() - interval '40 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f9', 'c0c0c0c0-0000-4000-8000-00000000000b', 'cag fremd',      'posts/cag9.jpg', 'image', NULL,                  'public',  false, 999, now() - interval '1 day');

INSERT INTO public.likes (post_id, user_id) VALUES
  ('c0c0c0c0-0000-4000-8000-0000000000f1', 'c0c0c0c0-0000-4000-8000-00000000000b'),
  ('c0c0c0c0-0000-4000-8000-0000000000f1', 'c0c0c0c0-0000-4000-8000-00000000000e');

-- ein Kommentar + eine Antwort darauf (Antworten zählen nicht)
INSERT INTO public.comments (id, post_id, user_id, text, parent_id) VALUES
  ('c0c0c0c0-0000-4000-8000-0000000000c1', 'c0c0c0c0-0000-4000-8000-0000000000f1', 'c0c0c0c0-0000-4000-8000-00000000000b', 'cag Kommentar', NULL),
  ('c0c0c0c0-0000-4000-8000-0000000000c2', 'c0c0c0c0-0000-4000-8000-0000000000f1', 'c0c0c0c0-0000-4000-8000-00000000000a', 'cag Antwort',   'c0c0c0c0-0000-4000-8000-0000000000c1');

-- Für die Top-Beiträge: jede Sortierung ergibt eine ANDERE Reihenfolge
--   Beitrag          views  likes  Kommentare (ohne Antworten)
--   cag öffentlich    100     2     1   (+ 3 Antworten → zählen nicht)
--   cag GEHEIM         50     3     2
--   cag alt            30     1     3
-- Alles vor 60 Tagen: außerhalb beider overview-Fenster (0–28 und 28–56 Tage),
-- damit 2) dieselben overview-Zahlen prüft; top_posts zählt ohne Zeitgrenze.
INSERT INTO public.likes (post_id, user_id, created_at) VALUES
  ('c0c0c0c0-0000-4000-8000-0000000000f2', 'c0c0c0c0-0000-4000-8000-00000000000b', now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f2', 'c0c0c0c0-0000-4000-8000-00000000000d', now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f2', 'c0c0c0c0-0000-4000-8000-00000000000e', now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f3', 'c0c0c0c0-0000-4000-8000-00000000000b', now() - interval '60 days');
INSERT INTO public.comments (post_id, user_id, text, parent_id, created_at) VALUES
  ('c0c0c0c0-0000-4000-8000-0000000000f1', 'c0c0c0c0-0000-4000-8000-00000000000e', 'cag Antwort 2', 'c0c0c0c0-0000-4000-8000-0000000000c1', now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f1', 'c0c0c0c0-0000-4000-8000-00000000000b', 'cag Antwort 3', 'c0c0c0c0-0000-4000-8000-0000000000c1', now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f1', 'c0c0c0c0-0000-4000-8000-00000000000d', 'cag Antwort 4', 'c0c0c0c0-0000-4000-8000-0000000000c1', now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f2', 'c0c0c0c0-0000-4000-8000-00000000000b', 'cag K2a', NULL, now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f2', 'c0c0c0c0-0000-4000-8000-00000000000e', 'cag K2b', NULL, now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f3', 'c0c0c0c0-0000-4000-8000-00000000000b', 'cag K3a', NULL, now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f3', 'c0c0c0c0-0000-4000-8000-00000000000e', 'cag K3b', NULL, now() - interval '60 days'),
  ('c0c0c0c0-0000-4000-8000-0000000000f3', 'c0c0c0c0-0000-4000-8000-00000000000d', 'cag K3c', NULL, now() - interval '60 days');

-- B folgt A seit gestern (neue Periode), der Schenker seit 35 Tagen (Vorperiode)
INSERT INTO public.follows (follower_id, following_id, created_at) VALUES
  ('c0c0c0c0-0000-4000-8000-00000000000b', 'c0c0c0c0-0000-4000-8000-00000000000a', now() - interval '1 day'),
  ('c0c0c0c0-0000-4000-8000-00000000000e', 'c0c0c0c0-0000-4000-8000-00000000000a', now() - interval '35 days');

INSERT INTO public.gift_catalog (id, name, emoji, coin_cost, diamond_value) VALUES
  ('cag_test_gift', 'CAG Testrose', '🌹', 1, 1);
INSERT INTO public.gift_transactions (sender_id, recipient_id, live_session_id, gift_id, coin_cost, diamond_value) VALUES
  ('c0c0c0c0-0000-4000-8000-00000000000e', 'c0c0c0c0-0000-4000-8000-00000000000a', 'cag_test_live', 'cag_test_gift', 1, 5);

SET LOCAL session_replication_role = origin;

DO $$
DECLARE
  a    uuid := 'c0c0c0c0-0000-4000-8000-00000000000a';
  b    uuid := 'c0c0c0c0-0000-4000-8000-00000000000b';
  adm  uuid := 'c0c0c0c0-0000-4000-8000-00000000000d';
  f1   uuid := 'c0c0c0c0-0000-4000-8000-0000000000f1';
  ov   record;
  gh   record;
  n    bigint;
  hit  boolean;
  ok   boolean;
  st   text;
  msg  text;
  q    text;
  who  text;
  r    record;
  -- Jeder Aufruf so, wie App/Web ihn absetzen; $1 = abgefragte Nutzer-ID.
  calls text[] := ARRAY[
    'SELECT count(*) FROM public.get_creator_overview($1, 28)',
    'SELECT count(*) FROM public.get_creator_follower_growth($1, 28)',
    'SELECT count(*) FROM public.get_creator_gift_history($1, 10)',
    'SELECT count(*) FROM public.get_creator_top_posts($1, ''views'', 10)'
  ];
BEGIN
  -- ── 0) Signatur, SECURITY DEFINER, search_path wie live ────────────────────
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.prosecdef, p.provolatile, p.proconfig,
           pg_get_function_result(p.oid) AS res
      FROM pg_proc p
     WHERE p.oid IN ('public.get_creator_overview(uuid,integer)'::regprocedure,
                     'public.get_creator_follower_growth(uuid,integer)'::regprocedure,
                     'public.get_creator_gift_history(uuid,integer)'::regprocedure,
                     'public.get_creator_top_posts(uuid,text,integer)'::regprocedure)
  LOOP
    ASSERT r.prosecdef,   '0) '||r.sig||' ist nicht mehr SECURITY DEFINER';
    ASSERT r.provolatile = 'v', '0) '||r.sig||' Volatilität geändert: '||r.provolatile::text;
    ASSERT r.proconfig = ARRAY['search_path=public, extensions, pg_temp'],
           '0) '||r.sig||' search_path nicht gepinnt: '||coalesce(r.proconfig::text, 'NULL');
  END LOOP;
  ASSERT pg_get_function_result('public.get_creator_overview(uuid,integer)'::regprocedure)
         = 'TABLE(total_views bigint, total_likes bigint, total_comments bigint, prev_views bigint, prev_likes bigint, prev_comments bigint, total_followers bigint, new_followers bigint, prev_followers bigint)',
         '0) Rückgabetyp get_creator_overview geändert';
  ASSERT pg_get_function_result('public.get_creator_follower_growth(uuid,integer)'::regprocedure)
         = 'TABLE(day date, new_followers bigint)',
         '0) Rückgabetyp get_creator_follower_growth geändert';
  ASSERT pg_get_function_result('public.get_creator_gift_history(uuid,integer)'::regprocedure)
         = 'TABLE(gift_name text, gift_emoji text, diamond_value integer, sender_name text, sender_avatar text, created_at timestamp with time zone)',
         '0) Rückgabetyp get_creator_gift_history geändert';
  ASSERT pg_get_function_result('public.get_creator_top_posts(uuid,text,integer)'::regprocedure)
         = 'TABLE(post_id uuid, caption text, media_url text, media_type text, thumbnail_url text, view_count integer, like_count bigint, comment_count bigint, created_at timestamp with time zone, rank bigint)',
         '0) Rückgabetyp get_creator_top_posts geändert';
  RAISE NOTICE '✓ 0) Signaturen, Rückgabetypen, SECURITY DEFINER, search_path unverändert';

  -- ── 1) Rechte: PUBLIC und anon ohne EXECUTE, authenticated + service_role mit
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('get_creator_overview', 'get_creator_follower_growth',
                         'get_creator_gift_history', 'get_creator_top_posts')
  LOOP
    ASSERT NOT has_function_privilege('public', r.oid, 'EXECUTE'), '1) PUBLIC darf '||r.sig;
    ASSERT NOT has_function_privilege('anon',   r.oid, 'EXECUTE'), '1) anon darf '||r.sig;
    ASSERT has_function_privilege('authenticated', r.oid, 'EXECUTE'), '1) authenticated darf nicht '||r.sig;
    ASSERT has_function_privilege('service_role',  r.oid, 'EXECUTE'), '1) service_role darf nicht '||r.sig;
  END LOOP;
  RAISE NOTICE '✓ 1) EXECUTE nur authenticated + service_role (PUBLIC und anon zu)';

  -- ── 2) Creator A fragt sich selbst ab: Zahlen wie vor der Migration ────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT * INTO ov FROM public.get_creator_overview(a, 28);
  ASSERT ov.total_views = 150,    '2) total_views 150 erwartet, war: '||coalesce(ov.total_views::text, 'NULL');
  ASSERT ov.total_likes = 2,      '2) total_likes 2 erwartet, war: '||coalesce(ov.total_likes::text, 'NULL');
  ASSERT ov.total_comments = 1,   '2) total_comments 1 erwartet (Antworten zählen nicht), war: '||coalesce(ov.total_comments::text, 'NULL');
  ASSERT ov.total_followers = 2,  '2) total_followers 2 erwartet, war: '||coalesce(ov.total_followers::text, 'NULL');
  ASSERT ov.new_followers = 1,    '2) new_followers 1 erwartet, war: '||coalesce(ov.new_followers::text, 'NULL');
  ASSERT ov.prev_followers = 1,   '2) prev_followers 1 erwartet, war: '||coalesce(ov.prev_followers::text, 'NULL');

  SELECT count(*), bool_and(day = (now() - interval '1 day')::date AND new_followers = 1)
    INTO n, hit FROM public.get_creator_follower_growth(a, 28);
  ASSERT n = 1 AND hit, '2) follower_growth: 1 Tag mit 1 neuem Follower erwartet, war: '||n;

  SELECT * INTO gh FROM public.get_creator_gift_history(a, 10);
  ASSERT gh.sender_name = 'cag_test_sender' AND gh.sender_avatar = 'avatars/cag_s.jpg'
         AND gh.gift_emoji = '🌹' AND gh.diamond_value = 5,
         format('2) gift_history: Schenker/Gift falsch: %s / %s / %s / %s', gh.sender_name, gh.sender_avatar, gh.gift_emoji, gh.diamond_value);

  RESET ROLE;
  RAISE NOTICE '✓ 2) eigene ID: overview / follower_growth / gift_history liefern die Live-Zahlen';

  -- ── 2b) top_posts für die eigene ID: Zeilen, Reihenfolge, Zahlen ───────────
  -- Bis 20261014140000 kam hier immer 42702 — jetzt ist jeder Fehler rot.
  -- Reihenfolge = Ausgabereihenfolge (WITH ORDINALITY), denn App und Web
  -- zeigen die Zeilen so an, wie sie kommen.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOR r IN
    SELECT * FROM (VALUES
      ('views',    10, '#1 cag öffentlich 100/2/1 | #2 cag GEHEIM 50/3/2 | #3 cag alt 30/1/3'),
      ('likes',    10, '#1 cag GEHEIM 50/3/2 | #2 cag öffentlich 100/2/1 | #3 cag alt 30/1/3'),
      ('comments', 10, '#1 cag alt 30/1/3 | #2 cag GEHEIM 50/3/2 | #3 cag öffentlich 100/2/1'),
      ('egal',     10, '#1 cag öffentlich 100/2/1 | #2 cag GEHEIM 50/3/2 | #3 cag alt 30/1/3'),  -- unbekannt → views
      ('likes',     2, '#1 cag GEHEIM 50/3/2 | #2 cag öffentlich 100/2/1')                       -- p_limit
    ) v(sort_by, lim, expected)
  LOOP
    SELECT string_agg(format('#%s %s %s/%s/%s', t.rank, t.caption, t.view_count, t.like_count, t.comment_count),
                      ' | ' ORDER BY t.ordinality)
      INTO msg
      FROM public.get_creator_top_posts(a, r.sort_by, r.lim) WITH ORDINALITY AS t;
    ASSERT msg IS NOT DISTINCT FROM r.expected,
           format('2b) top_posts(%s, %s): erwartet „%s", war „%s"', r.sort_by, r.lim, r.expected, coalesce(msg, 'leer'));
  END LOOP;

  -- Standardwerte wie in der App-Signatur (views, 5)
  SELECT count(*) INTO n FROM public.get_creator_top_posts(a);
  ASSERT n = 3, '2b) top_posts(a) mit Standardwerten: 3 Zeilen erwartet, war: '||n;

  -- Spalten landen in den richtigen Feldern (App/Web lesen sie per Namen)
  SELECT * INTO r FROM public.get_creator_top_posts(a, 'views', 1);
  ASSERT r.post_id = f1 AND r.media_url = 'posts/cag1.mp4' AND r.media_type = 'video'
         AND r.thumbnail_url = 'thumbnails/cag1.jpg' AND r.created_at = now() - interval '1 day',
         format('2b) top_posts Platz 1: Felder falsch: %s / %s / %s / %s / %s',
                r.post_id, r.media_url, r.media_type, r.thumbnail_url, r.created_at);
  SELECT * INTO r FROM public.get_creator_top_posts(a, 'likes', 1);
  ASSERT r.caption = 'cag GEHEIM' AND r.media_url = 'posts/cag2.jpg' AND r.media_type = 'image'
         AND r.thumbnail_url IS NULL,
         format('2b) top_posts privater Beitrag: Felder falsch: %s / %s / %s / %s',
                r.caption, r.media_url, r.media_type, r.thumbnail_url);
  RESET ROLE;
  RAISE NOTICE '✓ 2b) top_posts eigene ID: 3 Beiträge inkl. privatem, Reihenfolge views/likes/comments, Limit, Felder';

  -- ── 3) Fremde ID und leere ID → 42501, für alle vier ───────────────────────
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
      ASSERT msg LIKE 'Kein Zugriff auf % anderer Creator.', format('3) %s: falsche Meldung: %s', q, msg);
    END LOOP;
  END LOOP;
  RESET ROLE;
  RAISE NOTICE '✓ 3) fremde und leere ID → 42501 (alle vier)';

  -- ── 4) Admin und service_role dürfen fremde IDs abfragen ───────────────────
  FOREACH who IN ARRAY ARRAY['admin', 'service_role'] LOOP
    IF who = 'admin' THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
    ELSE
      PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
      SET LOCAL ROLE service_role;
    END IF;

    SELECT * INTO ov FROM public.get_creator_overview(a, 28);
    ASSERT ov.total_views = 150 AND ov.total_followers = 2, format('4) %s: overview falsch: views %s, followers %s', who, ov.total_views, ov.total_followers);
    SELECT count(*) INTO n FROM public.get_creator_follower_growth(a, 28);
    ASSERT n = 1, '4) '||who||': follower_growth 1 Zeile erwartet, war: '||n;
    SELECT count(*) INTO n FROM public.get_creator_gift_history(a, 10);
    ASSERT n = 1, '4) '||who||': gift_history 1 Zeile erwartet, war: '||n;
    SELECT count(*), bool_or(caption = 'cag GEHEIM') INTO n, hit
      FROM public.get_creator_top_posts(a, 'views', 10);
    ASSERT n = 3 AND hit, '4) '||who||': top_posts 3 Zeilen inkl. privatem erwartet, war: '||n;
    RESET ROLE;
  END LOOP;
  RAISE NOTICE '✓ 4) Admin und service_role: fremde ID erlaubt';

  -- ── 5) anon: gesperrt (Rechte UND Guard) ───────────────────────────────────
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
  RAISE NOTICE '✓ 5) anon → 42501 (alle vier)';

  RAISE NOTICE '══ creator_analytics_guard: alle Tests grün ══';
END $$;

ROLLBACK;
