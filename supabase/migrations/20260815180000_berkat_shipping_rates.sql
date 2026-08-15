-- Berkat: Versandpauschalen
--
-- WARUM ES DAS BRAUCHT
-- Bis heute wurde **gar kein Versand berechnet**: `checkout_auction_cart`
-- schreibt `amount_eur` als reine Summe der Zuschläge, und
-- `create-checkout-session` setzt für Berkat keine `shipping_options`. Im
-- Live-Raum steht unter jedem Artikel trotzdem „Versand und Steuern kommen
-- dazu". Solange Zaur selbst verkauft, zahlt er es aus eigener Tasche; beim
-- ersten fremden Verkäufer wäre es ein Streit.
--
-- DAS MODELL
-- Eine Pauschale **pro Paket**, nicht pro Artikel. Genau dafür gibt es den
-- Sammelkorb: Drei Zuschläge beim selben Verkäufer sind eine Sendung und
-- deshalb einmal Versand. Ohne das ist eine 5-€-Auktion unmöglich, weil der
-- Versand teurer wäre als die Ware.
--
-- **Pro Zone**, weil ein Paket nach Zürich real das Doppelte kostet.
--
-- **Pro Verkäufer, mit Plattform-Vorgabe als Rückfall** (`seller_id IS NULL`).
-- Heute setzt die Plattform einen Wert; ab dem ersten Drittverkäufer setzt
-- jeder seinen eigenen — ohne dass an Tabelle, RPC oder Kasse etwas umgebaut
-- werden muss. Das ist der eigentliche Grund für diese Form: Die Spalte jetzt
-- mitzunehmen kostet nichts, sie später nachzurüsten hieße, den Geldweg ein
-- zweites Mal anzufassen.
--
-- WAS DIESE MIGRATION NOCH NICHT TUT
-- Sie legt Tabelle, Sätze und die Abfrage an — **die Kasse zieht noch nichts
-- ein**. Das ist Absicht: Der Schritt in `create-checkout-session` und
-- `stripe-webhook` ist ein Eingriff in den Geldweg BEIDER Apps und gehört in
-- eine eigene, einzeln zurücknehmbare Änderung.

BEGIN;

-- ─── 1. Die Sätze ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.berkat_shipping_rates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = Vorgabe der Plattform. Ein Eintrag mit `seller_id` schlägt sie.
  seller_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  country          text NOT NULL CHECK (country IN ('DE', 'AT', 'CH')),
  label            text NOT NULL CHECK (char_length(trim(label)) BETWEEN 3 AND 60),
  cents            integer NOT NULL CHECK (cents >= 0 AND cents <= 100000),
  -- Ab diesem Warenwert versandkostenfrei. Bleibt vorerst leer — das ist ein
  -- Versprechen, das jemand bezahlen muss.
  free_from_cents  integer CHECK (free_from_cents IS NULL OR free_from_cents > 0),
  sort_index       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Je Zone genau ein Plattform-Satz und je Verkäufer genau einer.
--
-- Zwei Teil-Indizes statt `UNIQUE NULLS NOT DISTINCT`: Letzteres gibt es erst
-- ab Postgres 15, und diese Migration soll auch auf einer älteren Kopie der
-- Datenbank laufen.
CREATE UNIQUE INDEX IF NOT EXISTS idx_berkat_shipping_platform
  ON public.berkat_shipping_rates (country) WHERE seller_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_berkat_shipping_seller
  ON public.berkat_shipping_rates (seller_id, country) WHERE seller_id IS NOT NULL;

ALTER TABLE public.berkat_shipping_rates ENABLE ROW LEVEL SECURITY;

-- Lesen darf jeder: Der Käufer muss vor dem Bieten wissen, was der Versand
-- kostet. Ein Versandpreis ist kein Geheimnis, sondern eine Preisangabe —
-- ihn zu verstecken wäre nach § 312a BGB sogar angreifbar.
DROP POLICY IF EXISTS "berkat_shipping_read" ON public.berkat_shipping_rates;
CREATE POLICY "berkat_shipping_read" ON public.berkat_shipping_rates
  FOR SELECT TO anon, authenticated USING (true);

-- Schreiben nur der Verkäufer für sich selbst. Die Plattform-Zeilen
-- (`seller_id IS NULL`) kann über den Client NIEMAND anfassen — sie sind der
-- Rückfall für alle und gehören in eine Migration, nicht in eine App.
DROP POLICY IF EXISTS "berkat_shipping_write_own" ON public.berkat_shipping_rates;
CREATE POLICY "berkat_shipping_write_own" ON public.berkat_shipping_rates
  FOR ALL TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE OR REPLACE FUNCTION public.berkat_shipping_rates_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_berkat_shipping_touch ON public.berkat_shipping_rates;
