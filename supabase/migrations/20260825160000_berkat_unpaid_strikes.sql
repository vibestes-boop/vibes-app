-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: Nichtzahler haben Folgen — Strikes nach eBay-Vorbild
--
-- ── DAS PROBLEM ─────────────────────────────────────────────────────────────
--
-- Ein Zuschlag ohne Zahlung kostet heute NICHTS. Der Sammelkorb läuft nach 24
-- Stunden auf `expired`, und das war es: kein Vermerk, keine Zahlungsquote,
-- kein Weg für den Verkäufer zu sehen, dass dieser Käufer zum dritten Mal nicht
-- zahlt. Dazu ist die E-Mail-Bestätigung abgeschaltet — ein Wegwerf-Konto ist in
-- dreissig Sekunden gemacht.
--
-- Bei einer Auktion ist das der teuerste Fehlbetrag, den es gibt: Der Verkäufer
-- hat die Ware zurückgehalten, der Abend ist gelaufen, das Geld kommt nie. eBay
-- hat dafür Bewertungen und „unpaid item strikes"; Berkat hatte nichts.
--
-- ── ⚠️ WARUM DER VERKÄUFER MELDET UND NICHT DIE DATENBANK ENTSCHEIDET ────────
--
-- Der naheliegende Weg wäre: Korb läuft auf `expired` → Strike. Der geht nicht,
-- und der Grund ist eine Entscheidung von heute:
--
--   **Ohne Stripe Connect kassiert der Verkäufer selbst** (`checkout_enabled`
--   steht ab Werk auf `false`, und für fremde Verkäufer muss es das bleiben —
--   Weiterleiten fremden Geldes ist nach ZAG erlaubnispflichtig).
--
-- Damit gibt es für diese Verkäufer **gar keinen Korb und gar keine Bestellung**.
-- Berkat sieht nie, ob bezahlt wurde. Die Zahlung findet zwischen zwei Menschen
-- statt, und nur einer von beiden weiss, wie sie ausging.
--
-- > **Wer die Zahlung nicht sieht, darf über sie nicht urteilen.** Der Strike
-- > ist deshalb eine MELDUNG des Verkäufers, keine Feststellung des Systems.
--
-- ── ⚠️ UND DESHALB BRAUCHT ER BREMSEN ───────────────────────────────────────
--
-- Eine Meldung, die eine Sperre auslöst, ist eine Waffe. Vier Riegel:
--
--   1. Nur der VERKÄUFER dieser Auktion, nachgeschlagen an der Zeile.
--   2. Nur nach einer FRIST (48 h ab Zuschlag). Wer nach zwei Stunden meldet,
--      meldet Ungeduld, nicht Zahlungsverweigerung.
--   3. Nur EINMAL je Auktion — der Primärschlüssel sagt das.
--   4. **Zurücknehmbar.** Zahlt jemand verspätet, muss der Verkäufer das
--      geradeziehen können. Ohne diesen Weg wäre jede Fehlmeldung endgültig,
--      und das erste Missverständnis kostete jemandem sein Konto.
--
-- ── ⚠️ WAS DIESE MIGRATION NICHT TUT ────────────────────────────────────────
--
-- Sie macht Strikes **nicht öffentlich**. Wer wie oft nicht gezahlt hat, sieht
-- der Betroffene selbst und der meldende Verkäufer — sonst niemand. Eine
-- öffentliche Liste von Nichtzahlern wäre ein Pranger, und bei einer engen
-- Gemeinschaft ist das keine Kleinigkeit (Übergabe: „junge, enge Community →
-- Backlash-Risiko").
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Die Meldung ──────────────────────────────────────────────────────────
--
-- ⚠️ `auction_id` ist der Primärschlüssel, nicht ein eigenes `id`: Eine Auktion
-- kann genau einmal gemeldet werden. Das steht damit im Schema und nicht in
-- einer Prüfung, die jemand vergessen kann.
CREATE TABLE IF NOT EXISTS public.berkat_unpaid_strikes (
  auction_id  uuid PRIMARY KEY REFERENCES public.live_auctions(id) ON DELETE CASCADE,
  buyer_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_at timestamptz NOT NULL DEFAULT now(),
  -- Freitext des Verkäufers, freiwillig. Nicht öffentlich; er hilft dem
  -- Betreiber, wenn jemand widerspricht.
  note        text CHECK (note IS NULL OR char_length(note) <= 300)
);

-- Die Zählung fragt „wie viele GÜLTIGE Strikes hat dieser Käufer" — also nach
-- Käufer und Zeitpunkt.
CREATE INDEX IF NOT EXISTS berkat_unpaid_strikes_buyer
  ON public.berkat_unpaid_strikes (buyer_id, reported_at DESC);

ALTER TABLE public.berkat_unpaid_strikes ENABLE ROW LEVEL SECURITY;

-- ⚠️ Lesen darf, wen es angeht: der Betroffene und der Meldende. **Kein
-- Dritter.** Ein Verkäufer kann also NICHT nachsehen, ob ein fremder Bieter
-- Strikes hat — er erfährt es erst, wenn die Sperre greift und gar kein Gebot
-- mehr kommt. Das ist Absicht: Die Alternative wäre eine durchsuchbare
-- Nichtzahler-Liste, und das ist ein Pranger.
DROP POLICY IF EXISTS berkat_unpaid_strikes_select ON public.berkat_unpaid_strikes;
CREATE POLICY berkat_unpaid_strikes_select ON public.berkat_unpaid_strikes
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Geschrieben wird ausschliesslich über die RPCs unten — dort sitzen Frist,
-- Eigentümer-Prüfung und Zustand. Kein INSERT/DELETE für Clients.
REVOKE ALL ON TABLE public.berkat_unpaid_strikes FROM PUBLIC, anon;
GRANT SELECT ON public.berkat_unpaid_strikes TO authenticated;

COMMENT ON TABLE public.berkat_unpaid_strikes IS
  'Vom Verkäufer gemeldete Nichtzahlung. KEINE Feststellung des Systems: Ohne '
  'Stripe Connect kassiert der Verkäufer selbst, Berkat sieht die Zahlung nie. '
  'Nicht oeffentlich - lesbar nur fuer Betroffenen und Meldenden.';

-- ─── 2. Wie lange ein Strike zählt ───────────────────────────────────────────
--
-- Zwölf Monate, wie bei eBay. ⚠️ Eine Sperre ohne Verfall wäre lebenslang für
-- ein einmaliges Versäumnis — und die häufigste Ursache ist kein Betrug,
-- sondern ein vergessener Abend.
CREATE OR REPLACE FUNCTION public.berkat_unpaid_count(p_user uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int
    FROM public.berkat_unpaid_strikes s
   WHERE s.buyer_id = p_user
     AND s.reported_at > now() - INTERVAL '12 months';
$$;

REVOKE ALL ON FUNCTION public.berkat_unpaid_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.berkat_unpaid_count(uuid) TO authenticated, service_role;

-- ─── 3. Melden ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_unpaid_buyer(p_auction_id uuid, p_note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a   public.live_auctions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_a FROM public.live_auctions WHERE id = p_auction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_a.seller_id <> v_uid THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;
  IF v_a.status <> 'sold' OR v_a.winner_id IS NULL THEN
    RAISE EXCEPTION 'not_sold' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ Die Frist. `settled_at` ist der Zuschlag; ohne ihn (Altzeile) zählt
  -- `created_at`, damit die Prüfung nie ins Leere greift und dann durchlässt.
  IF COALESCE(v_a.settled_at, v_a.created_at) > now() - INTERVAL '48 hours' THEN
    RAISE EXCEPTION 'too_early' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ Ein bezahlter Zuschlag kann nicht unbezahlt sein. Bei Verkäufern MIT
  -- Kasse weiss Berkat es nämlich doch — und dann gilt die Datenbank, nicht die
  -- Meldung. Ohne diese Zeile könnte ein Verkäufer einen Käufer melden, der
  -- nachweislich über Stripe gezahlt hat.
  IF EXISTS (
    SELECT 1
      FROM public.product_orders o
     WHERE o.cart_id = v_a.cart_id
       AND v_a.cart_id IS NOT NULL
       AND o.payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'already_paid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.berkat_unpaid_strikes (auction_id, buyer_id, seller_id, note)
  VALUES (p_auction_id, v_a.winner_id, v_uid, NULLIF(btrim(coalesce(p_note, '')), ''))
  -- Zweimal melden ist kein Fehlverhalten, sondern ein doppelter Finger.
  ON CONFLICT (auction_id) DO NOTHING;

  RETURN public.berkat_unpaid_count(v_a.winner_id);
END $$;

REVOKE ALL ON FUNCTION public.report_unpaid_buyer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_unpaid_buyer(uuid, text) TO authenticated;

-- ─── 4. Zurücknehmen ─────────────────────────────────────────────────────────
--
-- ⚠️ Dieser Weg ist keine Zugabe. Ohne ihn wäre jede Fehlmeldung endgültig, und
-- verspätete Zahlung ist der häufigste Fall überhaupt.
CREATE OR REPLACE FUNCTION public.withdraw_unpaid_report(p_auction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.berkat_unpaid_strikes
   WHERE auction_id = p_auction_id
     AND seller_id = v_uid;
END $$;

REVOKE ALL ON FUNCTION public.withdraw_unpaid_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_unpaid_report(uuid) TO authenticated;

-- ─── 5. Die Folge ────────────────────────────────────────────────────────────
--
-- Drei gültige Strikes → kein Gebot mehr. Dieselbe Zahl wie bei eBay, und aus
-- demselben Grund: Einer ist ein Versehen, zwei ein Muster, drei eine
-- Entscheidung.
--
-- ⚠️ **Derselbe Flaschenhals wie die Altersschranke** (`20260825120000`):
-- `live_bids` ist die Tabelle, durch die Gebot, Max-Gebot, Sofortkauf und der
-- eingelöste Preisvorschlag alle müssen.
--
-- ⚠️ ZWEI Trigger auf demselben Ereignis — und das ist hier KEIN Wettlauf
-- (Übergabe 73, „Zwei Trigger auf demselben Ereignis sind kein doppelter
-- Boden"). Die Warnung dort galt zwei Triggern, die BEIDE SCHREIBEN und sich
-- gegenseitig für den anderen hielten. Diese zwei prüfen nur und werfen; sie
-- schreiben nichts, ihre Reihenfolge ist gleichgültig, und keiner sieht den
-- anderen. Getrennt bleiben sie, weil sie verschiedene Dinge sagen: „zu jung"
-- und „zu oft nicht gezahlt" sind zwei Auskünfte, und eine gemeinsame Meldung
-- wäre für beide falsch.
CREATE OR REPLACE FUNCTION public.guard_unpaid_strikes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.berkat_unpaid_count(NEW.bidder_id) >= 3 THEN
    RAISE EXCEPTION 'too_many_unpaid' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

ALTER FUNCTION public.guard_unpaid_strikes() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_unpaid_strikes ON public.live_bids;
CREATE TRIGGER trg_unpaid_strikes
  BEFORE INSERT ON public.live_bids
  FOR EACH ROW EXECUTE FUNCTION public.guard_unpaid_strikes();

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1 · Ein Fremder meldet → `not_owner` (42501).
-- 2 · Der Verkäufer meldet nach zwei Stunden → `too_early` (22023).
-- 3 · Der Verkäufer meldet nach 48 h → geht durch, Zähler auf 1.
-- 4 · Nochmal melden → geht durch, Zähler bleibt 1 (ON CONFLICT).
-- 5 · Zurücknehmen → Zähler wieder 0.
-- 6 · Drei Strikes → das nächste Gebot scheitert mit `too_many_unpaid`.
-- 7 · Einer davon älter als 12 Monate → Gebot geht wieder durch.
-- 8 · ⚠️ Ein über Stripe BEZAHLTER Zuschlag lässt sich nicht melden
--     (`already_paid`). Die Probe, die man vergisst — sie schützt den Käufer
--     davor, für etwas gemeldet zu werden, das die Datenbank besser weiss.
-- 9 · Ein Dritter liest `berkat_unpaid_strikes` → null Zeilen (kein Pranger).
-- ─────────────────────────────────────────────────────────────────────────────
