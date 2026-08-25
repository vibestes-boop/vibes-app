-- ─────────────────────────────────────────────────────────────────────────────
-- `report_unpaid_buyer` griff auf eine Spalte zu, die es nicht gibt
--
-- ── ⚠️ DER FEHLER, UND WIE ER DURCH DEN PRÜFSTAND KAM ───────────────────────
--
-- `20260825160000` prüft, ob ein Zuschlag schon bezahlt ist:
--
--     WHERE o.cart_id = v_a.cart_id AND o.payment_status = 'paid'
--
-- **`product_orders` hat keine Spalte `payment_status`.** Sie heisst `status`,
-- und der CHECK darauf kennt `reserved`, `payment_requested`, `paid`, `shipped`,
-- `delivered`, `cancelled`, `refunded`, `disputed`.
--
-- Die Funktion lief dadurch bei JEDEM Aufruf in
-- `42703 column o.payment_status does not exist` — und weil sie das erst zur
-- Laufzeit tut, war die Migration grün. Das ist wörtlich die Lehre vom
-- 24.08.2026 (Abschnitt 84): **„Migration läuft durch" heisst bei Funktionen
-- NICHT „Funktion läuft."**
--
-- ⚠️ **Und der Prüfstand hat den Fehler bestätigt statt ihn zu finden.** Neun
-- Proben liefen gegen echtes Postgres, alle bestanden — aber die Tabelle
-- `product_orders` darin war von mir GESCHRIEBEN, und ich habe sie mit
-- derselben erfundenen Spalte gebaut wie die Funktion. Ein Prüfstand, dessen
-- Schema aus demselben Kopf stammt wie der Code, prüft die Erinnerung des
-- Autors, nicht die Wirklichkeit.
--
-- > **Die Regel daraus: Tabellen für einen Prüfstand werden aus dem ABZUG
-- > kopiert, nicht aus dem Gedächtnis geschrieben.** `supabase/schema_live.sql`
-- > liegt im Repo; ein `grep` hätte gereicht.
--
-- ── ⚠️ UND `= 'paid'` WÄRE AUCH KORRIGIERT NOCH FALSCH ──────────────────────
--
-- Eine **versendete** Bestellung wurde ebenfalls bezahlt — der Status ist nur
-- weitergewandert. Ohne `shipped` und `delivered` liesse sich ein Käufer als
-- Nichtzahler melden, dessen Ware längst unterwegs ist. `useMyOrders.ts` fragt
-- aus demselben Grund seit jeher `status IN ('paid','shipped','delivered')`.
-- ─────────────────────────────────────────────────────────────────────────────

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

  IF COALESCE(v_a.settled_at, v_a.created_at) > now() - INTERVAL '48 hours' THEN
    RAISE EXCEPTION 'too_early' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ `status`, nicht `payment_status` — und drei Werte, nicht einer. Eine
  -- versendete oder zugestellte Bestellung wurde bezahlt; der Status ist nur
  -- weitergewandert. Dieselbe Liste wie in `useMyOrders.ts`.
  IF v_a.cart_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.product_orders o
     WHERE o.cart_id = v_a.cart_id
       AND o.status IN ('paid', 'shipped', 'delivered')
  ) THEN
    RAISE EXCEPTION 'already_paid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.berkat_unpaid_strikes (auction_id, buyer_id, seller_id, note)
  VALUES (p_auction_id, v_a.winner_id, v_uid, NULLIF(btrim(coalesce(p_note, '')), ''))
  ON CONFLICT (auction_id) DO NOTHING;

  RETURN public.berkat_unpaid_count(v_a.winner_id);
END $$;

REVOKE ALL ON FUNCTION public.report_unpaid_buyer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_unpaid_buyer(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1 · Die Spalte ist wirklich weg aus dem Rumpf:
--     SELECT prosrc LIKE '%payment_status%' AS falsche_spalte_noch_da
--       FROM pg_proc WHERE proname = 'report_unpaid_buyer';
--     → erwartet `false`
--
-- 2 · ⚠️ Die Probe, die beim ersten Mal gefehlt hat — ein echter Aufruf. Aus
--     der App auf einen Zuschlag, der älter als 48 Stunden ist. Erwartet:
--     entweder eine Zahl (gemeldet) oder `already_paid`. **Nicht** eine
--     Meldung über eine fehlende Spalte.
--
-- 3 · Ein über Stripe bezahlter Zuschlag → `already_paid`. Und einer, der
--     schon VERSENDET ist, ebenfalls — das war der zweite Teil des Fehlers.
-- ─────────────────────────────────────────────────────────────────────────────
