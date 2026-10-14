-- ============================================================================
-- payout_diamonds_escrow.sql — Test zu 20261014120100_payout_diamonds_escrow.sql
-- (Variante A: Diamanten beim Antrag abziehen, bei 'rejected' zurückbuchen)
--
-- Setzt 20261014120000_payout_requests_guard.sql voraus.
--
-- AUSFÜHREN: kompletten Block in Supabase → SQL Editor einfügen + Run.
-- SICHER: eine Transaktion mit ROLLBACK — nichts bleibt zurück. Ausgabe im
-- "Messages/Notices"-Tab. Ohne ERROR = alles grün.
-- ============================================================================
BEGIN;
SET LOCAL session_replication_role = replica;

-- ── Fixtures ────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, username, is_admin) VALUES
  ('11111111-1111-1111-1111-111111111111', 'test_creator_a', false),  -- 3.000 💎
  ('44444444-4444-4444-4444-444444444444', 'test_admin',     true),
  ('66666666-6666-6666-6666-666666666666', 'test_creator_f', false),  -- 5.000 💎
  ('88888888-8888-8888-8888-888888888881', 'test_legacy_1',  false),  -- 3.000 💎, Altantrag 3.000
  ('88888888-8888-8888-8888-888888888882', 'test_legacy_2',  false),  -- 3.000 💎, Altantrag 3.000
  ('88888888-8888-8888-8888-888888888883', 'test_legacy_3',  false);  -- 1.000 💎, Altantrag 3.000

INSERT INTO public.coins_wallets (user_id, coins, diamonds) VALUES
  ('11111111-1111-1111-1111-111111111111', 0, 3000),
  ('66666666-6666-6666-6666-666666666666', 0, 5000),
  ('88888888-8888-8888-8888-888888888881', 0, 3000),
  ('88888888-8888-8888-8888-888888888882', 0, 3000),
  ('88888888-8888-8888-8888-888888888883', 0, 1000);

-- Altanträge wie vor der Migration: Trigger aus (replica), nie abgezogen.
INSERT INTO public.payout_requests (id, creator_id, diamonds_amount, euro_amount, iban, status) VALUES
  ('99999999-9999-9999-9999-999999999981', '88888888-8888-8888-8888-888888888881', 3000, 60.00, 'DE00', 'pending'),
  ('99999999-9999-9999-9999-999999999982', '88888888-8888-8888-8888-888888888882', 3000, 60.00, 'DE00', 'processing'),
  ('99999999-9999-9999-9999-999999999983', '88888888-8888-8888-8888-888888888883', 3000, 60.00, 'DE00', 'pending');

SET LOCAL session_replication_role = origin;

