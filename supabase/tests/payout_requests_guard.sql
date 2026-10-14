-- ============================================================================
-- payout_requests_guard.sql — Test zu 20261014120000_payout_requests_guard.sql
--
-- Prüft die ECHTE SQL-Logik: Insert-Guard auf payout_requests (Identität,
-- Betrag gegen coins_wallets.diamonds, Mindestbetrag, ein offener Antrag,
-- serverseitiger Euro-Betrag/Status), Status-Regeln beim Update und den
-- auth.uid()-Abgleich in get_creator_earnings.
--
-- Die Inserts laufen als `authenticated` mit JWT-Claims — genau der Weg, den
-- App und Web über PostgREST nehmen (RLS + Trigger + SECURITY DEFINER).
-- Gilt für beide Varianten von (b): prüft keine Wallet-Stände nach einem Antrag.
--
-- AUSFÜHREN: kompletten Block in Supabase → SQL Editor einfügen + Run.
-- SICHER: eine Transaktion mit ROLLBACK — nichts bleibt zurück. Ausgabe im
-- "Messages/Notices"-Tab. Ohne ERROR = alles grün.
--
-- Fixtures im replica-Modus (keine FK-/Trigger-Kette über auth.users), danach
-- ZURÜCK auf origin — sonst feuert der Trigger, um den es geht, gar nicht.
-- ============================================================================
BEGIN;
SET LOCAL session_replication_role = replica;

-- ── Fixtures ────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, username, is_admin) VALUES
  ('11111111-1111-1111-1111-111111111111', 'test_creator_a',   false),  -- 3.000 💎
  ('22222222-2222-2222-2222-222222222222', 'test_creator_b',   false),  -- 1.000 💎
  ('33333333-3333-3333-3333-333333333333', 'test_no_wallet',   false),  -- kein Wallet
  ('44444444-4444-4444-4444-444444444444', 'test_admin',       true),
  ('55555555-5555-5555-5555-555555555555', 'test_creator_web', false),  -- 2.600 💎
  ('66666666-6666-6666-6666-666666666666', 'test_creator_f',   false),  -- 5.000 💎
  ('77777777-7777-7777-7777-777777777777', 'test_creator_g',   false);  -- 2.750 💎

INSERT INTO public.coins_wallets (user_id, coins, diamonds) VALUES
  ('11111111-1111-1111-1111-111111111111', 0, 3000),
  ('22222222-2222-2222-2222-222222222222', 0, 1000),
  ('55555555-5555-5555-5555-555555555555', 0, 2600),
  ('66666666-6666-6666-6666-666666666666', 0, 5000),
  ('77777777-7777-7777-7777-777777777777', 0, 2750);

SET LOCAL session_replication_role = origin;

