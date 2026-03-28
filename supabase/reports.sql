-- ============================================================
-- Tabelle: post_reports
-- Speichert Meldungen von Usern für Posts (Report / Kein Interesse)
-- ============================================================

CREATE TABLE IF NOT EXISTS post_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id      uuid NOT NULL REFERENCES posts(id)    ON DELETE CASCADE,
  reason       text NOT NULL CHECK (reason IN ('report', 'not_interested')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (reporter_id, post_id, reason)
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_post_reports_post_id     ON post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_reporter_id ON post_reports(reporter_id);

-- RLS
ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY;

-- User darf eigene Reports anlegen
CREATE POLICY "user can insert own reports"
  ON post_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- User darf nur eigene Reports sehen
CREATE POLICY "user can read own reports"
  ON post_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Admins sehen alles (service_role bypasses RLS automatisch)
