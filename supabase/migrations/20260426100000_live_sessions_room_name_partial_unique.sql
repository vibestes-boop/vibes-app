-- v1.w.UI.36 — Persistent WHIP-Ingress: room_name darf über mehrere Sessions
-- hinweg wiederverwendet werden (jeder neue Stream = neue Row, gleicher room_name).
--
-- Vorher: UNIQUE (room_name) — blockiert zweite Session mit gleichem room_name.
-- Neu:    Partial-UNIQUE (room_name) WHERE status = 'active' — nur eine aktive
--         Session pro Room gleichzeitig, beendete Sessions können denselben
--         room_name teilen (historische Aufzeichnung).

-- Alten Full-Unique-Constraint entfernen (falls vorhanden)
ALTER TABLE live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_room_name_key;

-- Partial-Unique-Index: verhindert zwei gleichzeitig aktive Sessions im gleichen Room
CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_room_name_active_unique
  ON live_sessions (room_name)
  WHERE status = 'active';
