-- ================================================================
-- v1.17.0 — Gift-Raritäten + Seasons
-- ================================================================
-- Erweitert gift_catalog um:
--   • rarity          — 'common' | 'rare' | 'epic' | 'legendary'
--                       → UI-Glow, Sortierung, Filter
--   • season_tag      — nullable text. Gifts mit season_tag werden
--                       als "Saison-Gift" gehighlightet.
--   • available_from  — nullable timestamptz. Gift erscheint erst dann.
--   • available_until — nullable timestamptz. Gift verschwindet danach.
--
-- Active-Check via SQL-Function `gift_is_active(g)` für die Clients:
--   now() zwischen available_from/until — null = kein Limit.
--
-- Bestehende Gifts bekommen automatisch eine Rarity anhand coin_cost:
--   ≤ 50     → common
--   ≤ 300    → rare
--   ≤ 1500   → epic
--   > 1500   → legendary
-- ================================================================

ALTER TABLE public.gift_catalog
  ADD COLUMN IF NOT EXISTS rarity          TEXT        NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common','rare','epic','legendary')),
  ADD COLUMN IF NOT EXISTS season_tag      TEXT,
  ADD COLUMN IF NOT EXISTS available_from  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;

-- Index für zeitbasierte Filter
CREATE INDEX IF NOT EXISTS idx_gift_catalog_window
  ON public.gift_catalog (available_from, available_until);

-- ─── Initial-Backfill: Rarity anhand coin_cost ────────────────────
UPDATE public.gift_catalog
   SET rarity = CASE
     WHEN coin_cost <= 50   THEN 'common'
     WHEN coin_cost <= 300  THEN 'rare'
     WHEN coin_cost <= 1500 THEN 'epic'
     ELSE                        'legendary'
   END
 WHERE rarity = 'common';   -- nur frisch gesetzte Defaults überschreiben

-- ─── Active-Check-Function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gift_is_active(g public.gift_catalog)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    (g.available_from  IS NULL OR g.available_from  <= NOW())
    AND (g.available_until IS NULL OR g.available_until > NOW())
$$;

-- ─── Seed: Ramadan-Season-Gift (Beispiel) ─────────────────────────
-- Läuft vom 2026-04-18 bis 2026-05-18 (fiktiv); dient als Blueprint.
-- Kein Lottie, nur Emoji + Color — Skin kann später ergänzt werden.
INSERT INTO public.gift_catalog (
  id, name, emoji, coin_cost, diamond_value, color,
  sort_order, rarity, season_tag, available_from, available_until
) VALUES
  ('ramadan_moon', 'Ramadan-Mond', '🌙', 300, 260, '#10B981',
   20, 'epic', 'ramadan_2026', '2026-04-18'::timestamptz, '2026-05-18'::timestamptz)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '✅ Gift-Raritäten + Seasons deployed (v1.17.0)';
END $$;
