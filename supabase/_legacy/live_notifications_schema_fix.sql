-- live_notifications_schema_fix.sql
-- Erweitert die notifications-Tabelle um 'live', 'live_invite' und 'dm' Typen
-- und stellt sicher dass der Edge-Function-Trigger aktiv ist.

-- 1. CHECK-Constraint erweitern
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('like', 'comment', 'follow', 'live', 'live_invite', 'dm'));

-- 2. session_id Spalte hinzufügen (für live / live_invite)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE;

-- 3. Sicherstellen dass der Edge-Function-Trigger auf notifications existiert
-- (ruft send-push-notification Edge Function bei jedem INSERT auf)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
    body := to_jsonb(NEW),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fehler beim HTTP-Call darf keinen INSERT blockieren
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_push ON public.notifications;
CREATE TRIGGER on_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trigger_push_notification();

-- 4. Notify-Funktion für Live-Sessions (für Follower)
CREATE OR REPLACE FUNCTION public.notify_followers_on_live()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Nur beim Statuswechsel zu 'active' feuern
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status <> 'active') THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, session_id)
    SELECT
      f.follower_id,
      NEW.host_id,
      'live',
      NEW.id
    FROM public.follows f
    WHERE f.following_id = NEW.host_id
      AND f.follower_id <> NEW.host_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_live_session_active ON public.live_sessions;
CREATE TRIGGER on_live_session_active
  AFTER INSERT OR UPDATE OF status ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_live();
