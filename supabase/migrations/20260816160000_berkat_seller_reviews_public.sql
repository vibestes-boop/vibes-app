-- Berkat: Bewertungstexte auf dem Verkäufer-Profil
--
-- WARUM ES BISHER NUR EINE ZAHL GAB
-- `order_reviews` gehört Serlo, und die einzige Lese-Policy heißt
-- `order_reviews_party_read`: `auth.uid() = reviewer_id OR auth.uid() =
-- reviewee_id`. Ein Dritter bekommt **null Zeilen — ohne Fehler**. Genau diese
-- Falle steht in HANDOFF 3 („Geerbte Serlo-Tabellen sind enger, als sie
-- aussehen"): Die Abfrage ist syntaktisch richtig, das Recht fehlt, PostgREST
-- antwortet mit einer leeren Menge, und man sucht den Fehler im Client.
--
-- Deshalb gab es seit dem 15.08. `get_seller_rating` — nur Schnitt und Anzahl.
-- Ein Durchschnitt identifiziert niemanden und ist deshalb unproblematisch.
--
-- Ein TEXT ist etwas anderes: Er trägt den Namen dessen, der ihn geschrieben
-- hat, und damit die Auskunft „diese Person hat bei jenem gekauft". Genau davor
-- warnt der Kommentar an der alten Migration: „Ein `USING(true)` hätte jeden
-- Kommentar und jede Käufer-Verkäufer-Beziehung freigegeben."
--
-- Die Policy bleibt deshalb unangetastet. Diese Funktion gibt gezielt und
-- gefiltert heraus, was ein Schaufenster braucht — nicht mehr.
--
-- ⚠️ ZWEI SCHRANKEN, BEIDE ABSICHTLICH ENG
--
-- 1. NUR BERKAT-BESTELLUNGEN (`cart_id IS NOT NULL`).
--    `order_reviews` enthält auch Serlos Shop-Bewertungen. Die durch eine
--    Berkat-Änderung neu öffentlich zu machen, wäre eine Verhaltensänderung an
--    einem laufenden Produkt mit echten Nutzern — dieselbe Linie, aus der
--    `notify_order_shipped` auf Berkat begrenzt wurde. Wer Serlos Texte
--    veröffentlichen will, tut das in einer eigenen Änderung mit eigener
--    Abwägung.
--
--    Folge, bewusst in Kauf genommen: `get_seller_rating` zählt weiterhin ALLE
--    Bewertungen (auch Serlo), diese Liste zeigt nur Berkat-Texte. Die Zahl in
--    der Kachel ist also größer als die Liste darunter. Das fällt nicht auf,
--    weil `comment` ohnehin optional ist und die Liste immer kürzer wäre.
--
-- 2. FRAUEN-ONLY BLEIBT GESCHLOSSEN.
--    Kam die Bestellung aus einem Frauen-Only-Kontext, verrät der Name der
--    Käuferin ihre Teilnahme daran. Ob eine VERKÄUFERIN Frauen-Only sendet, ist
--    öffentlich (die Show-Karte trägt das Abzeichen) — wer bei ihr kauft, ist
--    es nicht und soll es nicht werden. Das ist der kulturelle Kernvorteil der
--    App; ihn für ein Schaufenster aufzuweichen wäre der teuerste Tausch, den
--    Berkat machen könnte.
--
--    Solche Bewertungen sind sichtbar für: geprüfte Frauen
--    (`is_women_only_verified()`), den bewerteten Verkäufer selbst und die
--    Verfasserin. Für alle anderen fallen sie aus der Liste — sie zählen aber
--    weiter im Schnitt, denn ein Durchschnitt nennt keinen Namen.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_seller_reviews(
  p_seller_id uuid,
  p_limit     integer DEFAULT 20
)
RETURNS TABLE(
  id             uuid,
  rating         integer,
  comment        text,
  created_at     timestamptz,
  reviewer_id    uuid,
  reviewer_name  text,
  reviewer_avatar text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id,
         r.rating,
         r.comment,
         r.created_at,
         r.reviewer_id,
         p.username,
         p.avatar_url
    FROM public.order_reviews r
    JOIN public.product_orders o ON o.id = r.order_id
    LEFT JOIN public.profiles  p ON p.id = r.reviewer_id
   WHERE r.reviewee_id   = p_seller_id
     AND r.reviewer_role = 'buyer'
     AND r.rating IS NOT NULL
     -- Ein Eintrag ohne Text ist in einer Textliste nichts wert; die Zahl
     -- dazu steht ohnehin schon in der Kachel darüber.
     AND btrim(coalesce(r.comment, '')) <> ''
     -- Schranke 1: Berkat-Weiche, dieselbe wie in create-checkout-session
     -- und notify_order_shipped.
     AND o.cart_id IS NOT NULL
     -- Schranke 2: Frauen-Only.
     AND (
       NOT EXISTS (
         SELECT 1
           FROM public.live_auctions a
          WHERE a.cart_id = o.cart_id
            AND (
              a.women_only
              OR EXISTS (
                SELECT 1 FROM public.live_sessions s
                 WHERE s.id = a.session_id AND s.women_only
              )
            )
       )
       OR auth.uid() = p_seller_id
       OR auth.uid() = r.reviewer_id
       OR public.is_women_only_verified()
     )
   ORDER BY r.created_at DESC
   LIMIT LEAST(GREATEST(coalesce(p_limit, 20), 1), 50);
$$;

-- Ohne Konto lesbar: Das Profil ist das Schaufenster, und wer noch nicht
-- angemeldet ist, entscheidet gerade, ob er es wird. `is_women_only_verified()`
-- liefert für `anon` false, die zweite Schranke greift also ohne Zutun.
REVOKE ALL ON FUNCTION public.get_seller_reviews(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_reviews(uuid, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.get_seller_reviews(uuid, integer) IS
  'Berkat: öffentliche Bewertungstexte eines Verkäufers. Nur Berkat-Bestellungen, Frauen-Only nur für Verifizierte.';

COMMIT;

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- Ohne Anmeldung aufrufen und prüfen, dass KEINE Frauen-Only-Bewertung dabei
-- ist. Die Zeile, die es beweist, findet man so:
--
--   SELECT r.id, o.cart_id
--     FROM order_reviews r
--     JOIN product_orders o ON o.id = r.order_id
--    WHERE EXISTS (SELECT 1 FROM live_auctions a
--                   WHERE a.cart_id = o.cart_id AND a.women_only);
--
-- Kommt dort etwas heraus, muss dieselbe id im anonymen RPC-Aufruf FEHLEN.
--
-- ─── Was bewusst NICHT drin ist ──────────────────────────────────────────────
-- • **Keine Verkäufer-über-Käufer-Bewertungen.** `reviewer_role = 'buyer'` ist
--   fest. Die Gegenrichtung existiert in der Tabelle, gehört aber nicht auf ein
--   öffentliches Verkäufer-Profil.
-- • **Keine Antwortfunktion.** Whatnot lässt Verkäufer auf Bewertungen
--   antworten. Das braucht eine eigene Spalte, eine eigene Moderationsfrage
--   („was, wenn die Antwort beleidigt?") und gehört nicht in dieselbe Änderung.
-- • **Kein Melden einzelner Bewertungen.** Dasselbe: eigener Fluss, eigene
--   Tabelle. Heute geht Melden über den ganzen Nutzer (`user_reports`).
