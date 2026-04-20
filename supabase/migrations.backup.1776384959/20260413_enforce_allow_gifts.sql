-- Migration: send_gift RPC + allow_gifts / allow_comments enforcement
-- Erweitert send_gift um Prüfung ob Geschenke für diese Session erlaubt sind.

CREATE OR REPLACE FUNCTION send_gift(
  p_recipient_id    uuid,
  p_live_session_id text,
  p_gift_id         text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_sender_id     uuid := auth.uid();
  v_gift          gift_catalog%rowtype;
  v_sender_coins  integer;
  v_gifts_allowed boolean;
BEGIN
  -- Gift laden
  SELECT * INTO v_gift FROM gift_catalog WHERE id = p_gift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'gift_not_found');
  END IF;

  -- allow_gifts prüfen: Host kann Geschenke deaktivieren
  SELECT COALESCE(allow_gifts, true)
    INTO v_gifts_allowed
    FROM live_sessions
   WHERE id = p_live_session_id::uuid;

  IF NOT v_gifts_allowed THEN
    RETURN jsonb_build_object('error', 'gifts_disabled');
  END IF;

  -- Sender kann nicht an sich selbst verschenken
  IF v_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('error', 'cannot_gift_yourself');
  END IF;

  -- Sender Wallet (mit Lock)
  SELECT coins INTO v_sender_coins
    FROM coins_wallets
   WHERE user_id = v_sender_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_wallet');
  END IF;

  IF v_sender_coins < v_gift.coin_cost THEN
    RETURN jsonb_build_object('error', 'insufficient_coins', 'balance', v_sender_coins);
  END IF;

  -- Coins vom Sender abziehen
  UPDATE coins_wallets
     SET coins        = coins        - v_gift.coin_cost,
         total_gifted = total_gifted + v_gift.coin_cost,
         updated_at   = now()
   WHERE user_id = v_sender_id;

  -- Diamonds an Creator gutschreiben
  INSERT INTO coins_wallets (user_id, diamonds, updated_at)
  VALUES (p_recipient_id, v_gift.diamond_value, now())
  ON CONFLICT (user_id) DO UPDATE
    SET diamonds   = coins_wallets.diamonds + v_gift.diamond_value,
        updated_at = now();

  -- Transaktion speichern
  INSERT INTO gift_transactions
    (sender_id, recipient_id, live_session_id, gift_id, coin_cost, diamond_value)
  VALUES
    (v_sender_id, p_recipient_id, p_live_session_id, p_gift_id, v_gift.coin_cost, v_gift.diamond_value);

  RETURN jsonb_build_object('success', true, 'new_balance', v_sender_coins - v_gift.coin_cost);
END;
$$;
