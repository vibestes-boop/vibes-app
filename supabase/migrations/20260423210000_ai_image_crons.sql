-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — AI-Image pg_cron Jobs (Daily-Report + Weekly-Retention)
-- Datum: 2026-04-23
--
-- Schedulet die zwei Edge-Functions aus Phase 4 Safeguards via pg_cron:
--   • `ai-image-daily-report`  — täglich 08:00 UTC
--   • `ai-image-retention`     — wöchentlich So. 03:00 UTC
--
-- Voraussetzungen (gleiche wie bei `cleanup-stale-live-sessions`):
--   • pg_cron + pg_net Extensions aktiv
--   • app.supabase_url + app.service_role_key als DB-Settings gesetzt
--     (in Supabase via SQL: `ALTER DATABASE postgres SET app.supabase_url = '...'`
--      und entsprechend für service_role_key)
--
-- Beide Jobs sind idempotent gebaut — Re-Run der Migration entfernt alte
-- Jobs und legt frisch an.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Daily Report ──────────────────────────────────────────────────────────────
SELECT cron.unschedule('ai-image-daily-report')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-image-daily-report');

SELECT cron.schedule(
  'ai-image-daily-report',
  '0 8 * * *',  -- jeden Tag 08:00 UTC (≈ 09:00/10:00 CET je nach Sommerzeit)
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/ai-image-daily-report',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ── Weekly Retention ─────────────────────────────────────────────────────────
-- Sonntag 03:00 UTC — niedrige Traffic-Zeit, damit Storage-Deletes nicht mit
-- regulären Upload-Peaks konkurrieren. Batch-Limit 500 ist im Function-Code
-- parametrisiert, bei Bedarf via `RETENTION_LIMIT` Secret übersteuerbar.
SELECT cron.unschedule('ai-image-retention-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-image-retention-weekly');

SELECT cron.schedule(
  'ai-image-retention-weekly',
  '0 3 * * 0',  -- Sonntags 03:00 UTC
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/ai-image-retention',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

DO $$ BEGIN
  RAISE NOTICE '✅ pg_cron: ai-image-daily-report (08:00 daily) + ai-image-retention-weekly (So 03:00) registriert';
END $$;
