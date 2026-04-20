-- Migration: live_sessions — allow_comments + allow_gifts Columns
-- Hinzugefügt damit Host vor dem Stream einstellen kann ob
-- Kommentare und Geschenke erlaubt sind.
-- WARN 6 Fix: Bisher wurden diese Toggles in start.tsx angezeigt aber nie gespeichert.

ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_gifts    BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN live_sessions.allow_comments IS
  'Host-Einstellung: ob Zuschauer während des Livestreams kommentieren dürfen';
COMMENT ON COLUMN live_sessions.allow_gifts IS
  'Host-Einstellung: ob Zuschauer virtuelle Geschenke (Coins) senden dürfen';
