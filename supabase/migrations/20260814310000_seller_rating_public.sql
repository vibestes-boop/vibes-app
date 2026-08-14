-- Die Bewertung eines Verkäufers öffentlich lesbar machen — aber nur als Zahl.
--
-- BEFUND (14.08.2026, beim Bauen des Verkäufer-Sheets): `order_reviews` hat
-- genau eine Policy:
--
--     order_reviews_party_read  FOR SELECT
--       USING (auth.uid() = reviewer_id OR auth.uid() = reviewee_id)
--
-- Das ist für die einzelne Bewertung richtig: Was ein Käufer über einen
-- Verkäufer geschrieben hat, geht Dritte nichts an. Es macht die Sterne aber
-- unbrauchbar — ein Zuschauer, der im Live-Raum auf den Kopf des Verkäufers
-- tippt, ist WEDER reviewer NOCH reviewee und bekommt null Zeilen zurück. Die
-- Kachel stünde dauerhaft auf „—", auch bei fünfzig Bewertungen. Und genau
-- diese Zahl ist der Grund, warum jemand einem Fremden Geld schickt.
--
-- LÖSUNG: Nicht die Policy aufweichen, sondern eine Funktion, die ausschließlich
-- das AGGREGAT herausgibt. Schnitt und Anzahl verraten nichts darüber, wer was
-- geschrieben hat; die Texte und die Namen bleiben hinter der bestehenden
-- Policy. Wer die Policy stattdessen auf USING(true) setzte, gäbe jeden
-- Kommentar und jede Käufer-Verkäufer-Beziehung frei — und hätte nebenbei genau
-- den Fehler wiederholt, der am 16.07.2026 auf live_sessions gefunden wurde.
--
-- Nur `reviewer_role = 'buyer'`: Was ein Verkäufer über seine Käufer sagt,
-- gehört nicht in seine eigene Verkäufer-Bewertung.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_seller_rating(p_seller_id uuid)
RETURNS TABLE (rating numeric, review_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    round(avg(r.rating)::numeric, 2) AS rating,
    count(*)::int                    AS review_count
  FROM public.order_reviews r
  WHERE r.reviewee_id = p_seller_id
    AND r.reviewer_role = 'buyer'
    AND r.rating IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_seller_rating(uuid) IS
  'Öffentliches Aggregat der Käufer-Bewertungen eines Verkäufers. Gibt bewusst '
  'NUR Schnitt und Anzahl heraus — die einzelnen Bewertungen bleiben hinter '
  'order_reviews_party_read.';

-- Rechte ausdrücklich. Anonyme dürfen mitlesen: Die Zahl steht auf der
-- öffentlichen Verkäufer-Seite, und die soll auch ohne Anmeldung etwas taugen.
REVOKE ALL ON FUNCTION public.get_seller_rating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_rating(uuid) TO anon, authenticated;

COMMIT;

-- ─── Was diese Migration NICHT tut ───────────────────────────────────────────
-- Sie ändert `order_reviews_party_read` nicht und legt keine INSERT-Policy an.
-- Geschrieben wird weiterhin ausschließlich über `submit_order_review`
-- (SECURITY DEFINER, prüft Käufer/Verkäufer und verlangt status='delivered').
-- Berkat rief diese RPC bis zum 14.08.2026 nur nie auf — das ist Client-Arbeit,
-- keine Server-Lücke.
