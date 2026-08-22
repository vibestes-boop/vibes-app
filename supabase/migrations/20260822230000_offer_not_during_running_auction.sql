-- ─────────────────────────────────────────────────────────────────────────────
-- Eine Preis-Zusage gilt nicht mehr, sobald die Uhr läuft
--
-- ENTSCHEIDUNG vom 22.08.2026, von Zaur delegiert („schau, was whatnot macht,
-- und denkst du was besser ist?"). Der Fund stammt aus dem Sicherheits-Audit
-- (Übergabe, Abschnitt 73) und war ausdrücklich KEINE Lücke, sondern eine
-- offene Produktfrage:
--
--   Auktion steht bei 80 €, der Käufer hält eine angenommene Zusage über 50 €.
--   Er löst sie ein. Der Höchstbietende verliert den Artikel, der Verkäufer
--   die Differenz.
--
-- WAS WHATNOT TUT — nachgesehen, nicht vermutet (Help Center, 22.08.2026):
--   • Vorschläge gibt es NUR auf Buy-It-Now-Artikeln.
--     Wörtlich: „Auctions don't support offers."
--   • Ein „Accept" belastet die Karte SOFORT. Es gibt dort gar keine Zusage,
--     die herumliegt und später eingelöst wird.
-- Die Lage kann bei Whatnot also strukturell nicht entstehen.
--
-- WARUM BERKAT SIE TROTZDEM HAT: Hier ist eine angenommene Zusage bewusst
-- „eine Einladung zum Kauf, kein geschlossener Vertrag" (Abschnitt 24) — der
-- Käufer darf sie sogar zurückziehen. Das ist eine gute Entscheidung; sie
-- braucht nur eine Grenze.
--
-- DIE GRENZE: der Start der Auktion. Berkats eigene Regel sagt, ein Gebot ist
-- eine BINDENDE Willenserklärung (Abschnitt 19). Eine Zusage, die ein
-- bindendes Gebot schlägt, nimmt dem Gebot seine Bedeutung — und wenn Bieter
-- merken, dass ihnen der Artikel zu einem vorher ausgehandelten Preis
-- weggenommen werden kann, hören sie auf zu bieten. **Die Glaubwürdigkeit der
-- Auktion IST das Produkt.**
--
-- ⚠️ WAS SICH NICHT ÄNDERT: Der Sofortkauf zum LISTENPREIS bleibt während der
-- laufenden Auktion erlaubt — das ist ein gewolltes Abkürzen und war nie das
-- Problem. Weg ist nur der Rabatt. Und vor dem Start sowie nach dem Ende (im
-- Regal) gilt die Zusage unverändert.
--
-- ⚠️ DER RUMPF IST MASCHINELL ÜBERNOMMEN. `buy_now_live_auction` hat bei einer
-- Neufassung schon einmal `buy_now_gone`, den Eintrag in `live_bids`,
-- `bid_count`, `ends_at` und den jsonb-Rückgabewert verloren (Abschnitte 20,
-- 22, 24). Der Generator bricht ab, wenn der Anker nicht genau einmal trifft,
-- und zählt danach nach, dass es weiterhin genau eine `CREATE`-Zeile und genau
-- ein `SELECT INTO o` gibt.
--
-- ⚠️ UND EINE FALLE, DIE BEIM BAUEN AUFFIEL: Der Riegel steht VOR dem
-- `SELECT * INTO o`, nicht dahinter. `FOUND` gilt in PL/pgSQL für die zuletzt
-- ausgeführte Anweisung — eine Prüfung dazwischen hätte das `IF NOT FOUND`
-- darunter getroffen und die Gültigkeitsprüfung der Zusage still ausgehebelt.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."buy_now_live_auction"("p_auction_id" "uuid", "p_offer_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a       public.live_auctions;
  o       public.berkat_offers;
  v_uid   uuid := auth.uid();
  v_ok    boolean;
  v_cart  uuid;
  v_price integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  -- ── Wächter 1: Frauen-Only ──
  -- Bewusst dieselbe Meldung wie „gibt es nicht": Sonst verrät der Fehlertext
  -- die Existenz eines Frauen-Only-Artikels.
  IF a.women_only
     AND a.seller_id <> v_uid
     AND NOT public.is_women_only_verified() THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  IF a.buy_now_cents IS NULL THEN
    RAISE EXCEPTION 'no_buy_now' USING ERRCODE = '22023';
  END IF;
  IF a.status NOT IN ('scheduled', 'running', 'listed') THEN
    RAISE EXCEPTION 'auction_closed' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;
  -- Sobald jemand über dem Sofortkaufpreis bietet, ist der Sofortkauf weg.
  IF a.current_bid_cents IS NOT NULL AND a.current_bid_cents >= a.buy_now_cents THEN
    RAISE EXCEPTION 'buy_now_gone' USING ERRCODE = '22023';
  END IF;

  -- ── Wächter 2: die ZAG-Schranke ──
  --
  -- Nur für das Regal: Ein Artikel in einer laufenden Sendung hat einen
  -- Verkäufer, der sich bewusst zum Senden entschieden hat — dieser Weg wird
  -- mit der Verkäufer-Aufnahme geregelt, nicht hier.
  --
  -- `IS DISTINCT FROM true` statt `IS NOT NULL AND = false`: Damit fällt auch
  -- „keine Zeile" auf gesperrt. Wer hier wieder ein `IS NOT NULL` einbaut, macht
  -- aus einer erlaubnisrechtlichen Schranke eine Vermutung.
  IF a.session_id IS NULL THEN
    SELECT checkout_enabled INTO v_ok
      FROM public.berkat_sellers WHERE user_id = a.seller_id;
    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'contact_seller' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ── Wächter 3: der vereinbarte Preis ── (NEU am 18.08.2026)
  --
  -- Ohne `p_offer_id` gilt der Listenpreis — der alte Weg, unverändert.
  v_price := a.buy_now_cents;

  IF p_offer_id IS NOT NULL THEN
    -- ⚠️ Eine Zusage gilt NICHT mehr, sobald die Uhr läuft (22.08.2026).
    --
    -- Vorher liess die Statusprüfung weiter oben ('scheduled','running',
    -- 'listed') auch den laufenden Fall durch: Stand die Auktion bei 80 € und
    -- die Zusage lautete 50 €, konnte der Käufer sie einlösen — der
    -- Höchstbietende verlor den Artikel, der Verkäufer die Differenz.
    --
    -- Berkats eigene Regel sagt, ein Gebot ist eine BINDENDE Willenserklärung
    -- (Übergabe, Abschnitt 19). Eine Zusage, die ein bindendes Gebot schlägt,
    -- nimmt dem Gebot seine Bedeutung — und wenn Bieter merken, dass ihnen der
    -- Artikel zu einem vorher ausgehandelten Preis weggenommen werden kann,
    -- hören sie auf zu bieten. Die Glaubwürdigkeit der Auktion IST das Produkt.
    --
    -- Whatnot kennt das Problem strukturell gar nicht: Dort gibt es Vorschläge
    -- nur auf Buy-It-Now-Artikeln ("auctions don't support offers"), und ein
    -- angenommener Vorschlag belastet die Karte SOFORT, statt als einlösbare
    -- Zusage liegen zu bleiben.
    --
    -- ⚠️ Der SOFORTKAUF zum Listenpreis bleibt während der Auktion erlaubt —
    -- nur der Rabatt gilt nicht mehr. Wer die Zusage einlösen will, tut es vor
    -- dem Start; danach steht der volle Preis.
    --
    -- ⚠️ Dieser Riegel steht VOR dem SELECT INTO. `FOUND` gilt für die zuletzt
    -- ausgeführte Anweisung; eine Prüfung dazwischen träfe das `IF NOT FOUND`
    -- darunter.
    IF a.status = 'running' THEN
      RAISE EXCEPTION 'offer_auction_running' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO o FROM public.berkat_offers WHERE id = p_offer_id FOR UPDATE;
    IF NOT FOUND
       OR o.auction_id <> a.id            -- Zusage für einen ANDEREN Artikel
       OR o.buyer_id  <> v_uid            -- fremde Zusage einlösen
       OR o.status    <> 'accepted' THEN  -- abgelehnt, offen oder schon benutzt
      RAISE EXCEPTION 'offer_not_valid' USING ERRCODE = '42501';
    END IF;
    -- Der Käufer zahlt nie mehr als den Listenpreis, auch wenn die Zeile je
    -- anders aussähe. Ein Gürtel zum Hosenträger — die RPC ist der einzige Weg
    -- zu diesem Feld, aber sie ist auch der einzige Weg zum Geld.
    v_price := LEAST(o.amount_cents, a.buy_now_cents);
  END IF;

  v_cart := public.ensure_auction_cart(v_uid, a.seller_id);

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (a.id, v_uid, v_price);

  UPDATE public.live_auctions
     SET status            = 'sold',
         current_bid_cents = v_price,
         current_bidder_id = v_uid,
         winner_id         = v_uid,
         bid_count         = a.bid_count + 1,
         settled_at        = now(),
         ends_at           = now(),
         cart_id           = v_cart
   WHERE id = a.id;

  -- Alle noch offenen Vorschläge auf diesen Artikel sind gegenstandslos —
  -- er ist weg. Ohne das warteten andere Käufer auf eine Antwort, die nie
  -- kommt, und der Verkäufer sähe eine Liste toter Verhandlungen.
  UPDATE public.berkat_offers
     SET status = 'declined', responded_at = now()
   WHERE auction_id = a.id
     AND status IN ('pending', 'countered', 'accepted');

  RETURN jsonb_build_object(
    'auction_id', a.id,
    'status',     'sold',
    'winner_id',  v_uid,
    'cart_id',    v_cart,
    'paid_cents', v_price
  );
END $$;
-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. Genau eine Signatur, kein anon, kein HTTP 300:
--      SELECT p.proname, pg_get_function_identity_arguments(p.oid),
--             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_darf
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname='public' AND p.proname='buy_now_live_auction';
--      -- erwartet: eine Zeile, anon_darf = false
--
-- 2. Der Riegel steht wirklich im Live-Code:
--      SELECT prosrc LIKE '%offer_auction_running%' FROM pg_proc
--       WHERE proname = 'buy_now_live_auction';
--      -- erwartet: true
--
-- 3. ⚠️ DIE EIGENTLICHE PROBE, und sie braucht zwei Konten und eine Sendung:
--      • Angebot mit Preisvorschlag, Zusage annehmen
--      • denselben Artikel in eine Show holen und die Auktion STARTEN
--      • als Käufer die Zusage einlösen
--      -- erwartet: `offer_auction_running`
--      • Auktion beenden, Artikel liegt wieder im Regal → Zusage geht wieder
--
-- 4. Und der Normalfall, der NICHT brechen darf:
--      • Zusage vor dem Start einlösen → geht, zum vereinbarten Preis
--      • Sofortkauf OHNE Zusage waehrend der laufenden Auktion → geht weiter,
--        zum Listenpreis
-- ─────────────────────────────────────────────────────────────────────────────