DO $$
DECLARE
  a     uuid := '11111111-1111-1111-1111-111111111111';
  b     uuid := '22222222-2222-2222-2222-222222222222';
  c     uuid := '33333333-3333-3333-3333-333333333333';
  adm   uuid := '44444444-4444-4444-4444-444444444444';
  e     uuid := '55555555-5555-5555-5555-555555555555';
  f     uuid := '66666666-6666-6666-6666-666666666666';
  g     uuid := '77777777-7777-7777-7777-777777777777';
  id_a  uuid;
  id_e  uuid;
  id_f  uuid;
  id_g  uuid;
  pr    public.payout_requests%ROWTYPE;
  v     bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payout_requests_10_guard') THEN
    RAISE EXCEPTION 'Trigger trg_payout_requests_10_guard fehlt — Migration 20261014120000 nicht eingespielt';
  END IF;

  -- ── 1) Fremde creator_id: Identitäts-Fehler, NICHT die Guthaben-Meldung ────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban)
    VALUES (a, 999999, 1.00, 'DE00');
    RAISE EXCEPTION 'TESTFEHLER 1) Antrag für fremden Creator angenommen';
  EXCEPTION WHEN insufficient_privilege THEN
    ASSERT SQLERRM LIKE '%nur für das eigene Konto%', '1) falsche Meldung: '||SQLERRM;
  END;
  RESET ROLE;
  RAISE NOTICE '✓ 1) fremde creator_id → 42501, ohne Guthaben zu verraten';

  -- ── 2) Überantrag: mehr als das Guthaben ───────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban)
    VALUES (a, 999999, 19999.98, 'DE00');
    RAISE EXCEPTION 'TESTFEHLER 2) Überantrag angenommen';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM = 'Dein aktuelles Guthaben reicht nicht aus (3.000 💎).', '2) falsche Meldung: '||SQLERRM;
  END;
  RESET ROLE;
  RAISE NOTICE '✓ 2) Überantrag abgelehnt';

  -- ── 3) Unter dem Mindestbetrag ─────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban)
    VALUES (b, 1000, 20.00, 'DE00');
    RAISE EXCEPTION 'TESTFEHLER 3) Antrag unter Mindestbetrag angenommen';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM = 'Mindestbetrag für eine Auszahlung: 2.500 💎 (50,00 €).', '3) falsche Meldung: '||SQLERRM;
  END;
  RESET ROLE;
  RAISE NOTICE '✓ 3) Mindestbetrag 2.500 💎';

  -- ── 4) Kein Wallet = Guthaben 0 ────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, paypal_email)
    VALUES (c, 2500, 50.00, 'c@example.com');
    RAISE EXCEPTION 'TESTFEHLER 4) Antrag ohne Wallet angenommen';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM = 'Dein aktuelles Guthaben reicht nicht aus (0 💎).', '4) falsche Meldung: '||SQLERRM;
  END;
  RESET ROLE;
  RAISE NOTICE '✓ 4) ohne Wallet abgelehnt';

  -- ── 5) Ohne IBAN und ohne PayPal ───────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban, paypal_email)
    VALUES (a, 3000, 60.00, NULL, '   ');
    RAISE EXCEPTION 'TESTFEHLER 5) Antrag ohne Auszahlungsweg angenommen';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM LIKE '%IBAN oder eine PayPal%', '5) falsche Meldung: '||SQLERRM;
  END;
  RESET ROLE;
  RAISE NOTICE '✓ 5) Auszahlungsweg Pflicht';

  -- ── 6) App-Payload (app/creator/payout-request.tsx) + Manipulationsversuch ─
  --    Die App schickt creator_id, diamonds_amount=Guthaben, euro_amount, iban,
  --    paypal_email, note. Zusätzlich hier status/admin_note/processed_at/
  --    created_at gefälscht — der Server muss sie überschreiben.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.payout_requests
    (creator_id, diamonds_amount, euro_amount, iban, paypal_email, note,
     status, admin_note, processed_at, created_at)
  VALUES
    (a, 3000, 60.00, 'DE89370400440532013000', NULL, 'Danke',
     'paid', 'selbst genehmigt', now(), '2020-01-01')
  RETURNING id INTO id_a;
  RESET ROLE;
  SELECT * INTO pr FROM public.payout_requests WHERE id = id_a;
  ASSERT pr.status = 'pending',                 '6) status muss pending sein, war: '||pr.status;
  ASSERT pr.admin_note IS NULL,                 '6) admin_note muss NULL sein';
  ASSERT pr.processed_at IS NULL,               '6) processed_at muss NULL sein';
  ASSERT pr.created_at > now() - interval '1 minute', '6) created_at muss Serverzeit sein, war: '||pr.created_at;
  ASSERT pr.diamonds_amount = 3000,             '6) diamonds_amount=3000 erwartet, war: '||pr.diamonds_amount;
  ASSERT pr.euro_amount = 60.00,                '6) euro_amount=60.00 erwartet, war: '||pr.euro_amount;
  RAISE NOTICE '✓ 6) App-Payload angenommen, status/admin_note/processed_at/created_at serverseitig';

  -- ── 7) Zweiter offener Antrag desselben Creators ───────────────────────────
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban)
    VALUES (a, 2500, 50.00, 'DE89370400440532013000');
    RAISE EXCEPTION 'TESTFEHLER 7) zweiter offener Antrag angenommen';
  EXCEPTION WHEN unique_violation THEN
    ASSERT SQLERRM LIKE 'Du hast bereits eine offene Auszahlungsanfrage%', '7) falsche Meldung: '||SQLERRM;
  END;
  RESET ROLE;
  RAISE NOTICE '✓ 7) nur ein offener Antrag pro Creator';

  -- ── 8) Web-Payload (apps/web/app/actions/payout.ts) ────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban, paypal_email, note)
  VALUES (e, 2600, 52.00, NULL, 'creator@example.com', NULL)
  RETURNING id INTO id_e;
  RESET ROLE;
  SELECT * INTO pr FROM public.payout_requests WHERE id = id_e;
  ASSERT pr.diamonds_amount = 2600 AND pr.euro_amount = 52.00 AND pr.status = 'pending',
    '8) Web-Antrag falsch: '||pr.diamonds_amount||' / '||pr.euro_amount||' / '||pr.status;
  RAISE NOTICE '✓ 8) Web-Payload angenommen';

  -- ── 9) Teilbetrag + gefälschter Euro-Betrag ────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban)
  VALUES (f, 2501, 9999.99, 'DE00')
  RETURNING id INTO id_f;
  RESET ROLE;
  SELECT * INTO pr FROM public.payout_requests WHERE id = id_f;
  ASSERT pr.diamonds_amount = 2501, '9) Teilbetrag 2501 erwartet, war: '||pr.diamonds_amount;
  ASSERT pr.euro_amount = 50.02,    '9) euro_amount=50.02 (Server) erwartet, war: '||pr.euro_amount;
  RAISE NOTICE '✓ 9) Teilbetrag erlaubt, Euro-Betrag rechnet der Server';

  -- ── 10) Ohne diamonds_amount → ganzes Guthaben ─────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.payout_requests (creator_id, paypal_email)
  VALUES (g, 'g@example.com')
  RETURNING id INTO id_g;
  RESET ROLE;
  SELECT * INTO pr FROM public.payout_requests WHERE id = id_g;
  ASSERT pr.diamonds_amount = 2750 AND pr.euro_amount = 55.00,
    '10) 2750 / 55.00 erwartet, war: '||pr.diamonds_amount||' / '||pr.euro_amount;
  RAISE NOTICE '✓ 10) fehlender Betrag = ganzes Guthaben';

  -- ── 11) Status-Regeln beim Update (wie im Table-Editor, ohne JWT) ──────────
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.payout_requests SET status = 'processing' WHERE id = id_a;
  UPDATE public.payout_requests SET status = 'paid' WHERE id = id_a;
  SELECT * INTO pr FROM public.payout_requests WHERE id = id_a;
  ASSERT pr.status = 'paid' AND pr.processed_at IS NOT NULL, '11) paid + processed_at erwartet';
  BEGIN
    UPDATE public.payout_requests SET status = 'pending' WHERE id = id_a;
    RAISE EXCEPTION 'TESTFEHLER 11) abgeschlossener Antrag wieder geöffnet';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM LIKE '%bereits abgeschlossen (paid)%', '11) falsche Meldung: '||SQLERRM;
  END;
  UPDATE public.payout_requests SET admin_note = 'überwiesen am 14.10.' WHERE id = id_a;  -- Notiz bleibt erlaubt
  BEGIN
    UPDATE public.payout_requests SET diamonds_amount = 5000 WHERE id = id_f;
    RAISE EXCEPTION 'TESTFEHLER 11) Betrag nachträglich geändert';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM LIKE '%unveränderlich%', '11) falsche Meldung: '||SQLERRM;
  END;
  BEGIN
    UPDATE public.payout_requests SET euro_amount = 9999 WHERE id = id_f;
    RAISE EXCEPTION 'TESTFEHLER 11) Euro-Betrag nachträglich geändert';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  RAISE NOTICE '✓ 11) paid/rejected sind Endzustände, Beträge unveränderlich';

  -- ── 12) admin_update_payout_status: Admin ja, Creator nein ─────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_update_payout_status(id_e, 'rejected', 'IBAN fehlt');
  RESET ROLE;
  SELECT * INTO pr FROM public.payout_requests WHERE id = id_e;
  ASSERT pr.status = 'rejected' AND pr.processed_at IS NOT NULL AND pr.admin_note = 'IBAN fehlt',
    '12) rejected durch Admin erwartet, war: '||pr.status;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.admin_update_payout_status(id_e, 'paid', NULL);
    RAISE EXCEPTION 'TESTFEHLER 12) abgelehnter Antrag auf paid gesetzt';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.admin_update_payout_status(id_f, 'paid', NULL);
    RAISE EXCEPTION 'TESTFEHLER 12) Creator hat eigenen Antrag auf paid gesetzt';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'Kein Admin-Zugriff', '12) falsche Meldung: '||SQLERRM;
  END;
  RESET ROLE;
  RAISE NOTICE '✓ 12) admin_update_payout_status: Admin darf, Creator nicht, rejected bleibt rejected';

  -- ── 13) get_creator_earnings: nur eigene Zahlen ────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT diamonds_balance INTO v FROM public.get_creator_earnings(b, 28);
  ASSERT v = 1000, '13) eigene Abfrage: 1000 erwartet, war: '||coalesce(v::text, 'NULL');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  BEGIN
    SELECT diamonds_balance INTO v FROM public.get_creator_earnings(b, 28);
    RAISE EXCEPTION 'TESTFEHLER 13) fremdes Guthaben lesbar: %', v;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  SELECT diamonds_balance INTO v FROM public.get_creator_earnings(b, 28);
  ASSERT v = 1000, '13) Admin: 1000 erwartet, war: '||coalesce(v::text, 'NULL');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  SET LOCAL ROLE service_role;
  SELECT diamonds_balance INTO v FROM public.get_creator_earnings(b, 28);
  ASSERT v = 1000, '13) service_role: 1000 erwartet, war: '||coalesce(v::text, 'NULL');
  RESET ROLE;
  RAISE NOTICE '✓ 13) get_creator_earnings: eigene ID / Admin / service_role ja, fremde ID 42501';

  -- ── 14) Zweite Sicherung vorhanden? ────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'payout_requests_one_open_per_creator') THEN
    RAISE NOTICE '✓ 14) UNIQUE-Index payout_requests_one_open_per_creator vorhanden';
  ELSE
    RAISE WARNING '14) UNIQUE-Index fehlt — Live-Daten hatten Doppelanträge, siehe Migration (a'')';
  END IF;

  RAISE NOTICE '══ payout_requests_guard: alle Tests grün ══';
END $$;

ROLLBACK;
