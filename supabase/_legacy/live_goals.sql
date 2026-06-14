-- ── LIVE Goals System ─────────────────────────────────────────────────────────
-- Host kann ein Ziel für den Stream setzen (z.B. "50 Roses → ich tanze").
-- Viewer sehen den Fortschritt live als Balken.

ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS goal_type    text    CHECK (goal_type IN ('gift_value', 'likes')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS goal_target  integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS goal_current integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_title   text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS goal_reached boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN live_sessions.goal_type IS
  'Art des Ziels: gift_value = Münzwert aller Geschenke, likes = Like-Zähler';
COMMENT ON COLUMN live_sessions.goal_target IS
  'Zielwert den der Host erreichen möchte (z.B. 500 Coins oder 1000 Likes)';
COMMENT ON COLUMN live_sessions.goal_current IS
  'Aktueller Fortschritt (wird live aktualisiert)';
COMMENT ON COLUMN live_sessions.goal_title IS
  'Was der Host als Belohnung verspricht (z.B. "Ich tanze 30 Sek")';
COMMENT ON COLUMN live_sessions.goal_reached IS
  'true wenn goal_current >= goal_target errreicht wurde';
