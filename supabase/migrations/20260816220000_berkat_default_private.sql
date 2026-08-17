-- Wer nichts erklärt, verkauft privat — und das wird auch so festgehalten
--
-- WAS SCHIEFLIEF
-- Der Composer zeigt „Du verkaufst als: Privatperson" als Vorgabe an, samt dem
-- Satz, was das für den Käufer bedeutet. Der Knopf ruft die Erklärungs-RPC aber
-- nur, wenn sich der Typ ÄNDERT — wer die Vorgabe stehen lässt (also der
-- Normalfall), erzeugt keine Zeile in `berkat_sellers`.
--
-- Ergebnis: `create_standing_listing` fand nichts, stempelte `seller_kind` auf
-- NULL, und am Angebot stand keine Anbieterkennzeichnung. Die Oberfläche zeigte
-- damit eine Angabe, die die Datenbank nicht hatte — und ausgerechnet die, die
-- Art. 246d § 1 EGBGB an jedem Angebot verlangt.
--
-- WARUM DIE VORGABE SERVERSEITIG FESTGEHALTEN WIRD
-- Der Verkäufer hat die Angabe gesehen: Sie steht direkt über dem Knopf, mit
-- der Folge daneben („kein Widerrufsrecht"). Wer darauf drückt, erklärt sie —
-- eine Vorgabe anzuzeigen und etwas anderes zu speichern wäre der schlechtere
-- Weg von beiden.
--
-- „Privat" ist dabei die richtige Vorgabe und nicht die bequeme:
-- Unternehmereigenschaft nach § 14 BGB muss man annehmen, nicht unterstellen.
-- Wer gewerblich ist, tippt einmal auf den anderen Knopf.
--
-- ⚠️ WIEDER ALLE SIGNATUREN, nicht nur die letzte — sonst ist die Datei beim
-- zweiten Lauf kaputt und lässt eine Altfassung im Katalog stehen (HTTP 300).

BEGIN;

DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean, text);
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean, text, text, text, text, text);

CREATE FUNCTION public.create_standing_listing(
  p_title       text,
  p_price_cents integer,
  p_image_url   text DEFAULT NULL,
  p_women_only  boolean DEFAULT false,
  p_category    text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_condition   text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_city        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_kind text;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_price_cents IS NULL OR p_price_cents <= 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;
  IF p_women_only AND NOT public.is_women_only_verified() THEN
    RAISE EXCEPTION 'not_women_only_verified' USING ERRCODE = '42501';
  END IF;
  IF p_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.berkat_categories WHERE slug = p_category AND active
  ) THEN
    RAISE EXCEPTION 'unknown_category' USING ERRCODE = '22023';
  END IF;

  -- Die eine geänderte Stelle: Fehlt die Zeile, entsteht sie mit der Vorgabe,
  -- die im Formular stand. `ON CONFLICT DO NOTHING` statt eines UPDATE — wer
  -- sich schon als gewerblich erklärt hat, wird durch ein weiteres Angebot
  -- nicht stillschweigend zurückgestuft.
  --
  -- `checkout_enabled` bleibt bei seiner Vorgabe `false`: Eine neu entstandene
  -- Zeile darf keine Kassen-Freigabe erzeugen, sonst höbe genau dieser Weg die
  -- ZAG-Schranke aus.
  INSERT INTO public.berkat_sellers (user_id, kind)
  VALUES (v_uid, 'private')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT kind INTO v_kind FROM public.berkat_sellers WHERE user_id = v_uid;

  INSERT INTO public.live_auctions (
    session_id, seller_id, title, image_url,
    start_price_cents, buy_now_cents, status, women_only, category,
    description, condition, postal_code, city, seller_kind
  ) VALUES (
    NULL, v_uid, btrim(p_title), NULLIF(btrim(coalesce(p_image_url, '')), ''),
    100, p_price_cents, 'listed', coalesce(p_women_only, false), p_category,
    NULLIF(btrim(coalesce(p_description, '')), ''),
    NULLIF(btrim(coalesce(p_condition, '')), ''),
    NULLIF(btrim(coalesce(p_postal_code, '')), ''),
    NULLIF(btrim(coalesce(p_city, '')), ''),
    v_kind
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_standing_listing(text, integer, text, boolean, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_standing_listing(text, integer, text, boolean, text, text, text, text, text)
  TO authenticated;

-- Die zwei Angebote, die vor dieser Migration entstanden sind, tragen weiter
-- NULL. Bewusst KEIN Backfill: Sie stammen aus Testläufen des Betreibers, und
-- eine Kennzeichnung rückwirkend zu setzen hieße, eine Erklärung zu erfinden,
-- die niemand abgegeben hat. Die Oberfläche zeigt bei NULL schlicht nichts.

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- 1. Weiterhin GENAU EINE Fassung:
--      SELECT oid::regprocedure FROM pg_proc WHERE proname = 'create_standing_listing';
--
-- 2. Ein neues Angebot von einem Konto ohne Zeile in `berkat_sellers` erzeugt
--    beides: die Zeile mit kind='private' UND `seller_kind='private'` am
--    Angebot. In der App muss danach „Privatverkauf" unter dem Preis stehen.
--
-- 3. Ein Konto, das sich als gewerblich erklärt hat, bleibt gewerblich:
--    Nach einem weiteren Angebot ist `kind` weiterhin 'business'.
