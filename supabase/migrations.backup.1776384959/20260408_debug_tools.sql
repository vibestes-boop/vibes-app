-- ============================================================
-- Debug Tools — NUR für Entwicklung/Testing
-- add_test_coins: Fügt Test-Coins zum Wallet hinzu
-- SECURITY DEFINER → umgeht RLS (nur intern verwendbar)
-- ============================================================

CREATE OR REPLACE FUNCTION add_test_coins(
  p_user_id UUID,
  p_coins   INT DEFAULT 10000,
  p_diamonds INT DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO coins_wallets (user_id, coins, diamonds)
  VALUES (p_user_id, p_coins, p_diamonds)
  ON CONFLICT (user_id)
  DO UPDATE SET
    coins    = coins_wallets.coins + EXCLUDED.coins,
    diamonds = coins_wallets.diamonds + EXCLUDED.diamonds,
    updated_at = now();

  RETURN json_build_object(
    'success', true,
    'coins_added', p_coins,
    'diamonds_added', p_diamonds
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Nur authentifizierte User dürfen diese Funktion aufrufen
REVOKE ALL ON FUNCTION add_test_coins FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_test_coins TO authenticated;
