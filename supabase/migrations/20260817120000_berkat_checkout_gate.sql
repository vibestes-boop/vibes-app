-- Die ZAG-Schranke hängt an `checkout_enabled` — und nur daran
--
-- WAS SCHIEFLIEF, UND ZWAR HEUTE
-- `buy_now_live_auction` sperrte einen Regal-Kauf so:
--
--     SELECT checkout_enabled INTO v_ok FROM berkat_sellers WHERE user_id = a.seller_id;
--     IF v_ok IS NOT NULL AND v_ok = false THEN RAISE 'contact_seller';
--
-- „Keine Zeile" hieß damit **erlaubt**. Genau darauf beruhte der Satz aus
-- Abschnitt 20 der Übergabe: „In der gebauten Fassung heißt ‚keine Zeile'
-- deshalb wie bisher, nicht ‚gesperrt'." Das stimmte — solange niemand eine
-- Zeile hatte.
--
-- `20260816220000` hat das am 17.08.2026 aufgehoben: Sie legt bei JEDEM
-- `create_standing_listing` eine Zeile an (`ON CONFLICT DO NOTHING`), und
-- `checkout_enabled` steht dabei bewusst auf seiner Vorgabe `false`. Ab dem
-- ersten Angebot hat also jeder Verkäufer eine Zeile mit `false` — und der
-- Wächter schnappte für **alle** zu, auch für den Betreiber, dessen Geld auf
-- sein eigenes Stripe-Konto läuft und bei dem es gar keine Weiterleitung
-- fremden Geldes gibt.
--
-- Belegt am 17.08.2026 um 21:0x: Vor dem Einspielen hatte `berkat_sellers`
-- NULL Zeilen, danach genau eine (`kind = 'private'`, `checkout_enabled =
-- false`) — und damit wäre der am 16.08. durchgespielte Kauf eines
-- Dauerangebots mit `contact_seller` gescheitert.
--
-- Das ist wörtlich die Falle, die die drei Skeptiker am 17.08. schon einmal
-- abgelehnt hatten: **„Ein Riegel mit Vorgabe `false` und ohne Backfill ist
-- kein Riegel, sondern ein Ausfall."** Er kam durch die Seitentür einer
-- Migration zurück, die ihn gar nicht anfassen wollte.
--
-- WAS SICH ÄNDERT
-- 1. Bestandsschutz für den Betreiber (unten, einmalig und datengestützt).
-- 2. Die Polarität des Wächters wird umgedreht: `checkout_enabled` ist ab
--    jetzt die **einzige** Wahrheit. Kein Eintrag heißt gesperrt, nicht frei.
--
-- Punkt 2 ist die eigentliche Lehre. „Kein Eintrag = erlaubt" war von Anfang an
-- die falsche Polarität für eine erlaubnisrechtliche Schranke; sie sah nur
-- richtig aus, weil genau ein Mensch keinen Eintrag hatte. Eine Schranke, deren
-- Zustand „unbekannt" auf „durchlassen" fällt, ist keine.

BEGIN;

-- ─── 1. Bestandsschutz ───────────────────────────────────────────────────────
--
-- Wer über diese Plattform schon Geld bekommen hat, BEVOR es die Schranke gab,
-- behält den Weg. Das ist heute genau der Betreiber.
--
-- Datengestützt statt mit einer festen Kennung im Code, aus zwei Gründen: Die
-- Kennung eines Kontos gehört nicht in ein öffentliches Repo, und die Bedingung
-- erklärt sich selbst.
--
-- ⚠️ DIESE ABFRAGE DARF NIE ZU EINEM TRIGGER WERDEN. Sie ist eine einmalige
-- Übergangsregel. Als Automatik gelesen wäre sie ein Selbstbedienungsladen:
-- Artikel in einer laufenden Sendung sind von der Schranke ausgenommen (siehe
-- Wächter 2 unten), ein fremder Verkäufer könnte sich also über eine Show eine
-- bezahlte Bestellung verschaffen und damit die Kassen-Freigabe fürs Regal.
-- Wer nach diesem Tag freigeschaltet wird, wird es von Hand — nach einer
-- Prüfung, so wie es in `berkat_sellers.checkout_enabled` von Anfang an
-- gemeint war.
UPDATE public.berkat_sellers s
   SET checkout_enabled = true
 WHERE s.checkout_enabled = false
   AND EXISTS (
     SELECT 1
       FROM public.product_orders o
      WHERE o.seller_id = s.user_id
        AND o.cart_id IS NOT NULL              -- nur Berkat-Bestellungen
        AND o.status IN ('paid', 'shipped', 'delivered')
   );

DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.berkat_sellers WHERE checkout_enabled;
  RAISE NOTICE 'Kassen-Freigabe steht jetzt bei % Verkäufer(n).', v_n;
END $$;

-- ─── 2. Der Wächter ──────────────────────────────────────────────────────────
--
-- ⚠️ Der Rumpf ist wörtlich der aus `20260816210000`, geändert ist NUR der
-- Block „Wächter 2". Das Original lag beim Schreiben daneben — genau die
-- Vorsichtsmaßnahme, die die Übergabe für diese Funktion verlangt, weil hier
-- schon einmal `buy_now_gone`, der Eintrag in `live_bids`, `bid_count`,
-- `ends_at` und der jsonb-Rückgabewert verlorengingen.
CREATE OR REPLACE FUNCTION public.buy_now_live_auction(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a       public.live_auctions;
  v_uid   uuid := auth.uid();
  v_ok    boolean;
  v_cart  uuid;
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

  -- ── Wächter 2: die ZAG-Schranke ── (GEÄNDERT am 17.08.2026)
  --
  -- Nur für das Regal: Ein Artikel in einer laufenden Sendung hat einen
  -- Verkäufer, der sich bewusst zum Senden entschieden hat — dieser Weg wird
  -- mit der Verkäufer-Aufnahme geregelt, nicht hier.
  --
  -- `IS DISTINCT FROM true` statt `IS NOT NULL AND = false`: Damit fällt auch
  -- „keine Zeile" auf gesperrt. Vorher war ein fehlender Eintrag ein Freibrief,
  -- und seit `20260816220000` bekam umgekehrt jeder einen Eintrag mit `false` —
  -- die Schranke war also erst für niemanden da und dann für alle.
  --
  -- Wer hier wieder ein `IS NOT NULL` einbaut, macht aus einer
  -- erlaubnisrechtlichen Schranke eine Vermutung.
  IF a.session_id IS NULL THEN
    SELECT checkout_enabled INTO v_ok
      FROM public.berkat_sellers WHERE user_id = a.seller_id;
    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'contact_seller' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_cart := public.ensure_auction_cart(v_uid, a.seller_id);

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (a.id, v_uid, a.buy_now_cents);

  UPDATE public.live_auctions
     SET status            = 'sold',
         current_bid_cents = a.buy_now_cents,
         current_bidder_id = v_uid,
         winner_id         = v_uid,
         bid_count         = a.bid_count + 1,
         settled_at        = now(),
         ends_at           = now(),
         cart_id           = v_cart
   WHERE id = a.id;

  RETURN jsonb_build_object(
    'auction_id', a.id,
    'status',     'sold',
    'winner_id',  v_uid,
    'cart_id',    v_cart,
    'paid_cents', a.buy_now_cents
  );
END $$;

REVOKE ALL ON FUNCTION public.buy_now_live_auction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_now_live_auction(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- 1. Der Betreiber ist frei, alle anderen nicht:
--      SELECT user_id, kind, checkout_enabled, declared_at FROM berkat_sellers;
--    Erwartet heute: genau eine Zeile, `checkout_enabled = true`.
--
-- 2. Ein Kauf eines Dauerangebots dieses Verkäufers läuft wieder durch
--    (braucht das zweite Konto — `seller_cannot_bid` greift vorher).
--
-- 3. Ein Konto ohne Freigabe wird abgewiesen: `buy_now_live_auction` mit der
--    UUID eines seiner Dauerangebote → `contact_seller`.
--
-- ⚠️ Die Oberfläche muss mitziehen. Sie entschied bis zum 17.08.2026 an
-- `seller_kind` („privat → Nachricht, sonst Kaufen"), der Server an
-- `checkout_enabled` — zwei verschiedene Spalten für dieselbe Frage. Ein
-- gewerblicher Verkäufer ohne Freigabe bekam damit den goldenen Kaufknopf, den
-- der Server garantiert verweigert. `app/listing/[id].tsx` hängt seither an
-- `checkout_enabled`; `seller_kind` steuert nur noch den Rechtstext.
