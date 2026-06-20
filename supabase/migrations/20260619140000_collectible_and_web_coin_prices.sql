-- ════════════════════════════════════════════════════════════════════════════
-- (1) Produkt-Kategorie 'collectible' erlauben  + (2) Web-Coin-Preise an App
--     angleichen, damit der "Web-Bonus" tatsächlich stimmt.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. 'collectible' als gültige Produkt-Kategorie ──────────────────────────
-- Das Web-Formular bietet 'collectible' an, die CHECK-Constraint lehnte es aber
-- ab → Speichern schlug fehl. Jetzt überall erlaubt (App-UI wird per OTA ergänzt).
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products ADD CONSTRAINT products_category_check
  CHECK (category = ANY (ARRAY['digital'::text, 'physical'::text, 'service'::text, 'collectible'::text]));

-- ── 2. Web-Coin-Preise = App-Preise (gleicher Preis, MEHR Coins = echter Bonus)
-- Vorher war Web pro Coin teurer als die App (widersprach dem "+33%"-Versprechen).
-- App-Preistiers: 0,99 / 3,99 / 8,99 / 19,99 €. Die Web-Tiers behalten ihre
-- (höheren) Coin-Mengen inkl. Bonus, bekommen aber die App-Preise → Web liefert
-- jetzt 20–33 % MEHR Coins als die App zum selben Preis.
UPDATE public.coin_pricing_tiers SET price_cents = 99   WHERE id = 'web-100';   -- 120 Coins für 0,99 € (App: 100)
UPDATE public.coin_pricing_tiers SET price_cents = 399  WHERE id = 'web-500';   -- 620 Coins für 3,99 € (App: 500)
UPDATE public.coin_pricing_tiers SET price_cents = 899  WHERE id = 'web-1200';  -- 1550 Coins für 8,99 € (App: 1200)
UPDATE public.coin_pricing_tiers SET price_cents = 1999 WHERE id = 'web-3000';  -- 4000 Coins für 19,99 € (App: 3000)

DO $$
BEGIN
  RAISE NOTICE '✅ collectible-Kategorie erlaubt + Web-Coin-Preise an App angeglichen';
END $$;
