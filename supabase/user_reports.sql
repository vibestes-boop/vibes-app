-- ============================================================
-- Tabelle: user_reports
-- Speichert Meldungen für User-Profile (für Apple App Store Compliance)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'fake_account', 'other')),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, reported_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON public.user_reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON public.user_reports(reporter_id);

-- RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_reports_insert"
  ON public.user_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "user_reports_select_own"
  ON public.user_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Admins sehen alles via service_role (bypasses RLS automatisch)
