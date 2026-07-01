-- 20260701050000_push_via_direct_helper.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: Push für ALLE notifications-Typen wiederherstellen (product_saved,
-- Bestellungen, Gift, Live …).
--
-- Ursache: Die Push-Dedup-Migration entfernte den notifications-Webhook, der
-- als einziger die Edge Function mit gültigem Token aufrief. Es ist KEIN
-- Service-Role-Token in der DB gesetzt (app.settings.service_role_key etc. alle
-- leer), also kann fn_send_push_on_notification die Edge Function nicht sauber
-- aufrufen (401).
--
-- Lösung: Der Trigger pusht jetzt über den bewährten, tokenlosen Direkt-Helper
-- send_push_to_user() — genau wie notify_on_like / notify_on_dm. Typ-Texte sind
-- wortgleich aus der Edge Function gespiegelt.
--
-- Kein Doppel-Push: like/comment/follow/follow_request/dm pushen bereits direkt
-- in ihren notify_on_*-Funktionen → hier übersprungen.
--
-- EXCEPTION-geschützt: Der Trigger hängt AFTER INSERT an notifications, die aus
-- anderen Triggern (notify_on_dm, Bestell-RPCs) entstehen. Ein Push-Fehler darf
-- den auslösenden INSERT NIEMALS scheitern lassen.
--
-- ⚠️ Web-Push für diese Typen läuft hierüber NICHT (der Web-Push-Fan-out lebte
-- in der Edge Function). Native-Push (das gemeldete Problem) ist voll gefixt;
-- Web-Push für Nicht-DM-Typen ist ein separater Folge-Schritt.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    WHEN 'order_payment_requested' THEN
      v_title := '💶 Zeit zu bezahlen';
      v_body  := COALESCE(NEW.comment_text, 'Deine Vorbestellung ist da — jetzt bezahlen 🌸');
    WHEN 'order_payment_reminder' THEN
      v_title := '🌸 Dein Parfüm wartet';
      v_body  := COALESCE(NEW.comment_text, 'Kurz bezahlen — dann geht deine Vorbestellung raus 🌸');
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
    p_data    := v_data
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Push darf den auslösenden INSERT niemals scheitern lassen.
  RETURN NEW;
END;
$$;
