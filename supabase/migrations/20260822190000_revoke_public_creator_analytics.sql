-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ NACHTRAG zu 20260822170000 — das REVOKE hat bei drei von fünf nicht gewirkt
--
-- GEMESSEN am 22.08.2026, unmittelbar nach dem Einspielen. Von aussen mit dem
-- öffentlichen Schlüssel:
--
--   get_creator_earnings         → 401 / 42501   ✅
--   get_creator_gift_history     → 401 / 42501   ✅
--   get_creator_top_posts        → 400 / 42702   ❌ lief durch (Laufzeitfehler IM Rumpf)
--   get_creator_overview         → 200           ❌
--   get_creator_follower_growth  → 200           ❌
--
-- KEINE Überladung (jede Funktion hat genau eine Signatur, am Abzug geprüft),
-- und die Signaturen im REVOKE stimmten zeichengenau.
--
-- ⚠️ DIE URSACHE IST DIE SPIEGELSEITE DER WARNUNG, DIE IN 20260822170000 STEHT.
--
-- Dort steht: „Ein `REVOKE ALL … FROM PUBLIC` löscht nur den PUBLIC-Eintrag und
-- lässt den anon-Eintrag stehen — nur ein REVOKE, das `anon` ausdrücklich nennt,
-- wirkt."
--
-- Das stimmt. Und es gilt **in beide Richtungen**: Ein `REVOKE … FROM anon`
-- löscht nur den anon-Eintrag und lässt den PUBLIC-Eintrag stehen. Bei
-- FUNKTIONEN hat `PUBLIC` von Haus aus `EXECUTE` — Postgres vergibt es beim
-- Anlegen automatisch, und `pg_dump` schreibt es nicht aus, weil es der
-- Standard ist. **Ein Recht, das im Abzug nicht steht, ist deshalb nicht
-- abwesend.**
--
-- Warum genau zwei der fünf trotzdem zumachten: Für `get_creator_earnings` und
-- `get_creator_gift_history` stand ein `REVOKE … FROM PUBLIC` bereits in der
-- Datenbank (Abzug Z. 26089 und 26117). Bei denen war nach meinem anon-REVOKE
-- kein Eintrag mehr übrig. Bei den drei anderen fehlte er.
--
-- > **Die Regel, die aus beiden Hälften wird: Ein Recht auf einer Funktion ist
-- > erst weg, wenn PUBLIC *und* anon es verloren haben. Und geprüft wird das
-- > nicht am Abzug, sondern mit einem Aufruf von aussen.**
--
-- Ich habe diese Falle in `20260822170000` selbst beschrieben und bin eine
-- Stunde später in ihre andere Hälfte gelaufen. Aufgefallen ist es nur, weil
-- die Gegenprobe nicht „steht das REVOKE in der Datei" fragte, sondern
-- „antwortet der Server jetzt mit 401" — die Sorte Probe, die dieses Projekt
-- seit dem 19.08. „gemessen statt vermutet" nennt.
--
-- ⚠️ ALLE FÜNF, nicht nur die drei offenen: `REVOKE` ist idempotent, und eine
-- Liste, die nur die Ausnahmen nennt, ist beim nächsten Lesen eine Falle.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_creator_top_posts(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_creator_earnings(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_creator_gift_history(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_creator_overview(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_creator_follower_growth(uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_creator_top_posts(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_earnings(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_gift_history(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_overview(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_follower_growth(uuid, integer) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. ⚠️ NICHT am Abzug prüfen. Von aussen, mit dem öffentlichen Schlüssel:
--      POST /rest/v1/rpc/get_creator_overview  {"p_user_id":"<irgendeine uuid>"}
--    -- erwartet: 401 mit code 42501 — für ALLE FÜNF.
--    -- Ein 200 oder ein Laufzeitfehler (z. B. 42702) heisst: sie läuft noch.
--
-- 2. Der berechtigte Weg bleibt offen:
--      SELECT has_function_privilege('authenticated',
--             'public.get_creator_overview(uuid,integer)', 'EXECUTE');
--    -- erwartet: true
--
-- 3. Serlos Web-Studio und die Analytics-Seite der App sind die einzigen
--    Aufrufer und laufen angemeldet — sie dürfen sich nicht ändern.
--
-- 4. Und die Frage, die dieser Nachtrag für den nächsten Durchgang aufwirft:
--    Wie viele der übrigen anon-ausführbaren SECURITY-DEFINER-Funktionen sind
--    in Wahrheit über PUBLIC erreichbar, ohne dass ein anon-GRANT im Abzug
--    steht? Der Audit vom 22.08. hat nach `TO "anon"` gesucht — diese Klasse
--    fällt durch dieses Raster.
--      SELECT p.proname, pg_get_function_identity_arguments(p.oid)
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public' AND p.prosecdef
--         AND has_function_privilege('anon', p.oid, 'EXECUTE')
--       ORDER BY 1;
--    -- DAS ist die vollständige Liste. Sie ist länger als die aus dem Abzug.
-- ─────────────────────────────────────────────────────────────────────────────
