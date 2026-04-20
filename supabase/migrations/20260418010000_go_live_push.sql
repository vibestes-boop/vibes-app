-- ================================================================
-- v1.16.0 — Go-Live Push Notification
-- ================================================================
-- Trigger: feuert nach INSERT auf live_sessions (status='active')
--   → Legt für JEDEN Follower des Hosts einen notifications-Eintrag an
--   → Der bestehende trg_push_notification-Trigger (auf notifications)
--     stößt danach automatisch die send-push-notification Edge Function an
--     → Expo Push an alle Follower
--
-- Dedup/Spam-Schutz:
--   • Host-Self-Notify wird durch den bestehenden push-Trigger verhindert
--     (recipient_id = sender_id → return).
--   • Gleicher Host sollte nicht innerhalb kurzer Zeit mehrfach notifizieren:
--     wir prüfen ob der Host in den letzten 30 Minuten schon ein 'live'-notif
--     ausgelöst hat (verhindert Re-Push bei App-Restart / Reconnect-Session).
-- ================================================================

CREATE OR REPLACE FUNCTION public.notify_followers_on_go_live()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count int;
BEGIN
  -- Nur aktive Sessions triggern Pushes
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Anti-Spam: Wenn derselbe Host in den letzten 30 Minuten bereits ein
  -- 'live'-Notif ausgelöst hat → skip. Deckt Netzwerk-Reconnects oder
  -- versehentliches zweimaliges Starten ab.
  SELECT COUNT(*) INTO v_recent_count
    FROM public.notifications
   WHERE sender_id = NEW.host_id
     AND type      = 'live'
     AND created_at > NOW() - INTERVAL '30 minutes';

  IF v_recent_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Fan-out: Ein Notif-Eintrag pro Follower.
  -- `session_id` = deeplink in die Live-Watch-Route (watch/[id]).
  -- `comment_text` = Live-Titel, damit er im Push-Body erscheint.
  INSERT INTO public.notifications (
    recipient_id,
    sender_id,
    type,
    session_id,
    comment_text,
    created_at
  )
  SELECT
    f.follower_id,
    NEW.host_id,
    'live',
    NEW.id,
    NEW.title,
    NOW()
  FROM public.follows f
  WHERE f.following_id = NEW.host_id
    AND f.follower_id <> NEW.host_id;  -- Safety: niemals an sich selbst

  RETURN NEW;
END;
$$;

-- Trigger auf live_sessions
DROP TRIGGER IF EXISTS trg_notify_followers_on_go_live ON public.live_sessions;
CREATE TRIGGER trg_notify_followers_on_go_live
  AFTER INSERT ON public.live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followers_on_go_live();

-- ─── Verifikation ─────────────────────────────────────────────────
-- -- Manuell testen:
-- INSERT INTO public.live_sessions (host_id, title, status, room_name)
-- VALUES (auth.uid(), 'Test-Go-Live', 'active', 'test-' || gen_random_uuid()::text);
-- -- Sollte für jeden Follower einen notifications-Row erzeugen.

DO $$
BEGIN
  RAISE NOTICE '✅ Go-Live Push-Notification Trigger deployed (v1.16.0)';
END $$;
