-- 20260701040000_dm_push_direct.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: DM-Push wieder herstellen.
--
-- Ursache: Die Push-Dedup-Migration (20260701010000) entfernte den
-- notifications-Webhook, der als EINZIGER die Edge Function mit gültigem Token
-- aufrief. Der verbliebene Trigger fn_send_push_on_notification ruft die Edge
-- Function ohne Token (GUC leer) → 401 → kein Push. Likes/Kommentare sind NICHT
-- betroffen, weil sie über den Helper send_push_to_user() DIREKT an Expo pushen.
--
-- notify_on_dm hängte dagegen allein am (jetzt kaputten) Edge-Function-Weg.
-- Fix: notify_on_dm nutzt denselben kanonischen Direkt-Helper wie notify_on_like
-- (send_push_to_user → alle Geräte-Tokens → Expo). Kein Auth, kein Doppel-Push
-- (der 401-Trigger bleibt ein harmloser No-Op).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_on_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_id    UUID;
  v_recipient_id UUID;
  v_sender_name  TEXT;
BEGIN
  v_sender_id := NEW.sender_id;

  -- Empfänger = der andere Teilnehmer der Konversation
  SELECT CASE
           WHEN participant_1 = v_sender_id THEN participant_2
           ELSE participant_1
         END
    INTO v_recipient_id
    FROM public.conversations
   WHERE id = NEW.conversation_id;

  IF v_recipient_id IS NULL           THEN RETURN NEW; END IF;
  IF v_recipient_id = v_sender_id     THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand')
    INTO v_sender_name
    FROM public.profiles
   WHERE id = v_sender_id;

  -- In-App Notification (unverändert)
  INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
  VALUES (v_recipient_id, v_sender_id, 'dm', LEFT(NEW.content, 200))
  ON CONFLICT DO NOTHING;

  -- Push über den kanonischen Direkt-Helper (identisch zu notify_on_like).
  PERFORM public.send_push_to_user(
    p_user_id := v_recipient_id,
    p_title   := '✉️ Neue Nachricht',
    p_body    := COALESCE(NULLIF(LEFT(NEW.content, 140), ''),
                          '@' || v_sender_name || ' schreibt dir'),
    p_data    := jsonb_build_object(
      'type',           'dm',
      'conversationId', NEW.conversation_id::text,
      'senderId',       v_sender_id::text,
      'senderUsername', v_sender_name
    )
  );

  RETURN NEW;
END;
$$;
