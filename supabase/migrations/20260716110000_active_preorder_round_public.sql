-- ─────────────────────────────────────────────────────────────────────────────
-- Web-Funnel: WhatsApp→Web-Neukunden (anonym!) landen auf serlo.ch/shop/[id],
-- sahen die laufende Sammelbestellungs-Runde aber NICHT — get_active_preorder_round
-- ist authenticated-only. Diese datensparsame Variante ist anon-tauglich.
--
-- Bewusst WEGGELASSEN gegenüber der eingeloggten RPC:
--   • participants (Usernamen/Avatare)  → Privacy: anonyme Besucher sehen keine
--     Klarnamen von Mitbestellern.
--   • me_joined                          → für anon irrelevant.
-- Zurück kommen nur aggregierte, unkritische Zahlen + öffentliche Produktdaten.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_active_preorder_round_public()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round  public.preorder_rounds%ROWTYPE;
  v_result jsonb;
BEGIN
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
    'product',           (
      SELECT jsonb_build_object(
        'id', p.id, 'title', p.title, 'cover_url', p.cover_url, 'price_eur', p.price_eur
      ) FROM products p WHERE p.id = v_round.product_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_preorder_round_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_preorder_round_public() TO anon, authenticated;