CREATE TRIGGER trg_berkat_shipping_touch
  BEFORE UPDATE ON public.berkat_shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.berkat_shipping_rates_touch();

-- ─── 2. Vorgabe der Plattform ────────────────────────────────────────────────
-- Startwerte, bewusst konservativ: DE als Standardpaket, AT/CH als Ausland.
-- `free_from_cents` bleibt leer, siehe oben.
INSERT INTO public.berkat_shipping_rates (seller_id, country, label, cents, sort_index)
VALUES
  (NULL, 'DE', 'Versand innerhalb Deutschlands',  490, 1),
  (NULL, 'AT', 'Versand nach Österreich',         990, 2),
  (NULL, 'CH', 'Versand in die Schweiz',          990, 3)
ON CONFLICT DO NOTHING;

-- ─── 3. Was ein Korb an Versand kostet ───────────────────────────────────────
-- Gibt je Zone eine Zeile zurück — daraus baut die Kasse später ihre
-- `shipping_options`, und die App zeigt sie vorher an.
--
-- `SECURITY DEFINER`, weil die Funktion über `auction_carts` und
-- `live_auctions` liest; der Aufrufer soll dafür keine eigenen Rechte
-- brauchen. Der Korb wird nicht auf Besitz geprüft: Herausgegeben werden nur
-- Versandpreise, und die sind ohnehin öffentlich.
CREATE OR REPLACE FUNCTION public.get_cart_shipping_options(p_cart_id uuid)
RETURNS TABLE(country text, label text, cents integer, free boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_seller uuid;
  v_goods  integer;
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

  RETURN QUERY
  -- Der Satz des Verkäufers schlägt die Vorgabe der Plattform. `DISTINCT ON`
  -- mit der Sortierung „seller_id zuerst" wählt je Zone genau einen.
  SELECT DISTINCT ON (r.country)
         r.country,
         r.label,
         CASE WHEN r.free_from_cents IS NOT NULL AND v_goods >= r.free_from_cents
              THEN 0 ELSE r.cents END,
         (r.free_from_cents IS NOT NULL AND v_goods >= r.free_from_cents)
    FROM public.berkat_shipping_rates r
   WHERE r.seller_id = v_seller OR r.seller_id IS NULL
   ORDER BY r.country, (r.seller_id IS NULL), r.sort_index;
END $$;

REVOKE ALL ON FUNCTION public.get_cart_shipping_options(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cart_shipping_options(uuid) TO authenticated;

-- ─── 4. Platz für den Betrag an der Bestellung ───────────────────────────────
-- Getrennt vom Warenwert, nicht hineingerechnet. Bei Stripe Connect bekommt der
-- Verkäufer die Ware und der Versand wird anders verrechnet — wer beides
-- zusammenaddiert, muss es dann wieder auseinanderpflücken.
ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS shipping_cents integer NOT NULL DEFAULT 0;

-- Vorsichtshalber, wegen der Falle vom 14.08.2026 (spaltenweises REVOKE macht
-- jede später hinzugefügte Spalte für die Clients unsichtbar). Für
-- `product_orders` ist kein solches REVOKE bekannt; steht ein Tabellen-Recht,
-- ist die Zeile wirkungslos und schadet nicht.
GRANT SELECT (shipping_cents) ON public.product_orders TO anon, authenticated;

COMMIT;

-- ─── Der nächste Schritt, bewusst NICHT hier drin ────────────────────────────
-- Damit tatsächlich Versand eingezogen wird, fehlen drei Dinge:
--
--   1. `create-checkout-session`: im Berkat-Zweig `shipping_options` aus
--      `get_cart_shipping_options` setzen. ⚠️ `stripeKey` ist in der Datei
--      NICHT auf Modulebene deklariert — den Schlüssel im eigenen Zweig selbst
--      holen, sonst ReferenceError und HTTP 500 (HANDOFF Abschnitt 3).
--   2. `stripe-webhook`: `total_details.amount_shipping` nach
--      `product_orders.shipping_cents` schreiben. ⚠️ Deploy zwingend mit
--      `--no-verify-jwt`, sonst antwortet der Endpunkt mit 401 und JEDE
--      Zahlung bleibt still unbestätigt.
--   3. App: Versand im Korb anzeigen, BEVOR jemand auf „bezahlen" tippt — und
--      den Satz „Versand und Steuern kommen dazu" im Live-Raum auf die
--      Wahrheit bringen.
--
-- Bis dahin ändert sich für Käufer nichts: Die Sätze stehen da, werden aber
-- von niemandem gelesen.
