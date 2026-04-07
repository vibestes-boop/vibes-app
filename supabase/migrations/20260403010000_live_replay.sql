-- Live Replay: replay_url + is_replayable Spalten
-- Migration: 20260403_live_replay

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS replay_url      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_replayable   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replay_views    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thumbnail_url   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS category        TEXT    DEFAULT 'talk',
  ADD COLUMN IF NOT EXISTS peak_viewers    INTEGER NOT NULL DEFAULT 0;

-- Replay-URL setzen darf nur der Host selbst (host_id)
DROP POLICY IF EXISTS "Host kann replay_url setzen" ON public.live_sessions;
CREATE POLICY "Host kann replay_url setzen"
  ON public.live_sessions
  FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());
