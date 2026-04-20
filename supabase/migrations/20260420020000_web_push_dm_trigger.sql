-- =============================================================================
-- v1.w.12.4 Slice D — Web-Push-Trigger auf messages-Insert (DM als
-- erster echter Web-Push-Use-Case)
-- =============================================================================
--
-- Architektur-Hinweis:
--   Die bestehende `notify_on_dm()` Trigger-Function in
--   notifications_extend.sql feuert die Expo-Push (Native-App) — wird
--   nicht angefasst. Das hier ist ein SEPARATER, ADDITIVER Trigger für
--   Web-Push. Gründe:
--     1. Keine Regression in der Native-Push-Pipeline möglich
--     2. Web-Push hat einen anderen Auth-Path (VAPID + Service-Role-Call an
--        Edge-Function via pg_net statt direkt an exp.host)
--     3. Kann einzeln deaktiviert werden falls Ops-Issue
--
-- Fire-and-forget via pg_net: Edge-Function kann 500ms-2s brauchen (mehrere
-- HTTP-Calls an FCM/Mozilla-Autopush), das darf kein DM-INSERT blockieren.
-- pg_net ist async by design.
--
-- No-op wenn der User keine Web-Subscriptions hat — die Edge-Function ruft
-- `get_active_web_push_subs()` und bekommt einfach ein leeres Array. Das
-- rechtfertigt den universellen Trigger (vs. conditional check "user has
-- web sub" im Trigger selbst): der Check wäre im Hot-Path vor jedem DM ein
-- Extra-Round-Trip und die Edge-Function-Kosten für "empty fanout" sind
-- vernachlässigbar.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_web_push_on_dm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_id    UUID := NEW.sender_id;
  v_sender_name  TEXT;
  v_body_preview TEXT;
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', TRUE);
  v_project_url      TEXT := current_setting('app.settings.project_url',      TRUE);
BEGIN
  -- Empfänger = der andere Teilnehmer der Conversation. Schema-Annahme:
  -- `conversations` hat `user_a_id` + `user_b_id` (konsistent mit bestehenden
  -- DM-Triggern in notifications_extend.sql).
  SELECT CASE
           WHEN c.user_a_id = v_sender_id THEN c.user_b_id
           ELSE c.user_a_id
         END
    INTO v_recipient_id
    FROM public.conversations c
   WHERE c.id = NEW.conversation_id;

  -- Defensive-Guard: keine Self-Notifications, keine Orphan-Conversations.
  IF v_recipient_id IS NULL OR v_recipient_id = v_sender_id THEN
    RETURN NEW;
  END IF;

  -- Wenn pg_net / settings nicht konfiguriert sind (lokales Dev ohne
  -- Service-Role oder selbst-gehostete Instanz), skip silent. Expo-Push
  -- läuft in der parallelen Trigger-Function weiter.
  IF v_service_role_key IS NULL OR v_project_url IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sender-Username für Notification-Titel
  SELECT COALESCE(username, 'Jemand')
    INTO v_sender_name
    FROM public.profiles
   WHERE id = v_sender_id;

  -- 100 Zeichen reichen für Notification-Body; Browser kürzen eh
  v_body_preview := COALESCE(LEFT(NEW.content, 100), '✉️ Neue Nachricht');

  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body    := jsonb_build_object(
      'user_id', v_recipient_id,
      'title',   '@' || v_sender_name,
      'body',    v_body_preview,
      -- tag setzt Browser-Grouping: neue DM von gleichem Sender ersetzt
      -- die alte Notification → 10 Messages hintereinander machen nicht
      -- 10 Pop-Ups, sondern 1 aktualisiertes.
      'tag',     'dm:' || NEW.conversation_id::text,
      -- Deep-Link direkt in den Thread. `/messages/[id]`-Route matched
      -- bereits existierende Next-Route (siehe apps/web/app/messages/).
      'url',     '/messages/' || NEW.conversation_id::text,
      'data',    jsonb_build_object(
        'type',            'dm',
        'conversationId',  NEW.conversation_id::text,
        'senderId',        v_sender_id::text,
        'senderUsername',  v_sender_name
      )
    )
  );

  RETURN NEW;
EXCEPTION
  -- pg_net kann im Edge-Case (extension nicht geladen) werfen; wir wollen
  -- niemals einen DM-INSERT wegen einer Push-Dispatch-Nebenwirkung scheitern
  -- lassen. Sentry bekommt den Fehler nicht automatisch, aber der Eintrag
  -- landet im Postgres-Log und die Expo-Push-Pipeline läuft unverändert.
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_web_push_on_dm() FROM PUBLIC, anon, authenticated;
-- Nur der Trigger-Kontext (SECURITY DEFINER läuft als Owner) ruft das;
-- kein expliziter GRANT auf ein Rolle nötig.

-- Trigger registrieren — Name `on_message_insert_web_push` damit
-- parallel zum bestehenden `on_message_insert` (Expo-Push aus
-- notifications_extend.sql) läuft. Postgres feuert AFTER-INSERT-Trigger
-- in alphabetischer Reihenfolge des Namens: Expo-Push zuerst, Web-Push
-- danach. Beide sind unabhängig, Reihenfolge ist nur für die Log-
-- Reihenfolge sichtbar.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='messages') THEN
    DROP TRIGGER IF EXISTS on_message_insert_web_push ON public.messages;
    CREATE TRIGGER on_message_insert_web_push
      AFTER INSERT ON public.messages
      FOR EACH ROW EXECUTE FUNCTION public.notify_web_push_on_dm();
  END IF;
END $$;

COMMENT ON FUNCTION public.notify_web_push_on_dm IS
  'Fire-and-forget Web-Push-Dispatch via Edge-Function send-web-push. Additiv zur existierenden Expo-Push-Pipeline in notify_on_dm().';
