-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Creator Earnings Dashboard
-- Datum: 2026-04-14
-- RPCs:
--   1. get_creator_earnings    → Wallet + Einnahmen-Übersicht
--   2. get_creator_gift_history → Letzte Gifts empfangen
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Creator Earnings Übersicht ────────────────────────────────────────────
-- Gibt Wallet-Stand + Einnahmen im Zeitraum zurück
CREATE OR REPLACE FUNCTION public.get_creator_earnings(
  p_user_id  UUID,
  p_days     INT DEFAULT 28
)
RETURNS TABLE (
  diamonds_balance   BIGINT,   -- Aktueller Wallet-Stand (Diamonds = Creator-Coins)
  total_gifted       BIGINT,   -- Gesamtanzahl gesendeter Coins (all-time)
  period_gifts       BIGINT,   -- Gifts im Zeitraum (Anzahl Transaktionen)
  period_diamonds    BIGINT,   -- Diamonds verdient im Zeitraum
  top_gift_name      TEXT,     -- Beliebtestes Gift (Name)
  top_gift_emoji     TEXT,     -- Beliebtestes Gift (Emoji)
  top_gifter_name    TEXT      -- Top-Sender (Username)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  SELECT
    -- Wallet-Stand
    COALESCE((SELECT cw.diamonds FROM coins_wallets cw WHERE cw.user_id = p_user_id), 0)::BIGINT AS diamonds_balance,
    COALESCE((SELECT cw.total_gifted FROM coins_wallets cw WHERE cw.user_id = p_user_id), 0)::BIGINT AS total_gifted,

    -- Periode: Anzahl Gifts empfangen
    COUNT(gt.id)::BIGINT AS period_gifts,

    -- Periode: Diamonds verdient
    COALESCE(SUM(gt.diamond_value), 0)::BIGINT AS period_diamonds,

    -- Beliebtestes Gift im Zeitraum
    (
      SELECT gc.name FROM gift_transactions gt2
      JOIN gift_catalog gc ON gc.id = gt2.gift_id
      WHERE gt2.recipient_id = p_user_id AND gt2.created_at >= v_cutoff
      GROUP BY gc.id, gc.name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_gift_name,
    (
      SELECT gc.emoji FROM gift_transactions gt2
      JOIN gift_catalog gc ON gc.id = gt2.gift_id
      WHERE gt2.recipient_id = p_user_id AND gt2.created_at >= v_cutoff
      GROUP BY gc.id, gc.emoji
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_gift_emoji,

    -- Top-Sender Username
    (
      SELECT p.username FROM gift_transactions gt2
      JOIN profiles p ON p.id = gt2.sender_id
      WHERE gt2.recipient_id = p_user_id AND gt2.created_at >= v_cutoff
      GROUP BY p.id, p.username
      ORDER BY SUM(gt2.diamond_value) DESC
      LIMIT 1
    ) AS top_gifter_name

  FROM gift_transactions gt
  WHERE gt.recipient_id = p_user_id
    AND gt.created_at >= v_cutoff;
END;
$$;

-- ── 2. Gift-Historie (letzte Geschenke empfangen) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_creator_gift_history(
  p_user_id  UUID,
  p_limit    INT DEFAULT 10
)
RETURNS TABLE (
  gift_name     TEXT,
  gift_emoji    TEXT,
  diamond_value INTEGER,
  sender_name   TEXT,
  sender_avatar TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gc.name         AS gift_name,
    gc.emoji        AS gift_emoji,
    gt.diamond_value,
    p.username      AS sender_name,
    p.avatar_url    AS sender_avatar,
    gt.created_at
  FROM gift_transactions gt
  JOIN gift_catalog gc ON gc.id = gt.gift_id
  JOIN profiles p ON p.id = gt.sender_id
  WHERE gt.recipient_id = p_user_id
  ORDER BY gt.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Sicherheit: Nur für eigene Daten aufrufbar (User sieht nur seine Earnings)
REVOKE ALL ON FUNCTION public.get_creator_earnings(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_earnings(UUID, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_creator_gift_history(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_gift_history(UUID, INT) TO authenticated;
