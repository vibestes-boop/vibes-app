-- ============================================================
-- Debug Gift RPC — Nur für Entwicklung/Testing
-- Erlaubt: Selbst-Geschenke, fehlende Empfänger
-- Debitiert echte Coins vom Wallet (echter Test)
-- ============================================================

CREATE OR REPLACE FUNCTION debug_send_gift(
  p_live_session_id TEXT,
  p_gift_id         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id    UUID := auth.uid();
  v_gift         gift_catalog%ROWTYPE;
  v_sender_coins INTEGER;
BEGIN
  -- Gift laden
  SELECT * INTO v_gift FROM gift_catalog WHERE id = p_gift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'gift_not_found');
  END IF;

  -- Sender Wallet prüfen (mit Lock)
  SELECT coins INTO v_sender_coins
  FROM coins_wallets
  WHERE user_id = v_sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_wallet');
  END IF;

  IF v_sender_coins < v_gift.coin_cost THEN
    RETURN jsonb_build_object(
      'error', 'insufficient_coins',
      'balance', v_sender_coins,
      'needed', v_gift.coin_cost
    );
  END IF;

  -- Coins vom Sender abziehen
  UPDATE coins_wallets
  SET
    coins        = coins - v_gift.coin_cost,
    total_gifted = total_gifted + v_gift.coin_cost,
    updated_at   = now()
  WHERE user_id = v_sender_id;

  -- Transaktion speichern (Sender = Empfänger für Debug)
  INSERT INTO gift_transactions
    (sender_id, recipient_id, live_session_id, gift_id, coin_cost, diamond_value)
  VALUES
    (v_sender_id, v_sender_id, p_live_session_id, p_gift_id, v_gift.coin_cost, v_gift.diamond_value);

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_sender_coins - v_gift.coin_cost,
    'gift', v_gift.name
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Nur authentifizierte User dürfen diese Funktion aufrufen
REVOKE ALL ON FUNCTION debug_send_gift FROM PUBLIC;
GRANT EXECUTE ON FUNCTION debug_send_gift TO authenticated;
