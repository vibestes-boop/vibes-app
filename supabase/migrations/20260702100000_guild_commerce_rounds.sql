-- ─────────────────────────────────────────────────────────────────────────────
-- Guild-Commerce v1 — Sammelbestellungs-Runden (#3 aus der App-Karte)
--
-- Die „Runde" macht Zaurs realen Samstags-Zyklus (sammeln → beim Lieferanten
-- bestellen → Ware da → Zahlung) als Objekt sichtbar: Ziel-Menge, Deadline,
-- Fortschritt, Mitbesteller. Die Guild zeigt sie als „Jetzt aktiv"-Karte.
--
-- Bewusst minimal: KEIN neuer Kauf-Flow. Vorbestellen läuft weiter über
-- express_product_interest / product_preorders; die Runde ist nur eine
-- Klammer darüber. „Ware da → Zahlung" nutzt weiter mark_preorders_payable.
--
-- guild_id ist ab Tag 1 dabei, aber v1 immer NULL = Runde ist überall
-- sichtbar (Zaur ist der einzige Verkäufer). Pro-Guild-Runden = späterer
-- Ausbau ohne Schema-Änderung.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Runden-Tabelle
CREATE TABLE IF NOT EXISTS public.preorder_rounds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guild_id    uuid REFERENCES public.guilds(id) ON DELETE SET NULL,
  title       text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  target_qty  int  NOT NULL CHECK (target_qty BETWEEN 1 AND 9999),
  closes_at   timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'arrived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);

