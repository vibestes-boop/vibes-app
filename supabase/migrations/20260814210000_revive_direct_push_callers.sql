-- Zwei stumme Benachrichtigungen wiederbeleben.
--
-- BEFUND: `send-push-notification` hatte keinen einzigen funktionierenden
-- Aufrufer. Der notifications-Trigger geht seit dem 01.07.2026 über den SQL-Helfer
-- (Migration 20260701050000), und die beiden verbliebenen Aufrufer waren beide
-- kaputt — auf unterschiedliche Weise:
--
--  1. `publish-scheduled-posts` („Dein geplanter Post ist live") schickt
--     `{user_id, title, body, data}`. Die Function kannte nur `{record: {…}}`,
--     also war `record` undefined, der nächste Zugriff warf, der catch lieferte
--     500 — und der Aufrufer protokolliert nur („best effort"). Lautlos verloren.
--     Repariert in der Function selbst (Direktversand-Zweig), nicht hier.
--
--  2. `notify_scheduled_post_failure` („⚠️ Post fehlgeschlagen") ist Gegenstand
--     dieser Migration. Sie schickt HTTP an
--       current_setting('app.settings.project_url')
--     mit Bearer aus
--       current_setting('app.settings.service_role_key')
--     und beide sind LEER (am 14.08.2026 gegen die Live-DB geprüft: Länge 0).
--     Ihre eigene Bedingung `IF v_project_url IS NOT NULL AND v_service_role_key
--     IS NOT NULL` verhindert den Aufruf deshalb komplett — sie hat es nie auch
--     nur versucht. Zusätzlich schickte sie `userId` in CamelCase, was die
--     Function ohnehin nicht gelesen hätte.
--
-- LÖSUNG: Kein HTTP. `send_push_to_user()` liegt in derselben Datenbank, kennt
-- Mehrgeräte-Versand, App-Filter und das Aufräumen alter Tokens. Genau denselben
-- Schritt hat 20260701050000 für den notifications-Trigger gemacht — hier wird
-- der letzte verbliebene HTTP-Aufrufer nachgezogen.
--
-- Der Umweg über die Edge Function war ohnehin sinnlos: Sie hätte am Ende
-- dieselbe DB-Funktion gerufen, nur mit einem Netzwerk-Sprung und einem Token
-- dazwischen, das niemand gesetzt hat.
--
-- Text und Auslöse-Bedingung bleiben unverändert.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_scheduled_post_failure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_caption TEXT;
  v_body    TEXT;
BEGIN
  -- Nur feuern, wenn der Status auf 'failed' wechselt — nicht bei jedem UPDATE.
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status <> 'failed') THEN

    v_caption := COALESCE(LEFT(NEW.caption, 40), 'Geplanter Post');
    IF LENGTH(NEW.caption) > 40 THEN
      v_caption := v_caption || '…';
    END IF;

    v_body := format(
      '"%s" konnte nicht veröffentlicht werden. Öffne Creator Studio, um es erneut zu planen.',
      v_caption
    );

    -- Ein Push-Fehler darf das Markieren als 'failed' NIEMALS verhindern, sonst
    -- bliebe der Post in 'pending' hängen und der Cron versuchte es ewig weiter.
    -- Der alte HTTP-Weg war fire-and-forget und damit implizit geschützt; ein
    -- Direktaufruf ist es nicht, deshalb ausdrücklich.
    BEGIN
      PERFORM public.send_push_to_user(
        p_user_id := NEW.author_id,
        p_title   := '⚠️ Post fehlgeschlagen',
        p_body    := v_body,
        p_data    := jsonb_build_object(
          'type',            'scheduled_post_failed',
          'scheduledPostId', NEW.id::text
        ),
        -- Creator Studio ist eine Serlo-Funktion.
        p_app     := 'serlo'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_scheduled_post_failure() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ─── Noch offen ──────────────────────────────────────────────────────────────
-- Web-Push für Nicht-DM-Typen bleibt tot. Der Fan-out lebt in der Edge Function,
-- und die wird vom notifications-Trigger nicht mehr gerufen. Das zu beleben heißt
-- entweder den Token-Weg wieder herzustellen (app.settings.service_role_key
-- setzen) oder den Web-Push-Aufruf ebenfalls in SQL zu ziehen. Eigener Schritt,
-- betrifft Serlo genauso wie Berkat.