DO $$
DECLARE
  a    uuid := '11111111-1111-1111-1111-111111111111';
  adm  uuid := '44444444-4444-4444-4444-444444444444';
  f    uuid := '66666666-6666-6666-6666-666666666666';
  l1   uuid := '88888888-8888-8888-8888-888888888881';
  l2   uuid := '88888888-8888-8888-8888-888888888882';
  l3   uuid := '88888888-8888-8888-8888-888888888883';
  rq_l1 uuid := '99999999-9999-9999-9999-999999999981';
  rq_l2 uuid := '99999999-9999-9999-9999-999999999982';
  rq_l3 uuid := '99999999-9999-9999-9999-999999999983';
  id1  uuid;
  id2  uuid;
  id_f uuid;
  pr   public.payout_requests%ROWTYPE;
  v    bigint;
  ts   timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payout_requests_20_diamonds') THEN
    RAISE EXCEPTION 'Trigger trg_payout_requests_20_diamonds fehlt — Migration 20261014120100 nicht eingespielt';
  END IF;

  -- ── 1) Antrag (App-Payload) zieht sofort ab ────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban, paypal_email, note)
  VALUES (a, 3000, 60.00, 'DE89370400440532013000', NULL, NULL)
  RETURNING id INTO id1;
  -- Creator sieht in App/Web sofort das Rest-Guthaben
  SELECT diamonds_balance INTO v FROM public.get_creator_earnings(a, 28);
  ASSERT v = 0, '1) get_creator_earnings nach Antrag: 0 erwartet, war: '||v;
  RESET ROLE;
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = a;
  ASSERT v = 0, '1) Wallet A nach Antrag: 0 erwartet, war: '||v;
  SELECT * INTO pr FROM public.payout_requests WHERE id = id1;
  ASSERT pr.diamonds_debited_at IS NOT NULL, '1) diamonds_debited_at muss gesetzt sein';
  RAISE NOTICE '✓ 1) Antrag zieht 3.000 💎 ab (Wallet 0, debited_at gesetzt)';

  -- ── 2) Ablehnung durch Admin bucht zurück ──────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_update_payout_status(id1, 'rejected', 'Test');
  RESET ROLE;
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = a;
  ASSERT v = 3000, '2) Wallet A nach Ablehnung: 3000 erwartet, war: '||v;
  RAISE NOTICE '✓ 2) rejected → 3.000 💎 zurück';

  -- ── 3) Abgelehnt bleibt abgelehnt — keine zweite Buchung ───────────────────
  BEGIN
    UPDATE public.payout_requests SET status = 'paid' WHERE id = id1;
    RAISE EXCEPTION 'TESTFEHLER 3) rejected → paid durchgelassen';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = a;
  ASSERT v = 3000, '3) Wallet A unverändert 3000 erwartet, war: '||v;
  RAISE NOTICE '✓ 3) rejected ist endgültig, keine Doppelbuchung';

  -- ── 4) Teilbetrag → paid: kein zweiter Abzug ───────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban)
  VALUES (a, 2500, 50.00, 'DE89370400440532013000')
  RETURNING id INTO id2;
  RESET ROLE;
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = a;
  ASSERT v = 500, '4) Wallet A nach Teilantrag: 500 erwartet, war: '||v;
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.payout_requests SET status = 'processing' WHERE id = id2;  -- Table-Editor-Weg
  UPDATE public.payout_requests SET status = 'paid'       WHERE id = id2;
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = a;
  ASSERT v = 500, '4) Wallet A nach paid: 500 erwartet (kein zweiter Abzug), war: '||v;
  RAISE NOTICE '✓ 4) paid zieht nicht noch einmal ab';

  -- ── 5) Befund 2: ausgezahltes Guthaben lässt sich nicht erneut beantragen ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban)
    VALUES (a, 2500, 50.00, 'DE89370400440532013000');
    RAISE EXCEPTION 'TESTFEHLER 5) bereits ausgezahltes Guthaben erneut beantragt';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM = 'Dein aktuelles Guthaben reicht nicht aus (500 💎).', '5) falsche Meldung: '||SQLERRM;
  END;
  RESET ROLE;
  RAISE NOTICE '✓ 5) nach Auszahlung kein zweiter Antrag auf dieselben Diamanten';

  -- ── 6) diamonds_debited_at kann der Client nicht vorgeben ──────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.payout_requests (creator_id, diamonds_amount, euro_amount, iban, diamonds_debited_at)
  VALUES (f, 5000, 100.00, 'DE00', '2000-01-01')
  RETURNING id INTO id_f;
  RESET ROLE;
  SELECT diamonds_debited_at INTO ts FROM public.payout_requests WHERE id = id_f;
  ASSERT ts > now() - interval '1 minute', '6) debited_at muss Serverzeit sein, war: '||ts;
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = f;
  ASSERT v = 0, '6) Wallet F: 0 erwartet, war: '||v;

  -- … und auch später nicht von Hand ändern
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    UPDATE public.payout_requests SET diamonds_debited_at = NULL WHERE id = id_f;
    RAISE EXCEPTION 'TESTFEHLER 6) diamonds_debited_at von Hand geändert';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  RAISE NOTICE '✓ 6) diamonds_debited_at setzt nur der Trigger';

  -- ── 7) Altantrag → rejected: nichts zurückbuchen (nie abgezogen) ───────────
  UPDATE public.payout_requests SET status = 'rejected' WHERE id = rq_l1;
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = l1;
  ASSERT v = 3000, '7) Wallet L1: 3000 erwartet (keine Gratis-Rückbuchung), war: '||v;
  RAISE NOTICE '✓ 7) Altantrag rejected → keine Rückbuchung';

  -- ── 8) Altantrag → paid: jetzt abziehen ────────────────────────────────────
  UPDATE public.payout_requests SET status = 'paid' WHERE id = rq_l2;
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = l2;
  ASSERT v = 0, '8) Wallet L2: 0 erwartet, war: '||v;
  SELECT * INTO pr FROM public.payout_requests WHERE id = rq_l2;
  ASSERT pr.diamonds_debited_at IS NOT NULL, '8) debited_at für Altantrag nach paid erwartet';
  RAISE NOTICE '✓ 8) Altantrag paid → Abzug beim Bezahlen';

  -- ── 9) Altantrag → paid ohne Deckung: Fehler statt Auszahlung ──────────────
  BEGIN
    UPDATE public.payout_requests SET status = 'paid' WHERE id = rq_l3;
    RAISE EXCEPTION 'TESTFEHLER 9) ungedeckter Altantrag auf paid gesetzt';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM LIKE 'Altantrag %Guthaben reicht nicht%', '9) falsche Meldung: '||SQLERRM;
  END;
  SELECT * INTO pr FROM public.payout_requests WHERE id = rq_l3;
  ASSERT pr.status = 'pending', '9) Status muss pending bleiben, war: '||pr.status;
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = l3;
  ASSERT v = 1000, '9) Wallet L3 unverändert 1000 erwartet, war: '||v;
  RAISE NOTICE '✓ 9) ungedeckter Altantrag blockiert';

  RAISE NOTICE '══ payout_diamonds_escrow: alle Tests grün ══';
END $$;

ROLLBACK;
