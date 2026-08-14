-- Push-Zustellung pro App trennen — und der Zuschlag bekommt seinen Text.
--
-- ZWEI BEFUNDE beim Nachprüfen der Berkat-Käufer-Benachrichtigungen (20260814180000):
--
--  1. FALSCHE OBERFLÄCHE BEDIENT. Die Texte wurden in
--     `supabase/functions/send-push-notification/index.ts` ergänzt — die Edge
--     Function wird für den nativen Push aber seit dem 01.07.2026 gar nicht mehr
--     aufgerufen. Migration 20260701050000 hat den Trigger auf den tokenlosen
--     Direkt-Helper umgestellt, weil in der DB kein Service-Role-Token gesetzt ist
--     (die Function antwortete mit 401). Seither leben die Push-Texte als CASE in
--     `fn_send_push_on_notification`. `auction_won` fehlt dort — der Zuschlag
--     landet also im ELSE-Zweig und kommt als „Neue Aktivität auf Serlo" an.
--     Genau die generische Meldung, vor der die Drei-Oberflächen-Regel warnt.
--     Die Edge-Function-Texte bleiben trotzdem stehen: Sie sind korrekt und
--     greifen, sobald der Token-Weg wieder aktiviert wird.
--
--  2. APP-TRENNUNG FEHLT. `send_push_to_user` schickt an ALLE Geräte eines
--     Nutzers, ohne zu unterscheiden, aus welcher App der Token stammt. Serlo und
--     Berkat teilen sich `profiles` — ohne App-Dimension bekäme ein Serlo-Nutzer
--     Berkat-Meldungen und umgekehrt. Das ist der Grund, warum Berkat bis heute
--     überhaupt keinen Token registriert.
--     (Nebenbefund entkräftet: Mehrere Geräte funktionieren bereits — der Helper
--     liest die Tabelle `push_tokens`, nicht die Einzelspalte `profiles.push_token`.
--     Nur die Edge Function las die Einzelspalte, und die läuft nicht mehr.)
--
-- LÖSUNG: App-Spalte auf beiden Seiten, Filter im Zustellhelfer, neuer CASE-Zweig.
--
-- DEFAULT 'serlo' ist bewusst gewählt, nicht NULL: Jede bestehende Zeile in beiden
-- Tabellen stammt aus Serlo. Das macht die Migration rückwirkend korrekt, ohne
-- Backfill-Lauf.

BEGIN;

