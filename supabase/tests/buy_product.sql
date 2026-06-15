-- ============================================================================
-- buy_product.sql — Transaktions-Test der Geld-RPC `buy_product`.
--
-- Testet die ECHTE SQL-Logik (nicht nur den TS-Vertrag): Coin-Abbuchung,
-- Verkäufer-Diamanten, Order-Anlage, Fehlerpfade, Angebotspreis.
--
-- AUSFÜHREN: kompletten Block in Supabase → SQL Editor einfügen + Run.
-- SICHER: läuft in EINER Transaktion und endet mit ROLLBACK — es bleibt
-- NICHTS in der DB zurück. Ausgabe erscheint im "Messages/Notices"-Tab.
--
-- Trick: `session_replication_role = replica` schaltet FK/Trigger nur für diese
-- Transaktion ab, damit wir Test-Profile/Wallets ohne auth.users-Kette anlegen
-- können. Der JWT-Claim simuliert auth.uid() (Käufer/Verkäufer).
-- Falls "permission denied to set parameter session_replication_role" kommt:
-- sag Bescheid, dann nehme ich die Variante mit echten auth.users-Fixtures.
-- ============================================================================
BEGIN;
SET LOCAL session_replication_role = replica;

-- ── Fixtures ────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, username) VALUES
  ('11111111-1111-1111-1111-111111111111', 'test_buyer'),
  ('22222222-2222-2222-2222-222222222222', 'test_seller');

INSERT INTO public.coins_wallets (user_id, coins, diamonds) VALUES
  ('11111111-1111-1111-1111-111111111111', 150, 0),
  ('22222222-2222-2222-2222-222222222222', 0,   0);

-- Produkt A: Stück 100 Coins, Stock unbegrenzt (-1) → isoliert die Coin-Pfade
-- Produkt B: Stock 2 → out_of_stock
-- Produkt C: Angebotspreis 50 (statt 100) → Sale-Vorrang
INSERT INTO public.products (id, seller_id, title, price_coins, sale_price_coins, category, stock) VALUES
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Prod A', 100, NULL, 'digital', -1),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Prod B', 100, NULL, 'digital', 2),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'Prod C', 100, 50,   'digital', -1);

DO $$
DECLARE
  buyer  uuid := '11111111-1111-1111-1111-111111111111';
  seller uuid := '22222222-2222-2222-2222-222222222222';
  r jsonb;
  v int;
BEGIN
  -- 1) cannot_buy_own — Verkäufer kauft eigenes Produkt
  PERFORM set_config('request.jwt.claims', json_build_object('sub', seller)::text, true);
  r := public.buy_product('33333333-3333-3333-3333-333333333333', 1);
  ASSERT r->>'error' = 'cannot_buy_own', '1) cannot_buy_own erwartet, war: '||coalesce(r::text,'NULL');
  RAISE NOTICE '✓ 1) cannot_buy_own';

  -- ab jetzt: Käufer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', buyer)::text, true);

  -- 2) Erfolgreicher Kauf: 1×100 → Saldo 150→50, success
  r := public.buy_product('33333333-3333-3333-3333-333333333333', 1);
  ASSERT (r->>'success')::bool,            '2) success erwartet, war: '||coalesce(r::text,'NULL');
  ASSERT (r->>'new_balance')::int = 50,    '2) new_balance=50 erwartet, war: '||(r->>'new_balance');
  SELECT coins INTO v FROM public.coins_wallets WHERE user_id = buyer;
  ASSERT v = 50,                           '2) Käufer-Wallet=50 erwartet, war: '||v;
  -- Verkäufer-Diamanten: GREATEST(1, ROUND(100*0.70)) = 70
  SELECT diamonds INTO v FROM public.coins_wallets WHERE user_id = seller;
  ASSERT v = 70,                           '2) Verkäufer-Diamanten=70 erwartet, war: '||v;
  ASSERT EXISTS (SELECT 1 FROM public.orders WHERE buyer_id = buyer AND total_coins = 100 AND status = 'pending'),
                                           '2) Order (100 Coins, pending) fehlt';
  RAISE NOTICE '✓ 2) Kauf: Saldo 50, 70 Diamanten, Order angelegt';

  -- 3) insufficient_coins — Käufer hat noch 50, will 1×100
  r := public.buy_product('33333333-3333-3333-3333-333333333333', 1);
  ASSERT r->>'error' = 'insufficient_coins', '3) insufficient_coins erwartet, war: '||coalesce(r::text,'NULL');
  SELECT coins INTO v FROM public.coins_wallets WHERE user_id = buyer;
  ASSERT v = 50,                             '3) Saldo darf NICHT abgebucht werden (=50), war: '||v;
  RAISE NOTICE '✓ 3) insufficient_coins (kein Abbuchen)';

  -- 4) out_of_stock — Prod B Stock 2, will 3
  r := public.buy_product('44444444-4444-4444-4444-444444444444', 3);
  ASSERT r->>'error' = 'out_of_stock',     '4) out_of_stock erwartet, war: '||coalesce(r::text,'NULL');
  RAISE NOTICE '✓ 4) out_of_stock';

  -- 5) product_not_found — unbekannte ID
  r := public.buy_product('99999999-9999-9999-9999-999999999999', 1);
  ASSERT r->>'error' = 'product_not_found', '5) product_not_found erwartet, war: '||coalesce(r::text,'NULL');
  RAISE NOTICE '✓ 5) product_not_found';

  -- 6) Angebotspreis hat Vorrang — Prod C: price 100, sale 50 → kostet 50
  -- Käufer hat 50 → genau genug, Saldo danach 0
  r := public.buy_product('55555555-5555-5555-5555-555555555555', 1);
  ASSERT (r->>'success')::bool,            '6) success erwartet, war: '||coalesce(r::text,'NULL');
  ASSERT (r->>'new_balance')::int = 0,     '6) new_balance=0 (Sale-Preis 50) erwartet, war: '||(r->>'new_balance');
  RAISE NOTICE '✓ 6) Angebotspreis (50 statt 100) korrekt abgebucht';

  RAISE NOTICE '────────────────────────────';
  RAISE NOTICE '✅ ALLE 6 buy_product-Tests bestanden';
END $$;

ROLLBACK;
