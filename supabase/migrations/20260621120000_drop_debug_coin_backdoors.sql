-- 🔴 SECURITY-FIX (KRITISCH) — Debug-Coin-Backdoors entfernen
--
-- `add_test_coins` war SECURITY DEFINER + GRANT EXECUTE TO authenticated.
-- Damit konnte JEDER eingeloggte Nutzer via öffentlichem Anon-Key direkt
--     supabase.rpc('add_test_coins', { p_user_id: <eigene id>, p_coins: 999999 })
-- aufrufen und sich unbegrenzt Coins/Diamanten gutschreiben →
-- Geschenke/Käufe oder Diamanten → echte Auszahlung (SEPA/PayPal) = Finanzbetrug.
--
-- `debug_send_gift` (zog zwar Coins ab) war ebenfalls für `authenticated` offen —
-- redundanter Debug-Pfad, gehört nicht in Produktion.
--
-- Beide werden im App-Code nur vom Debug-Screen (app/debug-gifts.tsx) aufgerufen,
-- der parallel per OTA entfernt wird. Drop ist daher gefahrlos.

DROP FUNCTION IF EXISTS public.add_test_coins(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.debug_send_gift(text, text);

DO $$ BEGIN
  RAISE NOTICE '🔒 Debug-Coin-Backdoors entfernt: add_test_coins + debug_send_gift';
END $$;
