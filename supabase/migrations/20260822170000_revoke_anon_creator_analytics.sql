-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ Fünf Creator-Auswertungen sind ohne Anmeldung aufrufbar
--
-- GEFUNDEN am 22.08.2026 im Sicherheits-Audit, am Produktions-Abzug belegt.
-- Alle fünf sind `SECURITY DEFINER`, laufen also an RLS vorbei, nehmen eine
-- fremde Nutzer-ID als Parameter — und tragen ein EXECUTE für `anon`:
--
--   get_creator_top_posts(p_user_id, p_sort, p_limit)
--   get_creator_earnings(p_user_id, p_days)
--   get_creator_gift_history(p_user_id, p_limit)
--   get_creator_overview(p_user_id, p_days)
--   get_creator_follower_growth(p_user_id, p_days)
--
-- Der schwerste ist `get_creator_top_posts`. Sein einziges Prädikat auf `posts`
-- lautet im ganzen Rumpf:
--
--     WHERE p.author_id = p_user_id
--
-- Kein `privacy`, kein `women_only`, kein `auth.uid()`. **Bildpfad und Text
-- privater und Frauen-Only-Beiträge jedes beliebigen Nutzers, ohne Konto.**
-- Die Nutzer-IDs dafür liefert `get_public_discover_people_web`, ebenfalls
-- ohne Anmeldung.
--
-- Die übrigen vier geben Diamant-Guthaben, Schenker-Historie, Reichweite und
-- Follower-Verlauf heraus. `20260414040000_creator_earnings.sql` behauptet in
-- seinem Kopf ausdrücklich das Gegenteil — geschrieben wurde das REVOKE nie
-- oder es ist einer späteren Neuerzeugung zum Opfer gefallen.
--
-- ⚠️ DIE WURZEL, und sie erklärt die ganze Klasse:
--
--     ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
--       GRANT ALL ON FUNCTIONS TO "anon";
--
-- Diese Zeile steht in der Datenbank. Jede NEU angelegte Funktion bekommt
-- dadurch einen EIGENEN anon-Eintrag in der Rechteliste. Ein
-- `REVOKE ALL … FROM PUBLIC` löscht nur den PUBLIC-Eintrag und lässt den
-- anon-Eintrag stehen — **nur ein REVOKE, das `anon` ausdrücklich nennt,
-- wirkt.** Genau daran unterscheiden sich die Berkat-Migrationen (die es
-- durchgängig tun und im Abzug sauber dastehen) von den älteren Serlo-Migrationen.
--
-- ⚠️ WARUM DAS HIER GEFAHRLOS IST — nachgesehen, nicht angenommen:
-- Die berechtigten Aufrufer sind `apps/web/lib/data/studio.ts` (Serlos
-- Web-Studio) und `lib/useAnalytics.ts` (Serlos App). Beide laufen in einer
-- ANGEMELDETEN Sitzung, also als `authenticated`. Diese Rolle behält das Recht.
--
-- ⚠️ WAS DIESE MIGRATION NICHT LÖST — bewusst:
-- Die fünf prüfen `p_user_id` nicht gegen `auth.uid()`. Nach diesem REVOKE ist
-- der Weg für Unangemeldete zu, aber **ein beliebiger angemeldeter Nutzer kann
-- weiterhin eine fremde ID übergeben** und dieselben Daten lesen. Das zu
-- schliessen heisst, fünf Funktionsrümpfe neu zu erzeugen — und genau dabei
-- sind in diesem Projekt schon zweimal spätere Änderungen verlorengegangen
-- (`buy_now_live_auction`, Abschnitte 20/22/24). Es gehört in eine eigene
-- Migration mit dem Original daneben, nicht als Anhängsel in ein REVOKE.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_creator_top_posts(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_creator_earnings(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_creator_gift_history(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_creator_overview(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_creator_follower_growth(uuid, integer) FROM anon;

-- Ausdrücklich bestätigen, was bleiben soll — damit ein späterer Leser nicht
-- rät, ob das REVOKE zu weit ging.
GRANT EXECUTE ON FUNCTION public.get_creator_top_posts(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_earnings(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_gift_history(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_overview(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_follower_growth(uuid, integer) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. Kein anon-Recht mehr, authenticated behält es:
--      SELECT p.proname,
--             has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_darf,
--             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS user_darf
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public' AND p.proname LIKE 'get_creator_%'
--       ORDER BY 1;
--      -- erwartet: anon_darf = false, user_darf = true — für alle fünf
--
-- 2. Von aussen, mit dem oeffentlichen Schluessel:
--      POST /rest/v1/rpc/get_creator_top_posts  {"p_user_id":"<beliebig>"}
--      -- erwartet: 401 / 42501. Vorher: die Beitraege.
--
-- 3. Serlos Web-Studio und die Analytics-Seite der App muessen unveraendert
--    laufen — beide sind angemeldet. Das ist die Probe, die man NICHT
--    ueberspringt: Sie ist der Grund, warum hier REVOKE und nicht DROP steht.
--
-- 4. Und die Frage fuer den naechsten Durchgang — dieselbe Wurzel, andere
--    Funktionen:
--      SELECT p.proname, pg_get_function_identity_arguments(p.oid)
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname='public'
--         AND has_function_privilege('anon', p.oid, 'EXECUTE')
--         AND p.prosecdef
--       ORDER BY 1;
--      -- Der Audit vom 22.08. zaehlte 108 solche Funktionen. Fuenf davon sind
--      -- mit dieser Migration zu. Die Liste ist NICHT abgearbeitet.
-- ─────────────────────────────────────────────────────────────────────────────
