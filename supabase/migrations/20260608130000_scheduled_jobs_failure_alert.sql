-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260608130000_scheduled_jobs_failure_alert.sql
-- Zweck: Benachrichtigung an den Autor wenn ein geplanter Post endgültig
--        fehlschlägt (status = 'failed', retries >= 3).
--
-- Trigger-Logik:
--   AFTER UPDATE ON scheduled_posts
--   Wenn status von != 'failed' → 'failed' wechselt:
--     → net.http_post an send-push-notification Edge Function
--     → Benachrichtigung an post.author_id
--
-- Abhängigkeiten:
--   - pg_net Extension (bereits in 20260415000000_cleanup_cron.sql registriert)
--   - Edge Function: supabase/functions/send-push-notification/index.ts
--   - app.settings.project_url + app.settings.service_role_key (via Supabase Config)
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Trigger-Funktion: Bei Fail → Push-Notification an Autor ──────────────────
CREATE OR REPLACE FUNCTION notify_scheduled_post_failure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url      TEXT := current_setting('app.settings.project_url',      TRUE);
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', TRUE);
  v_caption          TEXT;
  v_body             TEXT;
BEGIN
  -- Nur feuern wenn status auf 'failed' wechselt (nicht bei anderem Wechsel)
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status <> 'failed') THEN

    -- Kurze Beschreibung des fehlgeschlagenen Posts
    v_caption := COALESCE(
      LEFT(NEW.caption, 40),
      'Geplanter Post'
    );
    IF LENGTH(NEW.caption) > 40 THEN
      v_caption := v_caption || '…';
    END IF;

    -- Benachrichtigungs-Text
    v_body := format(
      '"%s" konnte nicht veröffentlicht werden. Öffne Creator Studio, um es erneut zu planen.',
      v_caption
    );

    -- pg_net verfügbar und Config gesetzt?
    IF v_project_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_project_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body    := jsonb_build_object(
          'userId', NEW.author_id,
          'title',  '⚠️ Post fehlgeschlagen',
          'body',   v_body,
          'data',   jsonb_build_object(
            'type',            'scheduled_post_failed',
            'scheduledPostId', NEW.id::text
          )
        )
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Permissions: nur authenticated darf nicht direkt aufrufen — SECURITY DEFINER reicht
REVOKE EXECUTE ON FUNCTION notify_scheduled_post_failure() FROM PUBLIC, anon;

-- ── Trigger anlegen (idempotent via DROP IF EXISTS) ───────────────────────────
DROP TRIGGER IF EXISTS trg_scheduled_post_failure_alert ON public.scheduled_posts;

CREATE TRIGGER trg_scheduled_post_failure_alert
  AFTER UPDATE OF status ON public.scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION notify_scheduled_post_failure();

-- ── Kommentar für Dokumentation ────────────────────────────────────────────────
COMMENT ON TRIGGER trg_scheduled_post_failure_alert ON public.scheduled_posts
  IS 'Sendet Push-Notification an Autor wenn ein geplanter Post endgültig fehlschlägt (status → failed nach 3 Versuchen). Nutzt send-push-notification Edge Function via pg_net.';
