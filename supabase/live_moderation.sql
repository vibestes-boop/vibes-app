-- ── Live Chat Moderation ──────────────────────────────────────────────────────
-- Fügt Moderations-Einstellungen zur live_sessions Tabelle hinzu.
-- Host kann Moderation an-/ausschalten und eigene Wörter hinzufügen.

ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS moderation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_words    text[]  NOT NULL DEFAULT ARRAY[]::text[];

-- Index für schnelles Lesen der Moderation-Einstellungen
CREATE INDEX IF NOT EXISTS idx_live_sessions_moderation
  ON live_sessions (id)
  WHERE moderation_enabled = true;

-- Kommentar zur Dokumentation
COMMENT ON COLUMN live_sessions.moderation_enabled IS
  'Host-kontrollierter Chat-Filter: true = Kommentare werden gegen Wortliste geprüft';

COMMENT ON COLUMN live_sessions.moderation_words IS
  'Host-eigene geblockte Wörter (zusätzlich zur globalen App-Wortliste)';
