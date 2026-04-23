-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — AI-Image pg_cron Jobs (Vault-basierte Auth) — FOLLOW-UP MIGRATION
-- Datum: 2026-04-23
--
-- Ersetzt die Jobs aus 20260423210000_ai_image_crons.sql durch Vault-basierte
-- Varianten. Grund: auf Managed-Supabase sind `ALTER DATABASE … SET app.*` und
-- `ALTER ROLE … SET app.*` blockiert (42501: must be owner/superuser), deshalb
-- kann `current_setting('app.supabase_url')` dort nicht aufgelöst werden und
-- pg_cron schlug silent fehl (url := NULL, has_key := false).
--
-- Lösung: URL wird hardcoded (Projekt-ID stabil, kein Secret), das
-- Service-Role-Token kommt via `vault.decrypted_secrets`-Lookup zur Laufzeit.
--
-- Voraussetzung (einmal via SQL-Editor oder Dashboard → Settings → Vault):
--   INSERT INTO vault.secrets (name, secret)
--     VALUES ('service_role_key', '<service-role-jwt>')
--     ON CONFLICT (name) DO UPDATE SET secret = excluded.secret;
--
-- Diese Migration:
--   • Entfernt alte Jobs (idempotent)
--   • Schedulet beide Jobs neu mit Vault-Lookup
--   • Ist selbst idempotent — Re-Run ist safe
--
-- Prod-State per 2026-04-23: via SQL-Editor bereits so gesetzt + Smoke-Test
-- grün (`{"ok":true,"skipped":"no_activity",...}`). Diese Migration bringt
-- Git in Sync mit der Prod-DB, damit Fresh-Setups den korrekten Zustand erben.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Daily Report (08:00 UTC) ──────────────────────────────────────────────────
SELECT cron.unschedule('ai-image-daily-report')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-image-daily-report');

SELECT cron.schedule(
  'ai-image-daily-report',
  '0 8 * * *',  -- jeden Tag 08:00 UTC
  $$
    SELECT net.http_post(
      url     := 'https://llymwqfgujwkoxzqxrlm.supabase.co/functions/v1/ai-image-daily-report',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
          LIMIT 1
        )
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ── Weekly Retention (So 03:00 UTC) ───────────────────────────────────────────
SELECT cron.unschedule('ai-image-retention-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-image-retention-weekly');

SELECT cron.schedule(
  'ai-image-retention-weekly',
  '0 3 * * 0',  -- Sonntags 03:00 UTC
  $$
    SELECT net.http_post(
      url     := 'https://llymwqfgujwkoxzqxrlm.supabase.co/functions/v1/ai-image-retention',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
          LIMIT 1
        )
      ),
      body    := '{}'::jsonb
    );
  $$
);

DO $$ BEGIN
  RAISE NOTICE '✅ pg_cron (Vault): ai-image-daily-report (08:00 daily) + ai-image-retention-weekly (So 03:00) re-registriert';
END $$;
