-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Fehlende Geschenke in gift_catalog nachmigrieren
-- Datum: 2026-04-16
--
-- Problem: chechen_tower und chechen_tower_premium wurden im Frontend-Katalog
-- (lib/gifts.ts) hinzugefügt, aber nie in die DB-Tabelle gift_catalog geschrieben.
-- → send_gift RPC wirft 'gift_not_found' → Viewer sehen "Verbindungsfehler"
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO gift_catalog (id, name, emoji, coin_cost, diamond_value, color, sort_order, lottie_url)
VALUES
  ('chechen_tower',         'Башня',         '🏰',  750,  660, '#b45309', 9,  NULL),
  ('chechen_tower_premium', 'Башня Премиум', '🏯', 2000, 1760, '#92400e', 10, NULL)
ON CONFLICT (id) DO UPDATE
  SET name          = EXCLUDED.name,
      emoji         = EXCLUDED.emoji,
      coin_cost     = EXCLUDED.coin_cost,
      diamond_value = EXCLUDED.diamond_value,
      color         = EXCLUDED.color,
      sort_order    = EXCLUDED.sort_order;

DO $$
BEGIN
  RAISE NOTICE '✅ chechen_tower + chechen_tower_premium in gift_catalog eingefügt';
END $$;
