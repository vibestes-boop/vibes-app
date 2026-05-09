-- Live gift stream compatibility
--
-- The web live viewer uses the existing production gift model:
--   gift_catalog + gift_transactions + send_gift(...)
--
-- This policy lets viewers read gift events for live sessions that are visible
-- to them through live_sessions RLS, while keeping private spending history
-- protected outside that session context.

GRANT SELECT ON public.gift_transactions TO anon, authenticated;

DROP POLICY IF EXISTS "gift_tx_select_visible_live_session" ON public.gift_transactions;

CREATE POLICY "gift_tx_select_visible_live_session"
  ON public.gift_transactions
  FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR EXISTS (
      SELECT 1
      FROM public.live_sessions s
      WHERE s.id::text = gift_transactions.live_session_id
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'gift_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_transactions;
  END IF;
END $$;
