-- VIBES — Push Notification Trigger
-- Aufgabe: Sendet automatisch eine Push-Notification wenn ein
--          neuer Eintrag in der notifications-Tabelle erscheint.
-- Benötigt: pg_net Extension (in Supabase Free-Tier enthalten)
-- ──────────────────────────────────────────────────────────────────────────────

-- Schritt 1: pg_net Extension aktivieren (falls nicht schon aktiv)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schritt 2: Trigger-Funktion erstellen
CREATE OR REPLACE FUNCTION public.fn_send_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url     TEXT;
  v_secret  TEXT;
BEGIN
  -- Edge Function URL
  v_url    := 'https://llymwqfgujwkoxzqxrlm.supabase.co/functions/v1/send-push-notification';
  v_secret := current_setting('app.supabase_service_role_key', true);

  -- Nur an echte User senden (nicht an sich selbst)
  IF NEW.recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- Async HTTP POST an Edge Function (fire-and-forget, blockiert nicht)
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object('record', row_to_json(NEW)),
    timeout_milliseconds := 10000
  );

  RETURN NEW;
END;
$$;

-- Schritt 3: Trigger auf notifications-Tabelle
DROP TRIGGER IF EXISTS trg_push_notification ON public.notifications;

CREATE TRIGGER trg_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_send_push_on_notification();

-- ────────────────────────────────────────────────────────────────────────────
-- WICHTIG: service_role_key in app-Settings speichern (einmalig ausführen):
-- ALTER DATABASE postgres SET app.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY';
-- ────────────────────────────────────────────────────────────────────────────