-- Nur EINE offene Runde pro Produkt (create_preorder_round schließt Vorgänger).
CREATE UNIQUE INDEX IF NOT EXISTS idx_preorder_rounds_one_open
  ON public.preorder_rounds (product_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_preorder_rounds_status
  ON public.preorder_rounds (status, created_at DESC);

ALTER TABLE public.preorder_rounds ENABLE ROW LEVEL SECURITY;

-- Lesen: alle eingeloggten (Karte ist öffentlich sichtbar). Schreiben: nur RPCs.
GRANT SELECT ON public.preorder_rounds TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.preorder_rounds FROM authenticated;
REVOKE ALL ON public.preorder_rounds FROM anon;

DROP POLICY IF EXISTS preorder_rounds_read ON public.preorder_rounds;
CREATE POLICY preorder_rounds_read ON public.preorder_rounds
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2) Runden-Zuordnung auf Vorbestellungen
ALTER TABLE public.product_preorders
  ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES public.preorder_rounds(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_preorders_round
  ON public.product_preorders (round_id) WHERE round_id IS NOT NULL;

-- Trigger: Jede Vorbestellung mit aktivem Kaufinteresse gehört zur gerade
-- offenen Runde ihres Produkts. Greift bei INSERT und beim Upsert-Reaktivieren
-- (Repeat-Kauf setzt dieselbe Zeile zurück auf 'interested' — der reine
-- INSERT-Trigger würde diesen Pfad verpassen). Keine offene Runde → NULL.
CREATE OR REPLACE FUNCTION public.assign_preorder_round()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_round uuid;
BEGIN
  IF NEW.status = 'interested' THEN
    SELECT id INTO v_round
      FROM public.preorder_rounds
      WHERE product_id = NEW.product_id AND status = 'open'
      ORDER BY created_at DESC LIMIT 1;
    NEW.round_id := v_round;  -- NULL wenn keine offene Runde
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_preorder_round ON public.product_preorders;
CREATE TRIGGER trg_assign_preorder_round
  BEFORE INSERT OR UPDATE OF status, quantity ON public.product_preorders
  FOR EACH ROW EXECUTE FUNCTION public.assign_preorder_round();

-- 3) RPC: Runde starten (Verkäufer des Produkts oder Admin)
CREATE OR REPLACE FUNCTION public.create_preorder_round(
  p_product_id uuid,
  p_target_qty int,
  p_closes_at  timestamptz,
  p_title      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_title   text;
  v_round   public.preorder_rounds%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;
  IF v_product.seller_id <> v_uid AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_seller');
  END IF;
  IF v_product.sale_mode IS DISTINCT FROM 'preorder' OR NOT v_product.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_preorder_product');
  END IF;
  IF p_target_qty IS NULL OR p_target_qty < 1 OR p_target_qty > 9999 THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_target');
  END IF;
  IF p_closes_at IS NULL OR p_closes_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_deadline');
  END IF;

  v_title := COALESCE(NULLIF(trim(p_title), ''), left('Sammelbestellung: ' || v_product.title, 80));

  -- Vorgänger-Runde still schließen (Unique-Index erlaubt nur eine offene).
  UPDATE preorder_rounds
    SET status = 'closed', closed_at = now()
    WHERE product_id = p_product_id AND status = 'open';

  INSERT INTO preorder_rounds (product_id, seller_id, title, target_qty, closes_at)
    VALUES (p_product_id, v_product.seller_id, v_title, p_target_qty, p_closes_at)
    RETURNING * INTO v_round;

  -- Bestehendes aktives Interesse adoptieren: Wer schon vorgemerkt hat,
  -- wartet auf genau diese Bestell-Runde → zählt ab Sekunde 1 im Fortschritt.
  UPDATE product_preorders
    SET round_id = v_round.id
    WHERE product_id = p_product_id AND status IN ('interested', 'notified');

  RETURN jsonb_build_object('success', true, 'round_id', v_round.id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_preorder_round(uuid, int, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_preorder_round(uuid, int, timestamptz, text) TO authenticated;

-- 4) RPC: Runde schließen ('closed' = Sammlung zu · 'arrived' = Ware da)
CREATE OR REPLACE FUNCTION public.close_preorder_round(
  p_round_id uuid,
  p_status   text DEFAULT 'closed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_round public.preorder_rounds%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_status NOT IN ('closed', 'arrived') THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_status');
  END IF;

  SELECT * INTO v_round FROM preorder_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'round_not_found');
  END IF;
  IF v_round.seller_id <> v_uid AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_seller');
  END IF;

  UPDATE preorder_rounds
    SET status = p_status, closed_at = COALESCE(closed_at, now())
    WHERE id = p_round_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.close_preorder_round(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_preorder_round(uuid, text) TO authenticated;

-- 5) RPC: Aktive Runde für die Guild-Karte — EIN Call liefert alles.
--    SECURITY DEFINER, weil Fortschritt über fremde product_preorders
--    aggregiert wird (RLS erlaubt Käufern nur die eigene Zeile).
--    Gibt NULL zurück wenn keine Runde offen ist → Karte bleibt weg.
CREATE OR REPLACE FUNCTION public.get_active_preorder_round()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_round public.preorder_rounds%ROWTYPE;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_round
    FROM preorder_rounds
    WHERE status = 'open'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'id',                v_round.id,
    'product_id',        v_round.product_id,
    'title',             v_round.title,
    'target_qty',        v_round.target_qty,
    'closes_at',         v_round.closes_at,
    'status',            v_round.status,
    'reserved_qty',      COALESCE((
      SELECT SUM(pp.quantity) FROM product_preorders pp
      WHERE pp.round_id = v_round.id AND pp.status <> 'cancelled'
    ), 0),
    'participant_count', COALESCE((
      SELECT COUNT(*) FROM product_preorders pp
      WHERE pp.round_id = v_round.id AND pp.status <> 'cancelled'
    ), 0),
    'me_joined',         EXISTS (
      SELECT 1 FROM product_preorders pp
      WHERE pp.round_id = v_round.id AND pp.user_id = v_uid AND pp.status <> 'cancelled'
    ),
    'participants',      COALESCE((
      SELECT jsonb_agg(jsonb_build_object('username', pr.username, 'avatar_url', pr.avatar_url))
      FROM (
        SELECT pp.user_id FROM product_preorders pp
        WHERE pp.round_id = v_round.id AND pp.status <> 'cancelled'
        ORDER BY pp.created_at DESC LIMIT 3
      ) latest
      JOIN profiles pr ON pr.id = latest.user_id
    ), '[]'::jsonb),
    'product',           (
      SELECT jsonb_build_object(
        'id', p.id, 'title', p.title, 'cover_url', p.cover_url, 'price_eur', p.price_eur
      ) FROM products p WHERE p.id = v_round.product_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_preorder_round() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_preorder_round() TO authenticated;
