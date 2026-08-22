-- ─────────────────────────────────────────────────────────────────────────────
-- Wie viele haben das gemerkt? — als AGGREGAT, nie als Namensliste
--
-- Whatnot zeigt auf jeder Marktplatz-Karte ein Lesezeichen mit Zahl („🔖 1",
-- Analyse 13). Das ist ein soziales Signal: Nicht „habe ICH es gemerkt",
-- sondern „andere finden das interessant". Bei dünnem Bestand ist genau das
-- wertvoll — es unterscheidet die Artikel, die jemand beachtet, von denen, die
-- nur herumliegen.
--
-- ⚠️ WARUM DAS EINE FUNKTION BRAUCHT UND KEINE ABFRAGE
-- `berkat_saved_listings` trägt seit `20260817140000` die Policy
--
--   berkat_saved_select_own … USING (user_id = auth.uid())
--
-- Ein Client sieht also ausschließlich seine EIGENEN Merkungen — und das ist
-- Absicht, im Kopf von `lib/useSaved.ts` ausdrücklich begründet: „wer was
-- gemerkt hat, ist eine private Auskunft."
--
-- Diese Policy aufzuweichen wäre der falsche Reflex. Es ist derselbe Fall wie
-- bei `order_reviews` (HANDOFF, Abschnitt 3): Die Lösung ist eine Funktion, die
-- **nur das Aggregat** herausgibt und die einzelnen Zeilen niemals verlässt.
-- `get_seller_rating` macht es seit dem 14.08.2026 genauso.
--
-- ⚠️ WAS DIE FUNKTION BEWUSST NICHT KANN
--   * Keine Namen, keine IDs — nur `listing_id` und `count`.
--   * Kein „wer zuletzt". Auch ein Zeitstempel wäre in einer kleinen
--     Gemeinschaft ein Hinweis auf die Person.
--   * Nur Artikel, die der Aufrufer ohnehin sehen darf: Die Zählung läuft über
--     einen JOIN auf `live_auctions` mit derselben Frauen-Only-Bedingung, die
--     die Lese-Policy dort zieht. Ohne diesen JOIN verriete die bloße Zahl,
--     dass es zu einer verborgenen Artikel-ID überhaupt etwas gibt.
-- ─────────────────────────────────────────────────────────────────────────────

-- ⚠️ Die Spalte heißt `auction_id`, NICHT `listing_id`.
-- Beim ersten Anlauf geraten und vom Server abgewiesen („column s.listing_id
-- does not exist"). Der Grund für die Verwechslung steckt im Bau: Regal-Artikel
-- und Show-Artikel sind DIESELBE Tabelle (`live_auctions`) — im Client heißen
-- sie `Listing`, in der Datenbank `auction`. Beide Namen sind richtig, und
-- genau deshalb verwechselt man sie.
-- Nach außen bleibt es `listing_id`: Der Client kennt sie so.
CREATE OR REPLACE FUNCTION public.get_saved_counts(p_ids uuid[])
RETURNS TABLE(listing_id uuid, saves integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.auction_id AS listing_id, count(*)::int AS saves
    FROM public.berkat_saved_listings s
    JOIN public.live_auctions a ON a.id = s.auction_id
   WHERE s.auction_id = ANY(p_ids)
     -- Dieselbe Schranke wie `live_auctions_select_standing`. Von Hand
     -- mitgeschrieben, weil RLS in einer SECURITY-DEFINER-Funktion nicht gilt
     -- (HANDOFF, Abschnitt 3) — und GANZ mitgeschrieben, nicht halb: Die echte
     -- Lesegrenze ist `is_women_only_verified()`, nicht nur das Flag am Profil
     -- (der Fehler aus Abschnitt 57).
     AND (
       a.women_only = false
       OR a.seller_id = auth.uid()
       OR public.is_women_only_verified()
     )
   GROUP BY s.auction_id;
$$;

REVOKE ALL ON FUNCTION public.get_saved_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_saved_counts(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_saved_counts(uuid[]) IS
  'Zahl der Merkungen je Artikel — nur die Summe, nie wer. Die Zeilen selbst '
  'bleiben durch berkat_saved_select_own privat. Frauen-Only-Schranke von Hand '
  'mitgeschrieben, weil RLS in SECURITY DEFINER nicht greift.';

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. Genau eine Signatur, kein `anon`:
--      SELECT pg_get_function_identity_arguments(p.oid),
--             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_darf
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname='public' AND p.proname='get_saved_counts';
--      -- erwartet: eine Zeile, anon_darf = false
--
-- 2. Sie gibt NUR Zahlen:
--      SELECT * FROM get_saved_counts(ARRAY['<artikel>']::uuid[]);
--      -- erwartet: zwei Spalten, listing_id und saves. Kein user_id.
--
-- 3. ⚠️ Die Frauen-Only-Probe — sie braucht ein WOZ-Regalangebot und ein Konto
--    ohne Freigabe (HANDOFF Abschnitt 56, Gruppe E; bis heute gibt es null
--    WOZ-Daten):
--      -- als NICHT freigegebenes Konto:
--      SELECT * FROM get_saved_counts(ARRAY['<woz-artikel>']::uuid[]);
--      -- erwartet: LEER. Kommt eine Zahl, verrät sie die Existenz des Artikels.
-- ─────────────────────────────────────────────────────────────────────────────