-- ─── 1. App-Dimension ────────────────────────────────────────────────────────
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS app text NOT NULL DEFAULT 'serlo';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS app text NOT NULL DEFAULT 'serlo';

ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_app_check;
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_app_check
  CHECK (app IN ('serlo', 'berkat'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_app_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_app_check
  CHECK (app IN ('serlo', 'berkat'));

-- Der Helper schlägt je Push einmal nach: alle Tokens eines Nutzers für eine App.
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_app
  ON public.push_tokens (user_id, app);

-- ─── 2. Zustellhelfer filtert nach App ───────────────────────────────────────
-- DROP + CREATE statt CREATE OR REPLACE: Ein zusätzlicher Parameter erzeugt sonst
-- eine ZWEITE Überladung, und jeder bestehende 4-Argument-Aufruf würde mit
-- „function is not unique" scheitern. Läuft in derselben Transaktion, ist also
-- nie einen Moment lang weg.
--
-- ⚠️ DROP setzt die Rechte auf den Postgres-Standard zurück (EXECUTE für PUBLIC,
-- und PUBLIC schließt anon ein) — genau der Fehler, der am 14.08. bei
-- credit_coins gefunden wurde. Deshalb unten explizit neu gesetzt.
DROP FUNCTION IF EXISTS public.send_push_to_user(uuid, text, text, jsonb);

CREATE FUNCTION public.send_push_to_user(
  "p_user_id" uuid,
  "p_title"   text,
  "p_body"    text,
  "p_data"    jsonb DEFAULT '{}'::jsonb,
  "p_app"     text  DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_token TEXT;
  v_count INT;
BEGIN
  -- Stale Tokens (> 90 Tage nicht gesehen) aufräumen
  DELETE FROM public.push_tokens
   WHERE user_id = p_user_id
     AND last_seen_at < NOW() - INTERVAL '90 days';

  -- Gibt es Geräte der Ziel-App?
  SELECT COUNT(*) INTO v_count
    FROM public.push_tokens
   WHERE user_id = p_user_id
     AND (p_app IS NULL OR app = p_app);

  -- RÜCKFALL, bewusst: Findet sich kein Gerät der Ziel-App, gehen die Meldungen
  -- an alle Geräte des Nutzers. Solange Berkat noch keinen Token registriert
  -- (braucht expo-notifications und damit einen EAS-Rebuild), bekommt ein Nutzer
  -- mit beiden Apps den Zuschlag so wenigstens in Serlo. Unschön, aber besser als
  -- Stille. Sobald Berkat Tokens registriert, greift der Filter und dieser Zweig
  -- läuft leer. Zum Abschalten: die COALESCE-Bedingung durch `app = p_app` ersetzen.
  FOR v_token IN
    SELECT token FROM public.push_tokens
     WHERE user_id = p_user_id
       AND (p_app IS NULL OR v_count = 0 OR app = p_app)
  LOOP
    PERFORM send_expo_push(
      token := v_token,
      title := p_title,
      body  := p_body,
      data  := p_data
    );
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.send_push_to_user(uuid, text, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_push_to_user(uuid, text, text, jsonb, text)
  TO service_role;

-- ─── 3. Trigger-Texte: neuer Zweig für den Zuschlag + Ziel-App durchreichen ──
-- Rumpf ist der LIVE-Stand aus supabase/schema_live.sql, maschinell übernommen
-- und nur an zwei Stellen ergänzt. Nicht abgetippt — bei dieser Funktion sind
-- schon einmal spätere Änderungen verlorengegangen (CLAUDE.md, buy_product).
CREATE OR REPLACE FUNCTION public.fn_send_push_on_notification() RETURNS "trigger"
    LANGUAGE plpgsql SECURITY DEFINER
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
    -- Berkat-Zuschlag. Ohne eigenen Zweig fällt er in den ELSE unten und
    -- käme als 'Neue Aktivität auf Serlo' an — falsche Marke, kein Anlass.
    WHEN 'auction_won' THEN
      v_title := '🎉 Zuschlag — du hast gewonnen!';
      v_body  := COALESCE(NEW.comment_text, 'Dein Artikel liegt im Sammelkorb');
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
    p_data    := v_data,
    -- Ziel-App: entscheidet, welche Geräte angesprochen werden.
    p_app     := COALESCE(NEW.app, 'serlo')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Push darf den auslösenden INSERT niemals scheitern lassen.
  RETURN NEW;
END;
$$;

-- ─── 4. Berkats Meldungen als solche markieren ───────────────────────────────
-- Beide Trigger stammen aus 20260814180000 und schrieben ohne `app`, landeten
-- also auf dem Default 'serlo'. Rümpfe unverändert bis auf die neue Spalte.
CREATE OR REPLACE FUNCTION public.notify_auction_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_cents integer := COALESCE(NEW.current_bid_cents, 0);
BEGIN
  IF NEW.status <> 'sold'
     OR OLD.status IS NOT DISTINCT FROM 'sold'
     OR NEW.winner_id IS NULL
     OR NEW.winner_id = NEW.seller_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, session_id, product_name, comment_text, app)
  VALUES (
    NEW.winner_id,
    NEW.seller_id,
    'auction_won',
    NEW.session_id,
    NEW.title,
    format('%s · %s,%s €', NEW.title, v_cents / 100, lpad((v_cents % 100)::text, 2, '0')),
    'berkat'
  );

  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.notify_order_shipped()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.status <> 'shipped'
     OR OLD.status IS NOT DISTINCT FROM 'shipped'
     OR NEW.buyer_id IS NULL
     -- cart_id ist die Berkat-Weiche, siehe 20260814180000.
     OR NEW.cart_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, product_name, comment_text, app)
  VALUES (
    NEW.buyer_id,
    NEW.seller_id,
    'order_shipped',
    NEW.title,
    CASE
      WHEN NEW.tracking_number IS NOT NULL AND btrim(NEW.tracking_number) <> ''
        THEN format('%s ist unterwegs · %s', COALESCE(NEW.title, 'Dein Paket'), NEW.tracking_number)
      ELSE format('%s ist unterwegs', COALESCE(NEW.title, 'Dein Paket'))
    END,
    'berkat'
  );

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_auction_won() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_order_shipped() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ─── Was danach noch fehlt ───────────────────────────────────────────────────
-- Berkat registriert weiterhin KEINEN Token. Dafür braucht die App
-- `expo-notifications` samt Plugin und Registrierung — ein natives Modul, also
-- ein EAS-Rebuild. Bis dahin greift der Rückfall oben.
--
-- Web-Push ist für Nicht-DM-Typen seit dem 01.07.2026 ohnehin tot (der Fan-out
-- lebte in der Edge Function, die nicht mehr gerufen wird). Das ist ein eigener
-- Schritt und betrifft Serlo genauso wie Berkat.
