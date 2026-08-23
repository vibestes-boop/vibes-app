-- Urlaubsmodus — ein Schalter statt zwanzig Rückzügen
-- ============================================================================
--
-- Aus der Liste in Übergabe 69, Punkt 7: „Vacation Mode — ab etwa zwanzig
-- Verkäufern; heute müsste man zwanzig Angebote einzeln zurückziehen."
--
-- Der Grund, es JETZT zu bauen, ist nicht die Zahl der Verkäufer, sondern die
-- Versandzeit: Sie ist eine der drei Kacheln auf dem öffentlichen Profil
-- (Übergabe 10). Wer zwei Wochen weg ist und seine Angebote stehen lässt,
-- bezahlt den Urlaub mit seinem Vertrauenswert — und genau das ist der
-- Verkäufer, den Phase 0 halten muss.
--
-- ── Ein DATUM, kein Schalter ────────────────────────────────────────────────
--
-- `vacation_until timestamptz` statt `on_vacation boolean`. Zwei Gründe:
--
--   • Es läuft von selbst ab. Ein Boolean bleibt stehen, bis jemand daran
--     denkt — und der häufigste Fall ist, dass niemand daran denkt.
--   • Es lässt sich ANZEIGEN: „wieder da am 5. September" ist eine Auskunft,
--     „im Urlaub" ist eine Entschuldigung.
--
-- ── Wo die Sichtbarkeit hingehört ───────────────────────────────────────────
--
-- In die Lese-Policy des Regals, nicht in die Abfragen. Berkat zeigt Angebote
-- an sechs Flächen (Startseite, Marktplatz, Kategorie, Suche, Profil,
-- „Mehr von diesem Verkäufer"); die Regel dort sechsmal zu wiederholen ist die
-- Fehlerklasse, die dieses Dokument dauernd findet — „wer etwas an N Orten
-- anzeigt, muss an allen N nachziehen" (Übergabe 18, 21, 23).
--
-- ⚠️ Der Verkäufer sieht seine eigene Ware weiter. Sonst wäre der Urlaub eine
-- Falle: Man schaltet ihn ein und kann sein Regal nicht mehr verwalten.
--
-- ⚠️ Der Status bleibt `listed`. Die Angebote auf `cancelled` zu setzen wäre
-- der naheliegende Weg und der falsche — beim Zurückkommen müsste man jedes
-- einzeln wiederherstellen, und man wüsste nicht mehr, welche vorher schon
-- zurückgezogen waren.

-- ── 1 · Das Datum ───────────────────────────────────────────────────────────

ALTER TABLE public.berkat_sellers
  ADD COLUMN IF NOT EXISTS vacation_until timestamptz;

-- `berkat_sellers` ist offen lesbar (`USING (true)`), und das ist hier
-- richtig: Dass ein Verkäufer gerade nicht liefert, gehört zu den Angaben, die
-- ein Käufer VOR dem Schreiben braucht. Ein Tabellen-GRANT deckt die neue
-- Spalte; ein Spalten-GRANT wäre nur nötig, wenn die Tabelle eine eingefrorene
-- Liste hätte — geprüft, hat sie nicht.

-- ── 2 · Die Frage, einmal beantwortet ───────────────────────────────────────
--
-- ⚠️ `SECURITY DEFINER`, obwohl `berkat_sellers` heute offen lesbar ist. Eine
-- Unterabfrage IN einer Policy respektiert die RLS der referenzierten Tabelle:
-- Würde `berkat_sellers` je enger gefasst, verschwänden plötzlich fremde
-- Angebote — still, ohne Fehler, und niemand käme auf die Urlaubs-Policy.
-- Dieselbe Vorsicht wie bei `may_notify` (`20260823130000`).

CREATE OR REPLACE FUNCTION public.seller_on_vacation(p_seller uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.berkat_sellers s
     WHERE s.user_id = p_seller
       AND s.vacation_until IS NOT NULL
       AND s.vacation_until > now()
  );
$fn$;

REVOKE ALL ON FUNCTION public.seller_on_vacation(uuid) FROM PUBLIC;
-- `anon` behält EXECUTE: Das Regal ist ohne Konto sichtbar, und die Policy
-- unten läuft für jeden Leser. Die Funktion gibt genau ein Ja/Nein über eine
-- ohnehin öffentliche Angabe heraus.
GRANT EXECUTE ON FUNCTION public.seller_on_vacation(uuid) TO anon, authenticated, service_role;

-- ── 3 · Die Policy ──────────────────────────────────────────────────────────
--
-- ⚠️ `DROP` und neu, nicht daneben: Postgres verknüpft permissive Policies mit
-- ODER. Eine zweite Policy neben dieser würde die Urlaubsregel per ODER wieder
-- aufheben — der Fehler, der am 16.07. auf `live_sessions` und am 22.08. auf
-- `posts` zuschlug (Übergabe 73, Fund 2). Der Rest der Bedingung ist
-- ZEICHENGLEICH aus dem Abzug übernommen.

DROP POLICY IF EXISTS "live_auctions_select_standing" ON public.live_auctions;

CREATE POLICY "live_auctions_select_standing" ON public.live_auctions
  FOR SELECT USING (
    (session_id IS NULL)
    AND (
      (women_only = false)
      OR (seller_id = auth.uid())
      OR public.is_women_only_verified()
    )
    AND (
      (seller_id = auth.uid())
      OR NOT public.seller_on_vacation(seller_id)
    )
  );

-- ── 4 · Ein- und ausschalten ────────────────────────────────────────────────
--
-- Eigene RPC, weil `set_berkat_seller_kind` der einzige Schreibweg auf
-- `berkat_sellers` bleiben soll (Übergabe 43) — und weil ein Urlaub keine
-- Anbieter-Erklärung ist. NULL beendet ihn.

CREATE OR REPLACE FUNCTION public.set_seller_vacation(p_until timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Ein Datum in der Vergangenheit ist ein Tippfehler, kein Urlaub. Es
  -- stillschweigend zu übernehmen hiesse, dem Verkäufer zu bestätigen, dass er
  -- weg ist, während sein Regal weiter offen steht.
  IF p_until IS NOT NULL AND p_until <= now() THEN
    RAISE EXCEPTION 'vacation_in_past' USING ERRCODE = '22023';
  END IF;

  -- Ein Jahr als Obergrenze. Wer länger weg ist, zieht seine Angebote zurück —
  -- ein Regal, das zwei Jahre unsichtbar in der Datenbank liegt, ist kein
  -- Urlaub mehr, sondern eine Leiche.
  IF p_until IS NOT NULL AND p_until > now() + interval '1 year' THEN
    RAISE EXCEPTION 'vacation_too_long' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ Der Verkäufer hat womöglich noch keine Zeile — dann entsteht sie hier.
  -- `kind` bleibt dabei auf seiner Vorgabe; `checkout_enabled` fasst diese
  -- Funktion NICHT an (die ZAG-Schranke ist keine Urlaubsfrage).
  INSERT INTO public.berkat_sellers (user_id, vacation_until)
  VALUES (v_uid, p_until)
  ON CONFLICT (user_id) DO UPDATE SET vacation_until = EXCLUDED.vacation_until;

  RETURN p_until;
END $fn$;

REVOKE ALL ON FUNCTION public.set_seller_vacation(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_seller_vacation(timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_seller_vacation(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_seller_vacation(timestamptz) TO service_role;

-- ── 5 · Der Kaufweg ─────────────────────────────────────────────────────────
--
-- Rumpf MASCHINELL aus dem Abzug, EIN Einschub (`/tmp/gen_vac.mjs`). Der
-- Generator prüft danach, dass `buy_now_gone`, `live_bids`, `bid_count`,
-- `ends_at` und der jsonb-Rückgabewert noch da sind — genau die fünf Dinge,
-- die diese Funktion bei einer früheren Neufassung verloren hat.

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
  -- ⚠️ URLAUB — und warum der Riegel HIER stehen muss und nicht nur in der
  -- Policy. `live_auctions_select_standing` blendet die Ware eines
  -- verreisten Verkäufers aus, aber diese Funktion ist `SECURITY DEFINER`
  -- und liest mit `SELECT … FOR UPDATE` an der RLS vorbei. Wer den Link
  -- gespeichert hat, käme sonst weiterhin durch — dieselbe Lücke, die am
  -- 17.08. bei `women_only` gefunden wurde (Übergabe 20).
  --
  -- „gibt es nicht" statt „ist im Urlaub" wäre hier FALSCH: Der Verkäufer ist
  -- öffentlich sichtbar, sein Urlaub steht auf seinem Profil, und ein Käufer,
  -- der nichts erfährt, sucht den Fehler bei sich.
  IF a.session_id IS NULL AND public.seller_on_vacation(a.seller_id) THEN
    RAISE EXCEPTION 'seller_on_vacation' USING ERRCODE = '22023';
  END IF;

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

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Genau EINE SELECT-Policy für das Regal — sonst hebt die zweite die
--    Urlaubsregel per ODER auf. Erwartet: 1.
--
--      SELECT count(*) FROM pg_policies
--       WHERE tablename = 'live_auctions' AND policyname = 'live_auctions_select_standing';
--
-- 2) ⚠️ DIE PROBE, DIE ZÄHLT — als ANON, also aus der Sicht eines Besuchers:
--
--      -- vorher zählen
--      GET /rest/v1/live_auctions?select=id&status=eq.listed&session_id=is.null
--
--      SELECT public.set_seller_vacation(now() + interval '3 days');  -- angemeldet!
--
--      -- danach zählen: die Angebote DIESES Verkäufers müssen fehlen
--
--    Und die Gegenprobe, die man vergisst: **Der Verkäufer selbst muss sie
--    weiter sehen.** Dieselbe Abfrage aus seiner angemeldeten Sitzung gibt
--    unverändert alle zurück.
--
-- 3) Der Kaufweg ist auch mit Link zu. Erwartet: `seller_on_vacation`.
--
--      POST /rest/v1/rpc/buy_now_live_auction  { "p_auction_id": "<im urlaub>" }
--
--    Das ist der Teil, den die Policy NICHT abdeckt — die Funktion ist
--    SECURITY DEFINER und liest an der RLS vorbei.
--
-- 4) Zurückkommen: `SELECT public.set_seller_vacation(NULL);` — danach ist
--    alles wieder da, ohne dass ein einziges Angebot angefasst wurde.
--
-- 5) Ein Datum in der Vergangenheit muss abgelehnt werden:
--
--      SELECT public.set_seller_vacation(now() - interval '1 day');  -- 22023
--
-- 6) Rechte: `set_seller_vacation` nicht an `anon`, `seller_on_vacation` schon
--    (das Regal ist ohne Konto sichtbar). Erwartet: f / t.
--
--      SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE')
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public'
--         AND p.proname IN ('set_seller_vacation','seller_on_vacation');
--
-- 7) ⚠️ Und die, die man nach JEDER Policy-Änderung an dieser Tabelle macht:
--    Ist das Regal für einen Besucher OHNE Urlaub unverändert gross? Eine
--    verschärfte Policy, die zu viel verschluckt, tut das lautlos.
--
--      GET /rest/v1/live_auctions?select=id&status=eq.listed&session_id=is.null
--      -- erwartet: dieselbe Zahl wie vor dieser Migration (Stand 23.08.: 95)
