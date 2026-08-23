-- Versand in Stufen — ein Kopftuch kostet keinen Paketpreis
-- ============================================================================
--
-- Aus der neunten Whatnot-Analyse (Übergabe 54, Punkt 6): Whatnot DE weist
-- offen aus — Brief 20 g **1,19 €** · Brief 500 g 2,25 € · Paket 1 kg 4,10 € ·
-- 2 kg 6,17 € — und benennt die Profile als **Gegenstände** statt als Gramm
-- („Artikel in Grösse M, z. B. Jeans"). Berkat kannte eine Pauschale pro Zone.
--
-- Warum das bei dieser Ware entscheidet: Bei 6-€-Secondhand ist der
-- Versandpreis der halbe Kaufpreis. Zwischen 1,19 € und einer Paketpauschale
-- liegt bei einem Kopftuch der Unterschied zwischen kaufbar und unverkäuflich.
--
-- ⚠️ DIE ÜBERGABE SAGTE „ES SIND ZEILEN, KEIN UMBAU". DAS STIMMT NICHT.
--
-- Zweimal nachgemessen, beide Male am Abzug:
--
--   1. `get_cart_shipping_options` wählt mit `SELECT DISTINCT ON (r.country)`
--      **genau eine** Zeile je Land. Zusätzliche Stufen wären eingetragen und
--      unsichtbar — dieselbe Klasse wie `description`, die zwei Tage lang
--      geschrieben und nie gelesen wurde (Übergabe 3).
--
--   2. **Stripe Checkout erlaubt höchstens FÜNF Versandoptionen.** Drei Länder
--      mal vier Stufen wären zwölf. Die Stufen als Auswahl anzubieten geht
--      also gar nicht — die Kasse würde beim Öffnen scheitern.
--
-- ── DER ENTWURF, DER DARAUS FOLGT ───────────────────────────────────────────
--
-- **Die Stufe gehört zum ARTIKEL, nicht zur Auswahl des Käufers.** Genau so
-- macht es Whatnot auch: Der Verkäufer wählt beim Einstellen ein Profil, der
-- Käufer sieht nur einen Preis. Die Kasse zeigt weiterhin drei Optionen (eine
-- je Land), nur ist ihr Betrag jetzt von der Ware abhängig.
--
-- Nebenbei entschärft das einen alten Befund: Abschnitt 14 hält fest, dass die
-- ZONE nicht erzwingbar ist, weil Stripe die Optionen nicht ans Lieferland
-- bindet. Die STUFE ist es jetzt sehr wohl — sie steht am Artikel und wird
-- nicht angeboten, sondern gerechnet.
--
-- ── Was hier NICHT erfunden wird ────────────────────────────────────────────
--
-- ⚠️ Die vier DE-Beträge unten sind Whatnots veröffentlichte deutsche Sätze
-- (Analyse 9), also ein Marktbeleg — **keine geprüfte Kalkulation von Berkats
-- eigenen Portokosten.** Vor dem Echtbetrieb gegen die tatsächlichen Preise
-- von DHL/Deutsche Post halten. Die höchste Stufe steht bewusst auf den
-- heutigen **4,90 €** und nicht auf Whatnots 6,17 €: Ein Versand, der über
-- Nacht teurer wird, ist eine Preiserhöhung und keine Verbesserung.
--
-- ⚠️ Für AT und CH bleibt es bei **einer** Pauschale. Belastbare
-- Auslandsstufen habe ich nicht, und erfundene Portopreise sind schlimmer als
-- gar keine — die Auswahlregel unten trägt Länder mit nur einer Stufe ohne
-- Sonderfall. Wer sie ergänzt, trägt Zeilen nach, sonst nichts.

-- ── 1 · Die Stufe am Satz ───────────────────────────────────────────────────

ALTER TABLE public.berkat_shipping_rates
  ADD COLUMN IF NOT EXISTS tier smallint NOT NULL DEFAULT 4;

-- 1 = kleiner Brief … 4 = grosses Paket. Bewusst eine Zahl und kein Text:
-- Die Reihenfolge IST die Bedeutung („reicht diese Stufe für den Korb?"), und
-- eine Textspalte müsste dafür erst übersetzt werden.
ALTER TABLE public.berkat_shipping_rates
  DROP CONSTRAINT IF EXISTS berkat_shipping_rates_tier_check;
ALTER TABLE public.berkat_shipping_rates
  ADD CONSTRAINT berkat_shipping_rates_tier_check CHECK (tier BETWEEN 1 AND 4);

-- Je Verkäufer, Land und Stufe genau ein Satz. Ohne das läge bei zwei Zeilen
-- derselben Stufe die Auswahl beim Zufall.
-- ⚠️ `COALESCE` statt `seller_id`, weil NULL in einem UNIQUE nicht mit NULL
-- kollidiert — die Plattform-Vorgaben (alle `seller_id IS NULL`) wären sonst
-- ungeschützt.
CREATE UNIQUE INDEX IF NOT EXISTS berkat_shipping_rates_one_per_tier
  ON public.berkat_shipping_rates
     (COALESCE(seller_id, '00000000-0000-0000-0000-000000000000'::uuid), country, tier);

-- ── 2 · Die Stufe am Artikel ────────────────────────────────────────────────
--
-- NULL heisst „nicht angegeben" und wird beim Rechnen als 4 gelesen (siehe
-- unten). Bewusst NICHT `DEFAULT 4`: Der Unterschied zwischen „der Verkäufer
-- hat sich für Paket entschieden" und „er hat nichts gesagt" ist genau der,
-- den die Oberfläche zeigen muss — und ein Default hätte ihn eingeebnet.
-- Dieselbe Lehre wie bei der Anbieterkennzeichnung (Übergabe 3, „Eine Vorgabe
-- anzeigen und nicht speichern").
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS shipping_tier smallint;

ALTER TABLE public.live_auctions
  DROP CONSTRAINT IF EXISTS live_auctions_shipping_tier_check;
ALTER TABLE public.live_auctions
  ADD CONSTRAINT live_auctions_shipping_tier_check
    CHECK (shipping_tier IS NULL OR shipping_tier BETWEEN 1 AND 4);

-- ⚠️ Regel 11 GEPRÜFT, nicht angenommen: `live_auctions` trägt ein
-- TABELLEN-weites `GRANT SELECT … TO anon, authenticated` (Abzug Z. 28870/71).
-- Eine neue Spalte ist damit gedeckt, die sechs Spalten-GRANTs daneben sind
-- redundante Zugaben früherer Migrationen. Diese hier folgt der Hausform —
-- sie kostet nichts und hält den Abzug einheitlich.
GRANT SELECT (shipping_tier) ON public.live_auctions TO anon, authenticated;

-- ── 3 · Die Sätze ───────────────────────────────────────────────────────────
--
-- Die drei bestehenden Zeilen sind die höchste Stufe — sie bleiben, was sie
-- sind, und ändern keinen Preis.
UPDATE public.berkat_shipping_rates
   SET tier = 4
 WHERE seller_id IS NULL AND tier IS DISTINCT FROM 4;

-- Die drei neuen DE-Stufen. Beschriftet als GEGENSTAND, nicht als Gramm:
-- „bis 500 g" muss jeder Verkäufer erst schätzen, „Tuch, Shirt" nicht. Das ist
-- Whatnots eigentliche Erfindung an dieser Stelle, nicht die Staffelung.
INSERT INTO public.berkat_shipping_rates (seller_id, country, tier, label, cents, sort_index)
VALUES
  (NULL, 'DE', 1, 'Brief · Kopftuch, Schmuck, Kleinteil',      119, 1),
  (NULL, 'DE', 2, 'Grossbrief · Tuch, Shirt, dünne Kleidung',  225, 1),
  (NULL, 'DE', 3, 'Paket · Schuhe, Buch, Parfüm',              410, 1)
-- Ohne Inferenz-Spalten: Der Teil-Index oben ist ein AUSDRUCKS-Index
-- (`COALESCE(...)`), und die ON-CONFLICT-Inferenz müsste ihn zeichengenau
-- wiederholen. `DO NOTHING` ohne Ziel greift bei jedem Konflikt und macht die
-- Migration wiederholbar — darum geht es hier.
ON CONFLICT DO NOTHING;

-- ⚠️ `sort_index` spielt für die AUSWAHL ab jetzt keine Rolle mehr — sie läuft
-- über `tier`. Die Spalte bleibt für die Anzeige der Länder-Reihenfolge im
-- Verkäufer-Bildschirm. Wer sie wieder in eine Sortierung des Versands zieht,
-- baut eine zweite Wahrheit über dieselbe Frage.

-- ── 4 · Der Verkäufer sagt, was ein Artikel braucht ─────────────────────────
--
-- ⚠️ EIGENE RPC STATT EINES ZWÖLFTEN PARAMETERS an `create_standing_listing`.
--
-- Die Übergabe hält in Abschnitt 63 fest, warum: Die Funktion wird seit dem
-- 21.08. aus TestFlight gerufen. Ein zusätzlicher Parameter ist eine
-- Signatur-Änderung; behält man die alte Fassung daneben, macht die Überladung
-- PostgREST mehrdeutig (HTTP 300). Der Composer löst das schon einmal so — er
-- ruft `create_standing_listing` und danach `move_listing_to_show`.
--
-- Nebeneffekt, der die Entscheidung trägt: Die Stufe lässt sich damit später
-- ändern, ohne das ganze Angebot zu bearbeiten.
CREATE OR REPLACE FUNCTION public.set_listing_shipping_tier(
  p_auction_id uuid,
  p_tier       smallint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_seller uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_tier IS NOT NULL AND (p_tier < 1 OR p_tier > 4) THEN
    RAISE EXCEPTION 'bad_tier' USING ERRCODE = '22023';
  END IF;

  SELECT seller_id, status INTO v_seller, v_status
    FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;

  -- „Gibt es nicht" statt „gehört dir nicht": Die Antwort darf die Existenz
  -- eines fremden — womöglich Frauen-Only — Artikels nicht verraten. Dieselbe
  -- Sprache wie in `buy_now_live_auction` (Übergabe 20).
  IF v_seller IS NULL OR v_seller <> v_uid THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ Nach dem Zuschlag ist der Versandpreis Teil einer Abrechnung. Ihn dann
  -- noch zu ändern hiesse, den Betrag einer laufenden Bestellung zu bewegen.
  IF v_status IN ('sold', 'cancelled') THEN
    RAISE EXCEPTION 'listing_closed' USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_auctions SET shipping_tier = p_tier WHERE id = p_auction_id;
END $fn$;

REVOKE ALL ON FUNCTION public.set_listing_shipping_tier(uuid, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_listing_shipping_tier(uuid, smallint) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_listing_shipping_tier(uuid, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_listing_shipping_tier(uuid, smallint) TO service_role;

-- ── 5 · Die zwei Versand-Funktionen ─────────────────────────────────────────
--
-- Beide Rümpfe sind MASCHINELL aus einem frischen Abzug übernommen und je an
-- zwei Stellen ergänzt (`/tmp/gen_ship.mjs`; bricht ab, wenn ein Anker nicht
-- genau einmal trifft, und zählt danach CREATE-Zeilen, Dollar-Tags und
-- `v_tier`-Vorkommen).
--
-- ⚠️ ES SIND ZWEI, UND SIE MÜSSEN GLEICH BLEIBEN. `get_cart_shipping_options`
-- ist die STABLE-Schwester für die Anzeige, `…_for_checkout` schreibt zusätzlich
-- die Versand-Gutschrift fest. Wer eine ändert und die andere vergisst, zeigt
-- dem Käufer einen anderen Preis, als die Kasse verlangt.

CREATE OR REPLACE FUNCTION "public"."get_cart_shipping_options"("p_cart_id" "uuid") RETURNS TABLE("country" "text", "label" "text", "cents" integer, "free" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_seller uuid;
  v_goods  integer;
  v_tier   smallint;
BEGIN
  SELECT c.seller_id INTO v_seller
    FROM public.auction_carts c
   WHERE c.id = p_cart_id;

  IF v_seller IS NULL THEN
    RETURN;  -- kein Korb, keine Sätze — der Aufrufer entscheidet, was das heißt
  END IF;

  SELECT COALESCE(SUM(a.current_bid_cents), 0) INTO v_goods
    FROM public.live_auctions a
   WHERE a.cart_id = p_cart_id AND a.status = 'sold';

  -- ⚠️ DIE STUFE DES KORBS IST DIE HÖCHSTE SEINER ARTIKEL.
  -- Ein Kopftuch und ein Paar Schuhe gehen zusammen in EIN Paket — dann gilt
  -- der Paketpreis, nicht der Briefpreis. `COALESCE(…, 4)` innen und nicht
  -- aussen: Ein Artikel OHNE Angabe muss die höchste Stufe erzwingen, sonst
  -- verbilligt eine fehlende Angabe den Versand. Im Zweifel teurer für den
  -- Käufer ist hier richtig herum — die Alternative wäre, dass der Verkäufer
  -- draufzahlt, und der hat die Angabe nicht gemacht.
  SELECT COALESCE(MAX(COALESCE(a.shipping_tier, 4)), 4) INTO v_tier
    FROM public.live_auctions a
   WHERE a.cart_id = p_cart_id AND a.status = 'sold';

  RETURN QUERY
  SELECT DISTINCT ON (r.country)
         r.country,
         r.label,
         CASE WHEN r.free_from_cents IS NOT NULL AND v_goods >= r.free_from_cents
              THEN 0 ELSE r.cents END,
         (r.free_from_cents IS NOT NULL AND v_goods >= r.free_from_cents)
    FROM public.berkat_shipping_rates r
   WHERE r.seller_id = v_seller OR r.seller_id IS NULL
   -- Je Land GENAU EINE Zeile, sonst sprengt die Kasse Stripes Grenze von
   -- fünf Versandoptionen (3 Länder × 4 Stufen wären zwölf). Die Reihenfolge
   -- entscheidet, welche:
   --   1. der eigene Satz des Verkäufers schlägt die Vorgabe der Plattform
   --   2. Stufen, die ausreichen, vor solchen, die es nicht tun
   --   3. darunter die KLEINSTE ausreichende — und wenn keine ausreicht, die
   --      grösste vorhandene (daher das negative Vorzeichen)
   -- Damit trägt ein Land, für das nur eine Pauschale hinterlegt ist (AT, CH),
   -- weiterhin genau diese — ohne Sonderfall.
   ORDER BY r.country,
            (r.seller_id IS NULL),
            (r.tier < v_tier),
            CASE WHEN r.tier >= v_tier THEN r.tier ELSE -r.tier END;
END $$;

CREATE OR REPLACE FUNCTION "public"."get_cart_shipping_options_for_checkout"("p_cart_id" "uuid") RETURNS TABLE("country" "text", "label" "text", "cents" integer, "free" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_buyer  uuid;
  v_seller uuid;
  v_goods  integer;
  v_credit uuid;
  v_min    integer;
  v_tier   smallint;
BEGIN
  SELECT c.buyer_id, c.seller_id INTO v_buyer, v_seller
    FROM public.auction_carts c
   WHERE c.id = p_cart_id;

  IF v_seller IS NULL THEN
    RETURN;  -- kein Korb, keine Sätze — wie in der STABLE-Schwester
  END IF;

  -- Der Warenwert steht VOR der Gutschrift-Auswahl, weil er darüber
  -- mitentscheidet.
  SELECT COALESCE(SUM(a.current_bid_cents), 0) INTO v_goods
    FROM public.live_auctions a
   WHERE a.cart_id = p_cart_id AND a.status = 'sold';

  -- Hängt schon eine an diesem Korb? Dann die. Die Kasse darf für denselben
  -- Korb zweimal geöffnet werden (abgebrochene Zahlung, Idempotenz-Abfrage in
  -- `checkout_auction_cart`) — beim zweiten Mal darf das keine zweite
  -- Gutschrift kosten.
  SELECT id INTO v_credit
    FROM public.berkat_shipping_credits
   WHERE reserved_cart_id = p_cart_id AND consumed_at IS NULL
   LIMIT 1;

  -- ⚠️ MINDESTWARENWERT. Eine eingelöste Gutschrift kostet 4,83 € (Pauschale
  -- weg, Porto bleibt); die Verlustschwelle liegt bei 6,64 € Warenwert. Ohne
  -- diese Bedingung wäre der häufigste Fall genau der teuerste: Ein Neuer löst
  -- den Code ein und testet mit EINEM Artikel für 1 €. Rechnung im Kopf dieser
  -- Datei.
  --
  -- Bewusst KEINE Fehlermeldung, sondern schlicht keine Reservierung: Die
  -- Gutschrift bleibt dem Käufer erhalten und greift beim nächsten, größeren
  -- Korb. Eine Kasse, die sich wegen eines Bonus nicht öffnet, wäre der
  -- teuerste denkbare Tausch.
  SELECT min_cart_cents INTO v_min FROM public.berkat_reward_policy WHERE id = 1;

  IF v_credit IS NULL AND v_goods >= COALESCE(v_min, 1500) THEN
    UPDATE public.berkat_shipping_credits
       SET reserved_cart_id = p_cart_id
     WHERE id = (
       SELECT id FROM public.berkat_shipping_credits
        WHERE user_id = v_buyer
          AND consumed_at IS NULL
          AND reserved_cart_id IS NULL
        ORDER BY granted_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
    RETURNING id INTO v_credit;
  END IF;

  -- ⚠️ DIE STUFE DES KORBS IST DIE HÖCHSTE SEINER ARTIKEL.
  -- Ein Kopftuch und ein Paar Schuhe gehen zusammen in EIN Paket — dann gilt
  -- der Paketpreis, nicht der Briefpreis. `COALESCE(…, 4)` innen und nicht
  -- aussen: Ein Artikel OHNE Angabe muss die höchste Stufe erzwingen, sonst
  -- verbilligt eine fehlende Angabe den Versand. Im Zweifel teurer für den
  -- Käufer ist hier richtig herum — die Alternative wäre, dass der Verkäufer
  -- draufzahlt, und der hat die Angabe nicht gemacht.
  SELECT COALESCE(MAX(COALESCE(a.shipping_tier, 4)), 4) INTO v_tier
    FROM public.live_auctions a
   WHERE a.cart_id = p_cart_id AND a.status = 'sold';

  RETURN QUERY
  SELECT DISTINCT ON (r.country)
         r.country,
         CASE WHEN v_credit IS NOT NULL
              THEN r.label || ' · geschenkt (Einladung)'
              ELSE r.label END,
         CASE WHEN v_credit IS NOT NULL THEN 0
              WHEN r.free_from_cents IS NOT NULL AND v_goods >= r.free_from_cents THEN 0
              ELSE r.cents END,
         (v_credit IS NOT NULL)
           OR (r.free_from_cents IS NOT NULL AND v_goods >= r.free_from_cents)
    FROM public.berkat_shipping_rates r
   WHERE r.seller_id = v_seller OR r.seller_id IS NULL
   -- Je Land GENAU EINE Zeile, sonst sprengt die Kasse Stripes Grenze von
   -- fünf Versandoptionen (3 Länder × 4 Stufen wären zwölf). Die Reihenfolge
   -- entscheidet, welche:
   --   1. der eigene Satz des Verkäufers schlägt die Vorgabe der Plattform
   --   2. Stufen, die ausreichen, vor solchen, die es nicht tun
   --   3. darunter die KLEINSTE ausreichende — und wenn keine ausreicht, die
   --      grösste vorhandene (daher das negative Vorzeichen)
   -- Damit trägt ein Land, für das nur eine Pauschale hinterlegt ist (AT, CH),
   -- weiterhin genau diese — ohne Sonderfall.
   ORDER BY r.country,
            (r.seller_id IS NULL),
            (r.tier < v_tier),
            CASE WHEN r.tier >= v_tier THEN r.tier ELSE -r.tier END;
END $$;

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Die Sätze stehen. Erwartet: DE mit vier Stufen, AT und CH mit je einer.
--
--      SELECT country, tier, label, cents FROM public.berkat_shipping_rates
--       WHERE seller_id IS NULL ORDER BY country, tier;
--
-- 2) ⚠️ DIE PROBE, DIE DEN GANZEN ENTWURF TRÄGT — ohne sie ist nichts belegt.
--    Ein Korb mit einem Brief-Artikel muss DE = 1,19 € liefern, derselbe Korb
--    mit einem Paket-Artikel darin 4,90 €:
--
--      UPDATE live_auctions SET shipping_tier = 1 WHERE cart_id = '<korb>';
--      SELECT * FROM public.get_cart_shipping_options('<korb>');   -- DE 119
--
--      UPDATE live_auctions SET shipping_tier = 3
--       WHERE id = '<ein artikel im korb>';
--      SELECT * FROM public.get_cart_shipping_options('<korb>');   -- DE 410
--
--    Der zweite Lauf ist der eigentliche Beweis: EIN grösserer Artikel hebt
--    den ganzen Korb, weil alles in dasselbe Paket geht.
--
-- 3) Und die Gegenrichtung — eine fehlende Angabe darf NICHT verbilligen:
--
--      UPDATE live_auctions SET shipping_tier = NULL WHERE id = '<artikel>';
--      SELECT * FROM public.get_cart_shipping_options('<korb>');   -- DE 490
--
-- 4) Höchstens EINE Option je Land, sonst sprengt die Kasse Stripes Grenze:
--
--      SELECT country, count(*) FROM public.get_cart_shipping_options('<korb>')
--       GROUP BY country HAVING count(*) > 1;    -- erwartet: null Zeilen
--
-- 5) Die beiden Funktionen dürfen nicht auseinanderlaufen — gleiche Beträge
--    für denselben Korb (bis auf die Gutschrift, die nur die zweite kennt):
--
--      SELECT a.country, a.cents AS anzeige, b.cents AS kasse
--        FROM public.get_cart_shipping_options('<korb>') a
--        JOIN public.get_cart_shipping_options_for_checkout('<korb>') b
--          ON b.country = a.country;
--
-- 6) Rechte: `set_listing_shipping_tier` darf nicht an `anon`. Erwartet: f.
--
--      SELECT has_function_privilege('anon', p.oid, 'EXECUTE')
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public' AND p.proname = 'set_listing_shipping_tier';
--
-- 7) Je genau eine Signatur, kein HTTP 300:
--
--      SELECT proname, count(*) FROM pg_proc p
--        JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public'
--         AND proname IN ('get_cart_shipping_options',
--                         'get_cart_shipping_options_for_checkout',
--                         'set_listing_shipping_tier')
--       GROUP BY proname;
--
-- 8) Am Gerät: Ein Angebot mit Stufe „Brief" einstellen, es kaufen, und in der
--    Kasse muss **1,19 €** stehen statt 4,90 €. Das ist zugleich Prüfliste B1
--    — der Kaufweg, der noch nie gelaufen ist.
