-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Stale Live Session Cleanup via pg_cron
-- Datum: 2026-04-15
--
-- Ruft alle 5 Minuten die cleanup-stale-lives Edge Function auf
-- um hängende Live-Sessions automatisch zu beenden.
--
-- Voraussetzung: pg_cron Extension muss aktiviert sein
-- (Supabase Dashboard → Database → Extensions → pg_cron)
-- ══════════════════════════════════════════════════════════════════════════════

-- pg_cron aktivieren (falls nicht schon aktiv)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Bestehenden Job entfernen falls vorhanden
SELECT cron.unschedule('cleanup-stale-live-sessions')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-live-sessions'
);

-- Job alle 5 Minuten starten
SELECT cron.schedule(
  'cleanup-stale-live-sessions',
  '*/5 * * * *',  -- alle 5 Minuten
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/cleanup-stale-lives',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Alternativ: Direktes SQL ohne HTTP (schneller, kein Function-Overhead)
-- Dieser Job läuft zusätzlich als Backup direkt in der DB:
SELECT cron.schedule(
  'cleanup-stale-lives-sql',
  '*/5 * * * *',
  $$
    UPDATE public.live_sessions
    SET
      status       = 'ended',
      ended_at     = NOW(),
      viewer_count = 0
    WHERE
      status     = 'active'
      AND updated_at < NOW() - INTERVAL '10 minutes';
  $$
);

DO $$ BEGIN
  RAISE NOTICE '✅ pg_cron Job "cleanup-stale-lives-sql" registriert (alle 5 Min)';
END $$;
