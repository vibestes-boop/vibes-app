-- ═══════════════════════════════════════════════════════════════════════════
-- Beweis: Der Nachtdienst kommt durch
-- 10.09.2026 · Berkat · Übergabe Abschnitt 100
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Diese Migration ändert nichts. Sie klingelt einmal und schreibt auf, was
-- zurückkam — damit im Repo steht, dass der Weg am 10.09.2026 wirklich offen
-- war und nicht nur so aussah.
--
-- VORGESCHICHTE IN EINEM ABSATZ
-- Der erste Anlauf (`20260910120000`) hatte zwei stille Fehler übereinander:
-- ein `search_path` ohne `vault` (behoben in `…130000`) und einen Vergleich
-- `bearer === SUPABASE_SERVICE_ROLE_KEY`, der fehlschlug, weil der Schlüssel im
-- Vault aus einer früheren Runde stammt. Beide zusammen ergaben: Wecker
-- klingelt, Ruf kommt an, 403 zurück, pg_net sieht die Antwort nie an — alles
-- grün, nichts passiert.
--
-- ⚠️ Die Lehre, und sie ist teurer als dieser eine Fehler:
-- **Ein fire-and-forget-Ruf ohne Fahrtenbuch ist nicht prüfbar, und was nicht
-- prüfbar ist, gilt als kaputt.** Die Function nimmt seither jeden gültigen
-- Dienstschlüssel über den `role`-Anspruch an, statt auf einen bestimmten zu
-- zeigen — das überlebt auch die nächste Rotation.
--
-- Später nachsehen, jederzeit:
--     SELECT * FROM public.berkat_night_service_health();

BEGIN;
SELECT public.berkat_ask_stripe('accounts');
COMMIT;

SELECT pg_sleep(12);

DO $$
DECLARE
  r record;
BEGIN
  SELECT * INTO r FROM public.berkat_night_service_health() LIMIT 1;

  IF r.status = 200 THEN
    RAISE NOTICE '✅ % | %  →  %', r.wann, r.auftrag, r.befund;
  ELSE
    RAISE WARNING '⚠️  % | %  →  %', r.wann, r.auftrag, r.befund;
  END IF;
END $$;
