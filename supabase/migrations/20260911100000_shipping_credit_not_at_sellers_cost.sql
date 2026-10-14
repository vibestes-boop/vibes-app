-- ═══════════════════════════════════════════════════════════════════════════
-- Berkat verschenkt nicht mehr den Versand eines Fremden
-- 11.09.2026 · Berkat · Übergabe Abschnitt 99, Komplikation 1
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WAS SCHIEFGEHT, SOBALD DER ZWEITE VERKÄUFER DA IST
-- --------------------------------------------------
-- `get_cart_shipping_options_for_checkout` löst eine Einladungs-Gutschrift ein
-- und gibt danach **alle Versandzonen zu 0** aus. Solange der Betreiber der
-- einzige Verkäufer war, war das sein eigenes Geschenk aus seiner eigenen
-- Tasche — folgenlos.
--
-- Seit `20260827100000` läuft die Zahlung bei verbundenen Verkäufern aber
-- direkt auf **deren** Stripe-Konto. Dieselbe Zeile verschenkt damit den
-- Versand eines Fremden, und es gibt keinen Mechanismus, der ihm das erstattet
-- — eine Erstattung wäre Geldweiterleitung und damit genau die ZAG-Schranke,
-- um die der ganze Connect-Umbau herumgebaut wurde.
--
-- ⚠️ **Ein Werbegeschenk darf nur aus der eigenen Tasche kommen.**
--
-- ── DIE REGEL ───────────────────────────────────────────────────────────────
--
--   Verkäufer OHNE verbundenes Konto  →  alles wie bisher. Das Geld ist das des
--                                        Betreibers, er darf es verschenken.
--
--   Verkäufer MIT verbundenem Konto   →  keine Gutschrift. Der Käufer behält
--                                        sie und löst sie beim nächsten Korb
--                                        ein.
--
-- Das ist **kein Verfall**: Die Zeile in `berkat_shipping_credits` bleibt
-- unangetastet (`consumed_at IS NULL`), und eine etwaige Reservierung auf genau
-- diesen Korb wird sogar wieder gelöst. Sonst hinge die Gutschrift für immer an
-- einem Korb, auf den sie nie angewendet wird.
--
-- Bewusst **keine Fehlermeldung und kein Hinweis** — dasselbe stille Verhalten
-- wie beim Mindestwarenwert eine Zeile weiter unten. Eine Kasse, die sich wegen
-- eines Bonus nicht öffnet, wäre der teuerste denkbare Tausch.
--
-- ── UMKEHRBAR ───────────────────────────────────────────────────────────────
-- Sobald Provision fließt (Übergabe 96, Phase „danach"), hat die Plattform eine
-- eigene Einnahme, aus der sie den Versand bezahlen kann. Dann fällt der
-- `v_seller_connected`-Zweig wieder weg — oder er bucht die Gutschrift gegen
-- die Provision. Bis dahin gilt: nichts verschenken, was einem nicht gehört.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_cart_shipping_options_for_checkout(p_cart_id uuid)
RETURNS TABLE(country text, label text, cents integer, free boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_buyer  uuid;
  v_seller uuid;
  v_goods  integer;
  v_credit uuid;
  v_min    integer;
  v_seller_connected boolean;
BEGIN
  SELECT c.buyer_id, c.seller_id INTO v_buyer, v_seller
    FROM public.auction_carts c
   WHERE c.id = p_cart_id;

  IF v_seller IS NULL THEN
    RETURN;  -- kein Korb, keine Sätze — wie in der STABLE-Schwester
  END IF;

  -- ⚠️ NEU (11.09.2026): Kassiert der Verkäufer selbst, geht jede Gutschrift zu
  -- SEINEN Lasten. `charges_enabled` ist dabei die richtige Grenze, nicht
  -- „Zeile vorhanden" — dieselbe Bedingung, unter der
  -- `create-checkout-session` die `Stripe-Account`-Kopfzeile setzt. Ein Konto
  -- im Onboarding kassiert noch nicht, dort zahlt weiter der Betreiber.
  SELECT COALESCE(st.charges_enabled, false) INTO v_seller_connected
    FROM public.berkat_seller_stripe st
   WHERE st.user_id = v_seller;
  v_seller_connected := COALESCE(v_seller_connected, false);

  -- Der Warenwert steht VOR der Gutschrift-Auswahl, weil er darüber
  -- mitentscheidet.
  SELECT COALESCE(SUM(a.current_bid_cents), 0) INTO v_goods
    FROM public.live_auctions a
   WHERE a.cart_id = p_cart_id AND a.status = 'sold';

  IF v_seller_connected THEN
    -- Eine früher reservierte Gutschrift wieder freigeben. Ohne das bliebe sie
    -- an einem Korb hängen, auf den sie nie angewendet wird — der Käufer hätte
    -- sie faktisch verloren, ohne dass sie je gewirkt hat.
    UPDATE public.berkat_shipping_credits
       SET reserved_cart_id = NULL
     WHERE reserved_cart_id = p_cart_id
       AND consumed_at IS NULL;
    v_credit := NULL;
  ELSE
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
    -- den Code ein und testet mit EINEM Artikel für 1 €. Rechnung im Kopf von
    -- `20260816130000`.
    --
    -- Bewusst KEINE Fehlermeldung, sondern schlicht keine Reservierung: Die
    -- Gutschrift bleibt dem Käufer erhalten und greift beim nächsten, größeren
    -- Korb.
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
  END IF;

  -- Ab hier unverändert. Der Gratis-ab-Betrag (`free_from_cents`) bleibt auch
  -- bei verbundenen Verkäufern gültig: Den legt der VERKÄUFER selbst in
  -- `berkat_shipping_rates` fest — es ist sein Angebot, nicht Berkats Geschenk.
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
   ORDER BY r.country, (r.seller_id IS NULL), r.sort_index;
END $$;

-- ⚠️ CREATE OR REPLACE behält Grants nicht über alle Postgres-Versionen
-- garantiert — deshalb hier noch einmal ausdrücklich wie in `20260816130000`.
REVOKE ALL ON FUNCTION public.get_cart_shipping_options_for_checkout(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cart_shipping_options_for_checkout(uuid) TO service_role;

COMMIT;
