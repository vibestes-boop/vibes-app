-- ─────────────────────────────────────────────────────────────────────────────
-- reschedule_preorder_round — verlängert/verschiebt die Deadline einer laufenden
-- Runde, ohne sie zu schließen und neu zu erstellen. Grund: Bisher konnte man in
-- der App nur „Schließen" oder „Neu starten" — eine abgelaufene closes_at ließ
-- sich nur per SQL heilen (Vorfall 16.7.: Fireside-Deadline 12 Tage abgelaufen).
--
-- Gate identisch zu close_preorder_round: nur Verkäufer der Runde ODER Admin.
-- Neues Datum muss in der Zukunft liegen; Runde muss noch offen sein.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reschedule_preorder_round(
  p_round_id  uuid,
  p_closes_at timestamptz
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
  IF p_closes_at IS NULL OR p_closes_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_date');
  END IF;

  SELECT * INTO v_round FROM preorder_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'round_not_found');
  END IF;
  IF v_round.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'round_not_open');
  END IF;
  IF v_round.seller_id <> v_uid AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_seller');
  END IF;

  UPDATE preorder_rounds
    SET closes_at = p_closes_at
    WHERE id = p_round_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_preorder_round(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_preorder_round(uuid, timestamptz) TO authenticated;
