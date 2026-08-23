-- Der Sammelkorb hatte einen Wettlauf, und der Geldweg hatte keine Schranke
-- ============================================================================
--
-- Zwei bestätigte Funde aus dem Audit (Übergabe 73), beide auf dem Geldweg:
--
--   • „`ensure_auction_cart` sperrt nicht" — `SELECT … WHERE status='open'`
--     ohne `FOR UPDATE`.
--   • „Die ZAG-Schranke steht an einem von vier Geldwegen" — `checkout_enabled`
--     wird genau einmal gelesen, im Sofortkauf.
--
-- ── 1 · Der Wettlauf im Korb ────────────────────────────────────────────────
--
-- Gemessen am Abzug: Die Funktion sucht den offenen Korb ohne Sperre und legt
-- sonst einen an. Daraus folgen ZWEI verschiedene Rennen, und `FOR UPDATE`
-- allein löst nur eines:
--
--   (a) Korb EXISTIERT. Zwischen Suchen und Zurückgeben kann
--       `checkout_auction_cart` ihn auf `checkout_pending` setzen. Der Zuschlag
--       hängt sich dann an einen Korb, der gerade zur Kasse getragen wird —
--       und dessen Betrag ist schon festgeschrieben. Das ist wörtlich der
--       Geldfehler vom 14.08.2026 zurück (Übergabe 4, „Der Korb friert beim
--       Gang zur Kasse ein"), nur über ein Zeitfenster statt über einen
--       fehlenden Zustand: **Ware im Korb, die niemand bezahlt hat.**
--       → `FOR UPDATE` sperrt die Zeile, bis die Transaktion durch ist.
--
--   (b) Korb EXISTIERT NICHT. Dann gibt es nichts zu sperren. Zwei Zuschläge
--       desselben Käufers beim selben Verkäufer im selben Augenblick laufen
--       beide in den INSERT, und der Partial-Index `auction_carts_one_open`
--       lässt genau einen durch. Der andere stirbt mit `23505` — und das
--       heisst in der App: **ein gewonnener Artikel landet in keinem Korb.**
--       → `ON CONFLICT DO NOTHING` plus Nachschlagen macht daraus den
--       Normalfall.
--
-- Wie wahrscheinlich ist (b)? Heute selten, in einer laufenden Show nicht:
-- Zwei Auktionen desselben Verkäufers laufen hintereinander, aber
-- `settle_live_auction` kann per Uhr feuern, während der Käufer parallel einen
-- Regal-Artikel sofortkauft. Genau dieser Fall trifft beide Aufrufer
-- gleichzeitig.
--
-- ── 2 · Die ZAG-Schranke stand am falschen Ende ─────────────────────────────
--
-- `checkout_enabled` ist die Erklärung „für diesen Verkäufer ist geklärt, dass
-- Geld über das Konto des Betreibers laufen darf". Ohne Stripe Connect ist die
-- Weiterleitung nach ZAG erlaubnispflichtig (Übergabe 20).
--
-- Gelesen wurde sie im ganzen Schema **einmal**: in `buy_now_live_auction` —
-- und dort ausdrücklich NUR für Regal-Artikel (`session_id IS NULL`), mit dem
-- Kommentar „dieser Weg wird mit der Verkäufer-Aufnahme geregelt, nicht hier."
--
-- Damit lief der HAUPTweg ungeprüft: Live-Zuschlag → `ensure_auction_cart` →
-- `checkout_auction_cart` → Stripe. Und das Trinkgeld ebenso.
--
-- ⚠️ WO DIE SCHRANKE HINGEHÖRT — und wo bewusst nicht:
--
--   ✅ `checkout_auction_cart`  — hier entsteht die Bestellung, aus der die
--                                 Stripe-Sitzung wird. Der letzte Punkt, an
--                                 dem sich das Geld noch aufhalten lässt.
--   ✅ `create_berkat_tip`      — der zweite echte Geldweg.
--   ❌ `settle_live_auction`    — ein Zuschlag bewegt kein Geld. Die Schranke
--                                 dort würde den KÄUFER für ein Versäumnis
--                                 des Verkäufers bestrafen: gewonnen, und
--                                 dann kein Korb.
--   ❌ `create_live_auction`    — ein Verkäufer ohne Kassen-Freigabe DARF
--                                 senden und versteigern; sein Käufer bekommt
--                                 „Nachricht" statt „Kaufen". Das ist das
--                                 gebaute Modell (Übergabe 20, „Kontakt statt
--                                 Kasse"), keine Lücke.
--
-- Der Preis dieser Trennung ist ehrlich zu benennen: Ein Käufer kann eine
-- Auktion gewinnen und erst an der Kasse erfahren, dass er nicht zahlen kann.
-- Die Übergabe nennt das „korrekt, aber tödlich". Der Fix dafür ist ein
-- HINWEIS im Live-Raum, kein weiterer Riegel — er steht im selben Zug.
--
-- ── Bauform ─────────────────────────────────────────────────────────────────
--
-- Alle drei Rümpfe sind MASCHINELL aus einem frischen Abzug übernommen und je
-- an genau einer Stelle ergänzt (`/tmp/gen_money.mjs`; bricht ab, wenn ein
-- Anker nicht genau einmal trifft, und zählt danach die CREATE-Zeilen).
-- `buy_now_live_auction` hat bei einer Neufassung schon einmal `buy_now_gone`,
-- den Eintrag in `live_bids`, `bid_count`, `ends_at` und den Rückgabewert
-- verloren (Übergaben 20, 22, 24).
--
-- Gleiche Signaturen, also `CREATE OR REPLACE` statt DROP+CREATE: kein
-- Rechte-Verlust, keine zweite Überladung, kein HTTP 300.

CREATE OR REPLACE FUNCTION "public"."ensure_auction_cart"("p_buyer_id" "uuid", "p_seller_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cart_id uuid;
BEGIN
  -- Abgelaufene Körbe erst schließen, sonst kollidiert der Unique-Index.
  UPDATE public.auction_carts
     SET status = 'expired'
   WHERE buyer_id = p_buyer_id
     AND seller_id = p_seller_id
     AND status = 'open'
     AND closes_at <= now();

  -- ⚠️ `FOR UPDATE` — der offene Korb darf zwischen Suchen und Zurückgeben
  -- nicht wegkippen. Ohne die Sperre kann `checkout_auction_cart` ihn
  -- parallel einfrieren, und der Zuschlag hängt sich an einen Korb, der
  -- gerade zur Kasse getragen wird: bezahlte Ware ohne Bezahlung.
  SELECT id INTO v_cart_id
    FROM public.auction_carts
   WHERE buyer_id = p_buyer_id
     AND seller_id = p_seller_id
     AND status = 'open'
   LIMIT 1
     FOR UPDATE;

  IF v_cart_id IS NOT NULL THEN
    RETURN v_cart_id;
  END IF;

  -- ⚠️ Und der zweite Wettlauf, den `FOR UPDATE` NICHT abdeckt: Findet die
  -- Abfrage nichts, gibt es keine Zeile, die man sperren könnte. Zwei
  -- gleichzeitige Zuschläge desselben Käufers beim selben Verkäufer laufen
  -- dann beide hierher — und der Partial-Index `auction_carts_one_open`
  -- lässt nur einen durch. Der andere stirbt mit `23505`, und das heisst in
  -- der App: **ein gewonnener Artikel landet in keinem Korb.**
  --
  -- `ON CONFLICT DO NOTHING` macht daraus den Normalfall statt eines Fehlers.
  -- Kommt nichts zurück, hat der andere gewonnen — dann seinen Korb holen.
  INSERT INTO public.auction_carts (buyer_id, seller_id)
  VALUES (p_buyer_id, p_seller_id)
  ON CONFLICT (buyer_id, seller_id) WHERE status = 'open' DO NOTHING
  RETURNING id INTO v_cart_id;

  IF v_cart_id IS NULL THEN
    SELECT id INTO v_cart_id
      FROM public.auction_carts
     WHERE buyer_id = p_buyer_id
       AND seller_id = p_seller_id
       AND status = 'open'
     LIMIT 1
       FOR UPDATE;
  END IF;

  IF v_cart_id IS NULL THEN
    -- Kann nur eintreten, wenn der Korb im selben Augenblick geschlossen
    -- wurde. Ehrlich scheitern statt NULL zurückzugeben — der Aufrufer
    -- schreibt die `cart_id` sonst als NULL an den Zuschlag.
    RAISE EXCEPTION 'cart_race' USING ERRCODE = '40001';
  END IF;

  RETURN v_cart_id;
END $$;

CREATE OR REPLACE FUNCTION "public"."checkout_auction_cart"("p_cart_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  c           public.auction_carts;
  v_uid       uuid := auth.uid();
  v_total     bigint;
  v_items     int;
  v_title     text;
  v_order_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.auction_carts WHERE id = p_cart_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cart_not_found' USING ERRCODE = '22023';
  END IF;
  IF c.buyer_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Idempotenz VOR der Zustandsprüfung. Ein Korb in der Kasse ist nicht mehr
  -- `open`; wer eine abgebrochene Zahlung nachholt, muss trotzdem wieder zu
  -- seiner Bestellung finden.
  SELECT id INTO v_order_id
    FROM public.product_orders
   WHERE cart_id = p_cart_id AND status = 'payment_requested'
   LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  IF c.status <> 'open' THEN
    RAISE EXCEPTION 'cart_closed' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ DIE ZAG-SCHRANKE — hier fehlte sie bis zum 23.08.2026.
  --
  -- `checkout_enabled` wurde im ganzen Schema genau EINMAL gelesen: in
  -- `buy_now_live_auction`, und dort nur für Regal-Artikel
  -- (`session_id IS NULL`). Der Weg über den Sammelkorb — also der
  -- HAUPTweg, jeder Live-Zuschlag — lief völlig ungeprüft in die
  -- Stripe-Sitzung.
  --
  -- Warum das eine erlaubnisrechtliche Frage ist und keine Produktfrage:
  -- Das Geld landet auf dem Konto des Betreibers und müsste von dort an den
  -- Verkäufer weiter. Genau das ist nach ZAG erlaubnispflichtig, solange es
  -- kein Stripe Connect gibt (Übergabe 20). `checkout_enabled` ist die
  -- Erklärung „für diesen Verkäufer ist das geklärt".
  --
  -- `IS DISTINCT FROM true` statt `IS NOT NULL AND = false`: Damit fällt
  -- auch „keine Zeile" auf gesperrt. Wer hier wieder ein `IS NOT NULL`
  -- einbaut, macht aus einer Schranke eine Vermutung — die Lehre aus
  -- `20260817120000`.
  --
  -- ⚠️ Der Riegel steht NACH der Idempotenz-Abfrage. Wer schon eine
  -- Bestellung hat, kommt weiterhin zu ihr zurück, auch wenn dem Verkäufer
  -- die Freigabe zwischenzeitlich entzogen wurde. Eine begonnene Zahlung
  -- abzuschneiden würde den Käufer stranden lassen, ohne irgendetwas zu
  -- schützen — die Verpflichtung besteht dann bereits.
  -- Eine Unterabfrage ohne Treffer liefert NULL, und `NULL IS DISTINCT FROM
  -- true` ist wahr — „keine Zeile" fällt damit ohne Zusatzprüfung auf
  -- gesperrt. Ein zusätzliches `EXISTS` daneben läse sich wie zwei
  -- Bedingungen und wäre eine davon zu viel.
  IF (
    SELECT s.checkout_enabled FROM public.berkat_sellers s
     WHERE s.user_id = c.seller_id
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'contact_seller' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(current_bid_cents), 0), COUNT(*)
    INTO v_total, v_items
    FROM public.live_auctions
   WHERE cart_id = p_cart_id AND status = 'sold';

  IF v_items = 0 OR v_total <= 0 THEN
    RAISE EXCEPTION 'cart_empty' USING ERRCODE = '22023';
  END IF;

  SELECT CASE
           WHEN v_items = 1 THEN MIN(title)
           ELSE format('%s Artikel aus der Live-Show', v_items)
         END
    INTO v_title
    FROM public.live_auctions
   WHERE cart_id = p_cart_id AND status = 'sold';

  INSERT INTO public.product_orders (
    buyer_id, seller_id, product_id, cart_id, title,
    quantity, unit_price_eur, amount_eur, currency, status, payment_requested_at
  ) VALUES (
    v_uid, c.seller_id, NULL, p_cart_id, v_title,
    1, (v_total::numeric / 100), (v_total::numeric / 100), 'eur',
    'payment_requested', now()
  )
  RETURNING id INTO v_order_id;

  -- Ab hier nimmt dieser Korb nichts mehr auf. Was danach gewonnen wird,
  -- landet in einem frischen Korb und wird eine eigene Bestellung.
  UPDATE public.auction_carts
     SET status = 'checkout_pending'
   WHERE id = p_cart_id;

  RETURN v_order_id;
END $$;

CREATE OR REPLACE FUNCTION "public"."create_berkat_tip"("p_recipient_id" "uuid", "p_amount_cents" integer, "p_message" "text" DEFAULT NULL::"text", "p_session_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_id     uuid;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_recipient_id IS NULL THEN
    RAISE EXCEPTION 'recipient_missing' USING ERRCODE = '22023';
  END IF;
  IF p_recipient_id = v_sender THEN
    RAISE EXCEPTION 'cannot_tip_self' USING ERRCODE = '22023';
  END IF;
  -- Die Grenzen stehen zusätzlich im CHECK. Hier für eine Fehlermeldung, die
  -- der Client übersetzen kann, statt einer nackten Constraint-Verletzung.
  IF p_amount_cents IS NULL OR p_amount_cents < 100 OR p_amount_cents > 50000 THEN
    RAISE EXCEPTION 'amount_out_of_range' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RAISE EXCEPTION 'recipient_not_found' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ DIESELBE ZAG-SCHRANKE WIE AN DER KASSE.
  --
  -- Ein Trinkgeld ist der zweite Weg, auf dem echtes Geld über das Konto des
  -- Betreibers an einen Dritten fliesst — und er hatte bis zum 23.08.2026
  -- gar keine Prüfung. Der Betrag ist kleiner als bei einem Kauf, die
  -- Rechtslage ist dieselbe: weitergeleitetes Geld ist weitergeleitetes Geld.
  --
  -- `IS DISTINCT FROM true`, also „keine Zeile" = gesperrt (siehe oben).
  IF (
    SELECT s.checkout_enabled FROM public.berkat_sellers s
     WHERE s.user_id = p_recipient_id
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'contact_seller' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.berkat_tips (sender_id, recipient_id, session_id, amount_cents, message)
  VALUES (v_sender, p_recipient_id, p_session_id, p_amount_cents, nullif(btrim(p_message), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Je genau eine Signatur, kein HTTP 300. Erwartet: drei Zeilen mit 1.
--
--      SELECT p.proname, count(*)
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public'
--         AND p.proname IN ('ensure_auction_cart','checkout_auction_cart','create_berkat_tip')
--       GROUP BY p.proname;
--
-- 2) Die Ergänzungen stehen wirklich im Live-Code, nicht nur in dieser Datei:
--
--      SELECT proname,
--             prosrc LIKE '%FOR UPDATE%'         AS sperrt,
--             prosrc LIKE '%ON CONFLICT%'        AS faengt_rennen,
--             prosrc LIKE '%checkout_enabled%'   AS zag
--        FROM pg_proc
--       WHERE proname IN ('ensure_auction_cart','checkout_auction_cart','create_berkat_tip');
--
--    Erwartet: ensure_auction_cart   sperrt=t  faengt_rennen=t  zag=f
--              checkout_auction_cart sperrt=t  faengt_rennen=f  zag=t
--              create_berkat_tip     sperrt=f  faengt_rennen=f  zag=t
--
-- 3) Rechte unverändert — keine der drei darf an `anon` gehen. Erwartet: f.
--
--      SELECT has_function_privilege('anon', p.oid, 'EXECUTE')
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public'
--         AND p.proname IN ('ensure_auction_cart','checkout_auction_cart','create_berkat_tip');
--
--    ⚠️ `has_function_privilege` und NICHT „steht `TO anon` im Abzug" — das
--    ist die Lehre aus `20260822190000`: `EXECUTE` gehört bei Funktionen von
--    Haus aus PUBLIC, und `pg_dump` schreibt den Standard nicht aus.
--
-- 4) ⚠️ DIE WICHTIGSTE, und sie ist eine BESTANDSAUFNAHME, kein Test:
--    Wer hat heute eine Kassen-Freigabe? Jeder Verkäufer, der hier NICHT
--    steht, kann ab sofort nicht mehr über die Plattform bezahlt werden.
--
--      SELECT p.username, s.kind, s.checkout_enabled
--        FROM public.berkat_sellers s
--        JOIN public.profiles p ON p.id = s.user_id
--       ORDER BY s.checkout_enabled DESC NULLS LAST;
--
--    Stand 23.08.2026 erwartet: GENAU EINE Zeile mit `true` (der Betreiber,
--    aus dem Bestandsschutz von `20260817120000`). Steht dort keine, ist der
--    eigene Kaufweg gerade zugefallen — dann ist etwas anderes passiert als
--    diese Migration.
--
-- 5) Der Wettlauf in (b) lässt sich nicht bequem herstellen. Was sich prüfen
--    lässt: Ein zweiter Aufruf auf denselben Korb muss DENSELBEN zurückgeben.
--
--      SELECT public.ensure_auction_cart('<käufer>', '<verkäufer>')
--           = public.ensure_auction_cart('<käufer>', '<verkäufer>');   -- t
--
-- 6) Am Gerät (Prüfliste B1): Nach der Kassen-Freigabe für den gewerblichen
--    Testverkäufer muss der Kaufknopf erscheinen UND durchlaufen. Vorher gab
--    es keine Schranke — jetzt gibt es eine, und genau dieser Durchlauf zeigt,
--    dass sie den richtigen durchlässt.
