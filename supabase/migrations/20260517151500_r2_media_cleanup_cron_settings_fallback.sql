-- ================================================
-- R2 media cleanup cron
-- Processes r2_delete_queue through the r2-delete Edge Function.
-- Requires pg_cron + pg_net and app.settings.project_url/service_role_key.
-- ================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_service_role_key TEXT := COALESCE(
    NULLIF(current_setting('app.settings.service_role_key', TRUE), ''),
    NULLIF(current_setting('app.service_role_key', TRUE), '')
  );
  v_project_url TEXT := COALESCE(
    NULLIF(current_setting('app.settings.project_url', TRUE), ''),
    NULLIF(current_setting('app.supabase_url', TRUE), '')
  );
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not enabled; r2-delete-queue cron not scheduled';
    RETURN;
  END IF;

  PERFORM cron.unschedule('r2-delete-queue')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'r2-delete-queue');

  IF v_service_role_key IS NULL OR v_project_url IS NULL THEN
    RAISE NOTICE 'Missing project URL/service role DB settings; r2-delete-queue cron not scheduled';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'r2-delete-queue',
    '*/5 * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body    := jsonb_build_object('processQueue', true, 'limit', 100)
      );
      $cron$,
      v_project_url || '/functions/v1/r2-delete',
      v_service_role_key
    )
  );

  RAISE NOTICE 'r2-delete-queue cron scheduled every 5 minutes';
END $$;
