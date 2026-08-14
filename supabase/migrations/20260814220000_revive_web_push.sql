-- Web-Push wiederbeleben — er war komplett tot, nicht nur für Nicht-DM.
--
-- BEFUND: Beide Web-Push-Wege hingen an `current_setting('app.settings.…')`:
--
--   notify_web_push_on_dm       → app.settings.service_role_key + project_url
--   send-push-notification      → wurde vom Trigger gar nicht mehr gerufen
--
-- Am 14.08.2026 gegen die Live-DB gemessen: `app.settings.service_role_key`,
-- `app.supabase_service_role_key` und `app.settings.project_url` haben alle
-- **Länge 0**. Der DM-Trigger bricht deshalb an seinem eigenen Wächter
-- `IF v_service_role_key IS NULL … RETURN NEW` ab — er hat es nie versucht.
--
-- Damit war die bisherige Annahme zu optimistisch: Nicht nur Nicht-DM-Typen
-- waren stumm, sondern **jeder** Web-Push, DMs eingeschlossen.
--
-- WARUM NICHT ALLES IN SQL: Web-Push braucht VAPID-Signaturen (ECDSA P-256).
-- Das ist in plpgsql nicht machbar — die Datenbank MUSS die Edge Function rufen
-- können. Es geht also nur über einen Token.
--
-- LÖSUNG: Der Token liegt längst da, nur an anderer Stelle. `vault.secrets`
-- enthält `service_role_key` (219 Zeichen) und wird seit 20260423220000 von den
-- AI-Image-Crons genau so genutzt. Beide Trigger lesen ihn jetzt von dort statt
-- aus einer Einstellung, die nie jemand gesetzt hat.
--
-- `vault` muss dafür in den search_path — sonst findet die Funktion die View
-- nicht, und der EXCEPTION-Block würde den Fehler stumm schlucken.

BEGIN;

-- ─── 1. DM-Web-Push: Vault statt leerer Einstellung ──────────────────────────
CREATE OR REPLACE FUNCTION public.notify_web_push_on_dm() RETURNS "trigger"
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_id    UUID := NEW.sender_id;
  v_sender_name  TEXT;
  v_body_preview TEXT;
  -- Der Schlüssel kommt aus dem Vault, nicht aus app.settings — die Einstellung
  -- war nie gesetzt (am 14.08.2026 geprüft: Länge 0), weshalb der Wächter unten
  -- den Aufruf immer abbrach und Web-Push für DMs seit jeher stumm war.
  v_service_role_key TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets
                               WHERE name = 'service_role_key' LIMIT 1);
  v_project_url      TEXT := 'https://llymwqfgujwkoxzqxrlm.supabase.co';
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

-- ─── 2. Alle übrigen Typen: Web-Push anstoßen ────────────────────────────────
-- Der Trigger erledigt den nativen Push selbst über send_push_to_user() und gibt
-- nur den Web-Teil an die Edge Function ab (`channels: ['web']`). Ohne diese
-- Trennung käme der Expo-Push doppelt: einmal aus SQL, einmal aus der Function.
--
-- Rumpf ist wieder der LIVE-Stand, maschinell übernommen und nur um den
-- Web-Block ergänzt.
CREATE OR REPLACE FUNCTION public.fn_send_push_on_notification() RETURNS "trigger"
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_actor TEXT;
  v_title TEXT;
  v_body  TEXT;
  v_data  jsonb;
