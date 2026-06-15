-- ============================================================================
-- send_gift.sql — Transaktions-Test der Geld-RPC `send_gift`.
--
-- Testet die ECHTE SQL-Logik: Coins↔Diamonds-Verschiebung, total_gifted,
-- gift_transactions-Anlage, alle Fehlerpfade.
--
-- AUSFÜHREN: kompletten Block in Supabase → SQL Editor einfügen + Run.
-- SICHER: eine Transaktion mit ROLLBACK — nichts bleibt zurück. Ausgabe im
-- "Messages/Notices"-Tab. "Success. No rows returned" (ohne ERROR) = alles grün.
-- ============================================================================
BEGIN;
SET LOCAL session_replication_role = replica;

-- ── Fixtures ────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, username) VALUES
  ('11111111-1111-1111-1111-111111111111', 'test_sender'),
  ('22222222-2222-2222-2222-222222222222', 'test_recipient');

INSERT INTO public.coins_wallets (user_id, coins, diamonds, total_gifted) VALUES
  ('11111111-1111-1111-1111-111111111111', 200, 0, 0),
  ('22222222-2222-2222-2222-222222222222', 0,   0, 0);

INSERT INTO public.gift_catalog (id, name, emoji, coin_cost, diamond_value) VALUES
  ('test_rose',   'Test Rose',   '🌹', 50,  35),
  ('test_castle', 'Test Castle', '🏰', 999, 700);

-- Session A: allow_gifts default (true) · Session B: allow_gifts=false
INSERT INTO public.live_sessions (id, host_id, allow_gifts) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', false);

DO $$
DECLARE
  sender    uuid := '11111111-1111-1111-1111-111111111111';
  recipient uuid := '22222222-2222-2222-2222-222222222222';
  nowallet  uuid := '66666666-6666-6666-6666-666666666666';
  sess_a    text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  sess_b    text := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  r jsonb;
  v int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sender)::text, true);

  -- 1) gift_not_found
  r := public.send_gift(recipient, sess_a, 'does_not_exist');
  ASSERT r->>'error' = 'gift_not_found', '1) gift_not_found erwartet, war: '||coalesce(r::text,'NULL');
  RAISE NOTICE '✓ 1) gift_not_found';

  -- 2) gifts_disabled — Session B hat allow_gifts=false
  r := public.send_gift(recipient, sess_b, 'test_rose');
  ASSERT r->>'error' = 'gifts_disabled', '2) gifts_disabled erwartet, war: '||coalesce(r::text,'NULL');
  RAISE NOTICE '✓ 2) gifts_disabled';

  -- 3) cannot_gift_yourself
  r := public.send_gift(sender, sess_a, 'test_rose');
  ASSERT r->>'error' = 'cannot_gift_yourself', '3) cannot_gift_yourself erwartet, war: '||coalesce(r::text,'NULL');
  RAISE NOTICE '✓ 3) cannot_gift_yourself';

  -- 4) insufficient_coins — Castle kostet 999, Sender hat 200 (KEIN Abbuchen)
  r := public.send_gift(recipient, sess_a, 'test_castle');
  ASSERT r->>'error' = 'insufficient_coins', '4) insufficient_coins erwartet, war: '||coalesce(r::text,'NULL');
  ASSERT (r->>'balance')::int = 200,          '4) balance=200 erwartet, war: '||(r->>'balance');
  SELECT coins INTO v FROM public.coins_wallets WHERE user_id = sender;
  ASSERT v = 200,                             '4) Sender-Coins dürfen NICHT sinken (=200), war: '||v;
  RAISE NOTICE '✓ 4) insufficient_coins (kein Abbuchen)';

  -- 5) Erfolgreiches Gift — Rose 50c/35d: Sender 200→150, Empfänger +35 Diamanten
  r := public.send_gift(recipient, sess_a, 'test_rose');
  ASSERT (r->>'success')::bool,             '5) success erwartet, war: '||coalesce(r::text,'NULL');
  ASSERT (r->>'new_balance')::int = 150,    '5) new_balance=150 erwartet, war: '||(r->>'new_balance');
  SELECT coins        INTO v FROM public.coins_wallets WHERE user_id = sender;
  ASSERT v = 150,                           '5) Sender-Coins=150 erwartet, war: '||v;
  SELECT total_gifted INTO v FROM public.coins_wallets WHERE user_id = sender;
  ASSERT v = 50,                            '5) Sender total_gifted=50 erwartet, war: '||v;
  SELECT diamonds     INTO v FROM public.coins_wallets WHERE user_id = recipient;
  ASSERT v = 35,                            '5) Empfänger-Diamanten=35 erwartet, war: '||v;
  ASSERT EXISTS (SELECT 1 FROM public.gift_transactions
                 WHERE sender_id = sender AND recipient_id = recipient
                   AND gift_id = 'test_rose' AND coin_cost = 50 AND diamond_value = 35),
                                            '5) gift_transactions-Eintrag fehlt';
  RAISE NOTICE '✓ 5) Gift: Sender 150, +35 Diamanten, total_gifted 50, Transaktion';

  -- 6) no_wallet — Sender ohne Wallet
  PERFORM set_config('request.jwt.claims', json_build_object('sub', nowallet)::text, true);
  r := public.send_gift(recipient, sess_a, 'test_rose');
  ASSERT r->>'error' = 'no_wallet', '6) no_wallet erwartet, war: '||coalesce(r::text,'NULL');
  RAISE NOTICE '✓ 6) no_wallet';

  RAISE NOTICE '────────────────────────────';
  RAISE NOTICE '✅ ALLE 6 send_gift-Tests bestanden';
END $$;

ROLLBACK;
