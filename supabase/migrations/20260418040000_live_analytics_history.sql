-- ================================================================
-- v1.17.0 — Creator Studio: Live-Analytics History
-- ================================================================
-- Aggregiert abgeschlossene Live-Sessions eines Hosts mit:
--   • Dauer, peak_viewers, gesendete Gifts (Coins + Diamonds)
--   • Kommentar-Count
--   • Battle-Ergebnis (W/L/D) + Gegnername (falls Battle war)
--
-- Wird vom Creator-Studio-Screen `/creator/live-history` angezeigt
-- und zeigt die letzten 30 Streams mit Trend-Chart (peak_viewers).
-- ================================================================

-- ─── View: creator_live_history ─────────────────────────────────
-- RLS gilt implizit über die zugrundeliegenden Tables; zusätzlich
-- filtern die Clients ohnehin auf host_id = auth.uid().
CREATE OR REPLACE VIEW public.creator_live_history AS
SELECT
  s.id                                               AS session_id,
  s.host_id,
  s.title,
  s.started_at,
  s.ended_at,
  GREATEST(
    0,
    EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))::INT
  )                                                  AS duration_secs,
  s.peak_viewers,
  s.status,

  -- Gift-Aggregation (join via room_name = live_session_id text)
  COALESCE(g.total_gift_coins, 0)                    AS total_gift_coins,
  COALESCE(g.total_gift_diamonds, 0)                 AS total_gift_diamonds,
  COALESCE(g.gift_count, 0)                          AS gift_count,

  -- Kommentar-Count
  COALESCE(c.comment_count, 0)                       AS comment_count,

  -- Battle-Ergebnis (falls Battle war)
  b.winner                                           AS battle_winner,
  b.host_score                                       AS battle_host_score,
  b.guest_score                                      AS battle_guest_score,
  b.guest_id                                         AS battle_opponent_id,
  p.username                                         AS battle_opponent_name,
  p.avatar_url                                       AS battle_opponent_avatar,

  -- Abgeleitetes W/L/D-Label aus Host-Sicht
  CASE
    WHEN b.winner IS NULL       THEN NULL
    WHEN b.winner = 'host'      THEN 'win'
    WHEN b.winner = 'guest'     THEN 'loss'
    WHEN b.winner = 'draw'      THEN 'draw'
  END                                                AS battle_result
FROM public.live_sessions s
LEFT JOIN (
  SELECT
    gt.live_session_id,
    SUM(gt.coin_cost)::BIGINT     AS total_gift_coins,
    SUM(gt.diamond_value)::BIGINT AS total_gift_diamonds,
    COUNT(*)::BIGINT              AS gift_count
  FROM public.gift_transactions gt
  GROUP BY gt.live_session_id
) g ON g.live_session_id = s.room_name
LEFT JOIN (
  SELECT
    lc.session_id,
    COUNT(*)::BIGINT AS comment_count
  FROM public.live_comments lc
  GROUP BY lc.session_id
) c ON c.session_id = s.id
LEFT JOIN public.live_battle_history b
       ON b.session_id = s.id
      AND b.host_id    = s.host_id
LEFT JOIN public.profiles p
       ON p.id = b.guest_id;

GRANT SELECT ON public.creator_live_history TO authenticated;

-- Comment: View erbt keine RLS-Checks vom Original — Clients MÜSSEN
-- weiterhin WHERE host_id = auth.uid() setzen. Ein Session-Row wird
-- öffentlich gelesen (live_sessions_select = true), aber Gift-
-- Aggregate sind nur auf Aggregat-Ebene vorhanden, keine PII.

DO $$
BEGIN
  RAISE NOTICE '✅ creator_live_history view deployed (v1.17.0)';
END $$;