BEGIN
  -- Self-Notification nie pushen.
  IF NEW.recipient_id = NEW.sender_id THEN RETURN NEW; END IF;

  -- Typen mit eigenem Direkt-Push (notify_on_like/comment/follow/dm) hier
  -- überspringen → sonst Doppel-Push.
  IF NEW.type IN ('like', 'comment', 'follow', 'follow_request', 'dm') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(username, 'Jemand') INTO v_actor
    FROM public.profiles WHERE id = NEW.sender_id;

  CASE NEW.type
    WHEN 'live' THEN
      v_title := '🔴 Live auf Serlo';
      v_body  := v_actor || ' ist jetzt LIVE!' || COALESCE(' — ' || NEW.comment_text, '');
    WHEN 'live_invite' THEN
      v_title := '🎥 Live-Einladung';
      v_body  := v_actor || ' hat dich in sein Live eingeladen!';
    WHEN 'scheduled_live_reminder' THEN
      v_title := '🔔 Gleich live';
      v_body  := COALESCE(v_actor || ' startet in 15 Min: „' || NEW.comment_text || '"',
                          v_actor || ' geht in 15 Minuten live!');
    WHEN 'gift' THEN
      v_title := COALESCE(NEW.gift_emoji, '🎁') || ' Geschenk erhalten';
      v_body  := v_actor || ' hat dir ' || COALESCE(NEW.gift_emoji, '🎁') || ' '
                 || COALESCE(NEW.gift_name, 'ein Geschenk') || ' geschickt!';
    WHEN 'new_order' THEN
      v_title := '🛍️ Neuer Verkauf!';
      v_body  := COALESCE(v_actor || ' hat „' || NEW.product_name || '" gekauft',
                          v_actor || ' hat ein Produkt gekauft');
    WHEN 'preorder_interest' THEN
      v_title := '🌸 Neue Vorbestellung';
      v_body  := COALESCE(v_actor || ' hat „' || NEW.product_name || '" vorbestellt',
                          v_actor || ' hat ein Produkt vorbestellt');
    WHEN 'product_saved' THEN
      v_title := '🔖 Produkt gemerkt';
      v_body  := COALESCE(v_actor || ' hat „' || NEW.product_name || '" gemerkt',
                          v_actor || ' hat dein Produkt gemerkt');
    WHEN 'preorder_round_open' THEN
      v_title := '🌸 Sammelbestellung läuft';
      v_body  := COALESCE(NEW.comment_text,
                          '„' || NEW.product_name || '" wird gerade gesammelt — jetzt sichern!',
                          'Eine Sammelbestellung ist offen — jetzt sichern!');
    -- Berkat-Zuschlag. Ohne eigenen Zweig fällt er in den ELSE unten und
    -- käme als 'Neue Aktivität auf Serlo' an — falsche Marke, kein Anlass.
    WHEN 'auction_won' THEN
      v_title := '🎉 Zuschlag — du hast gewonnen!';
      v_body  := COALESCE(NEW.comment_text, 'Dein Artikel liegt im Sammelkorb');
    WHEN 'order_payment_requested' THEN
      v_title := '💶 Zeit zu bezahlen';
      v_body  := COALESCE(NEW.comment_text, 'Deine Vorbestellung ist da — jetzt bezahlen 🌸');
    WHEN 'order_payment_reminder' THEN
      -- Zwei Marken, ein Typ. Serlo erinnert an eine Vorbestellung, Berkat an
      -- einen Sammelkorb, dessen Fenster zuläuft. „Dein Parfüm wartet" wäre in
      -- einer Auktions-App schlicht falsch.
      IF COALESCE(NEW.app, 'serlo') = 'berkat' THEN
        v_title := '⏳ Dein Sammelkorb wartet';
        v_body  := COALESCE(NEW.comment_text, 'Kurz bezahlen — sonst schließt das Fenster');
      ELSE
        v_title := '🌸 Dein Parfüm wartet';
        v_body  := COALESCE(NEW.comment_text, 'Kurz bezahlen — dann geht deine Vorbestellung raus 🌸');
      END IF;
    WHEN 'order_paid' THEN
      v_title := '💶 Bestellung bezahlt';
      v_body  := v_actor || ' hat bezahlt — bitte versenden 📦';
    WHEN 'order_shipped' THEN
      v_title := '📦 Unterwegs';
      v_body  := COALESCE(NEW.comment_text, 'Dein Parfüm ist unterwegs 📦');
    WHEN 'order_cancelled' THEN
      v_title := '🚫 Bestellung storniert';
      v_body  := v_actor || ' hat eine Bestellung storniert';
    WHEN 'order_address_updated' THEN
      v_title := '📍 Adresse geändert';
      v_body  := v_actor || ' hat die Lieferadresse aktualisiert';
    WHEN 'order_review' THEN
      v_title := '⭐ Neue Bewertung';
      v_body  := COALESCE(NEW.comment_text, v_actor || ' hat dich bewertet');
    WHEN 'order_dispute' THEN
      v_title := '⚠️ Problem gemeldet';
      v_body  := COALESCE(NEW.comment_text, 'Ein Problem mit einer Bestellung wurde gemeldet');
    ELSE
      v_title := 'Neue Aktivität auf Serlo';
      v_body  := COALESCE(NEW.comment_text, '');
  END CASE;

  v_data := jsonb_build_object(
    'type',      NEW.type,
    'postId',    NEW.post_id,
    'sessionId', NEW.session_id,
    'senderId',  NEW.sender_id,
    'productId', NEW.product_id
  );

  PERFORM public.send_push_to_user(
    p_user_id := NEW.recipient_id,
    p_title   := v_title,
    p_body    := v_body,
    p_data    := v_data,
    -- Ziel-App: entscheidet, welche Geräte angesprochen werden.
    p_app     := COALESCE(NEW.app, 'serlo')
  );

  -- ── Web-Push ───────────────────────────────────────────────────────────────
  -- Nur der Web-Kanal: Der native Push ist zwei Zeilen weiter oben schon raus.
  -- Klickziel und Gruppierungs-Tag leitet die Edge Function typ-abhängig ab —
  -- diese Logik ein zweites Mal in plpgsql zu pflegen hieße zwei Wahrheiten.
  --
  -- DMs überspringen: Für die gibt es einen eigenen Trigger auf `messages`
  -- (notify_web_push_on_dm). Ein zweiter Web-Push hier wäre ein Doppel-Ping.
  --
  -- Fire-and-forget über pg_net; scheitert der Aufruf, ist der native Push
  -- trotzdem raus. Der EXCEPTION-Block unten fängt den Rest.
  IF NEW.type <> 'dm' THEN
    PERFORM net.http_post(
      url     := 'https://llymwqfgujwkoxzqxrlm.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets
                                        WHERE name = 'service_role_key' LIMIT 1)
      ),
      body    := jsonb_build_object('record', row_to_json(NEW), 'channels', jsonb_build_array('web')),
      timeout_milliseconds := 10000
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Push darf den auslösenden INSERT niemals scheitern lassen.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_web_push_on_dm() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ─── Danach zu prüfen ────────────────────────────────────────────────────────
-- Ob wirklich etwas ankommt, hängt an drei Dingen außerhalb dieser Migration:
-- gültige VAPID-Schlüssel in den Function-Secrets, mindestens ein Eintrag in
-- `web_push_subscriptions` für den Empfänger, und ein Browser, der die
-- Berechtigung erteilt hat. Die Migration stellt nur den Weg wieder her.
