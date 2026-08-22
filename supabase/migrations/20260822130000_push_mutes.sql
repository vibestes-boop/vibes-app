-- ─────────────────────────────────────────────────────────────────────────────
-- Push stummschalten — je Anlass, nicht alles oder nichts
--
-- DAS PROBLEM
-- Berkat schickt inzwischen Push für acht Anlässe: Zuschlag,
-- Zahlungserinnerung, Versand, „dein Artikel ist dran", Termin-Erinnerung,
-- gespeicherte Suche, Vormerkung, Streitfall. **Kein einziger Schalter.**
--
-- Wem es zu viel wird, dem bleibt nur der Weg über die iOS-Einstellungen — und
-- dort gibt es nur alles oder nichts. Der schaltet dann ALLE ab, auch den
-- Zuschlag. Das ist die teuerste Art, einen Käufer zu verlieren: Er bleibt in
-- der App und bekommt nichts mehr mit.
--
-- ⚠️ DIE MELDUNG BLEIBT, NUR DER PUSH GEHT
-- Eine stummgeschaltete Meldung steht weiterhin in der Glocke. Das ist der
-- Unterschied zwischen „nicht stören" und „nicht informieren" — und nur der
-- erste ist eine Einstellung. Wer den zweiten baut, nimmt dem Nutzer eine
-- Auskunft, die er nie abbestellt hat.
--
-- ⚠️ ABSCHALTBAR IST, WAS EINLÄDT — NICHT, WAS BETRIFFT
-- Der CHECK unten ist die halbe Funktion. Er lässt genau die Anlässe zu, deren
-- Wegfall niemandem schadet:
--
--   scheduled_live_reminder, live   Aufmerksamkeit, kein Vorgang
--   saved_search_hit                Entdeckung
--   auction_up                      selbst vorgemerkt, also auch abbestellbar
--   product_saved, order_review     nett zu wissen
--
-- Nicht abschaltbar bleiben Zuschlag, Zahlungserinnerung, Versand, neue
-- Bestellung und Streitfall — überall dort hängt GELD oder eine FRIST daran.
-- Wer sie stumm schalten könnte, könnte sich selbst aus einem laufenden
-- Geschäft aussperren; der Sammelkorb läuft in 24 Stunden ab, und niemand
-- bringt das mit einem Schalter in Verbindung, den er vor Wochen umgelegt hat.
--
-- Die Regel steht bewusst in der DATENBANK und nicht im Client: Ein späterer
-- Bildschirm, der versehentlich `auction_won` anbietet, läuft dann in den
-- CHECK statt in einen stillen Schaden.
--
-- ⚠️ ANWESENHEIT = STUMM. Es gibt keine `enabled`-Spalte. Eine Zeile heißt
-- „aus", keine Zeile heißt „an" — damit ist der Normalfall kostenlos, und
-- niemand muss beim Anlegen eines Kontos Voreinstellungen schreiben.
--
-- ⚠️ `app` gehört in den Schlüssel: Die Tabelle liegt in der geteilten
-- Datenbank, und `order_shipped` gibt es in Serlo wie in Berkat. Wer in einer
-- App stummschaltet, meint nicht die andere.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.push_mutes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app     text NOT NULL DEFAULT 'berkat' CHECK (app IN ('serlo', 'berkat')),
  type    text NOT NULL CHECK (type IN (
    'scheduled_live_reminder', 'live', 'saved_search_hit',
    'auction_up', 'product_saved', 'order_review'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app, type)
);

COMMENT ON TABLE public.push_mutes IS
  'Welche Push-Anlässe ein Nutzer stummgeschaltet hat. Anwesenheit = stumm. '
  'Die Meldung selbst entsteht weiterhin und steht in der Glocke.';

ALTER TABLE public.push_mutes ENABLE ROW LEVEL SECURITY;

-- Nur die eigenen Zeilen, in jede Richtung. Was jemand stummgeschaltet hat,
-- geht niemanden sonst etwas an — und niemand darf es für ihn ändern.
DROP POLICY IF EXISTS push_mutes_select_own ON public.push_mutes;
CREATE POLICY push_mutes_select_own ON public.push_mutes
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_mutes_insert_own ON public.push_mutes;
CREATE POLICY push_mutes_insert_own ON public.push_mutes
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_mutes_delete_own ON public.push_mutes;
CREATE POLICY push_mutes_delete_own ON public.push_mutes
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.push_mutes TO authenticated;

-- ─── Der Trigger, um EINEN Block ergänzt ────────────────────────────────────
-- ⚠️ Rumpf ist der LIVE-Stand vom 22.08.2026, maschinell aus `supabase db dump`
-- übernommen und an genau einer Stelle ergänzt (der Block direkt nach der
-- Selbst-Meldungs-Prüfung). NICHT abgetippt: Bei dieser Funktion sind schon
-- zweimal spätere Änderungen verlorengegangen (Abschnitt 51 und der Hinweis in
-- `20260814190000`), und beim letzten Mal hat genau dieses Verfahren es
-- verhindert (`20260821120000`).

CREATE OR REPLACE FUNCTION "public"."fn_send_push_on_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_actor TEXT;
  v_title TEXT;
  v_body  TEXT;
  v_data  jsonb;
BEGIN
  -- Self-Notification nie pushen.
  IF NEW.recipient_id = NEW.sender_id THEN RETURN NEW; END IF;

  -- ⚠️ STUMMSCHALTUNG. Die Meldung entsteht trotzdem und steht in der Glocke —
  -- nur der Push bleibt aus. Das ist der Unterschied zwischen „nicht stören"
  -- und „nicht informieren", und nur der erste ist eine Einstellung.
  IF EXISTS (
    SELECT 1 FROM public.push_mutes m
     WHERE m.user_id = NEW.recipient_id
       AND m.app     = COALESCE(NEW.app, 'serlo')
       AND m.type    = NEW.type
  ) THEN
    RETURN NEW;
  END IF;


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
    -- Berkat: der vorgemerkte Artikel wird JETZT aufgerufen. Ohne eigenen
    -- Zweig fiele er in den ELSE darunter und käme als „Neue Aktivität auf
    -- Serlo" an — falsche Marke, und vor allem kein Anlass: Diese Meldung hat
    -- eine Halbwertszeit von Sekunden.
    -- Gespeicherte Suche. Anders als bei Belohnungen und Preisvorschlaegen ist
    -- ein Push hier NICHT Beiwerk, sondern der ganze Zweck: Die Meldung soll
    -- jemanden zurueckholen, der die App verlassen hat. Ohne Push waere die
    -- Funktion sinnlos, weil sie nur den erreicht, der ohnehin schon da ist.
    WHEN 'saved_search_hit' THEN
      v_title := '🔎 Das hast du gesucht';
      v_body  := COALESCE(NEW.comment_text, 'Etwas Neues passt zu deiner Suche');
    WHEN 'auction_up' THEN
      v_title := '🔨 Dein Artikel ist dran';
      v_body  := COALESCE(NEW.comment_text, 'Die Auktion läuft — jetzt mitbieten');
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
  )
  -- ⚠️ ERGÄNZT 21.08.2026, zweite Änderung an dieser Funktion in dieser Datei.
  -- Ohne dieses Feld liest `usePush.ts` `data.query` als `undefined`, und
  -- `notificationTarget` fällt auf `/shop` OHNE Suchbegriff zurück — der
  -- Empfänger müsste erneut tippen. Kaputt wäre damit ausgerechnet der Weg,
  -- mit dem diese Meldung ihren Push überhaupt rechtfertigt („jemanden
  -- zurückholen, der die App verlassen hat").
  --
  -- Es ist derselbe Fehler wie am 19.08. bei `auction_up`: zwei Wahrheiten über
  -- dasselbe Ziel, diesmal zwischen SQL-Nutzlast und Client-Erwartung. Vier von
  -- fünf Prüf-Blickwinkeln haben ihn unabhängig gefunden.
  --
  -- Als CASE und nicht als sechster Dauer-Schlüssel: Die Funktion gehört Serlo
  -- mit, und für jeden anderen Typ ist `product_name` ein ARTIKELNAME, kein
  -- Suchbegriff. Unbedingt mitzugeben hieße, ihn dort falsch zu benennen.
  || CASE
       WHEN NEW.type = 'saved_search_hit' AND NEW.product_name IS NOT NULL
         THEN jsonb_build_object('query', NEW.product_name)
       ELSE '{}'::jsonb
     END;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. Genau EIN Trigger-Rumpf, und die Sperre steht drin:
--      SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--       WHERE n.nspname='public' AND p.proname='fn_send_push_on_notification';
--      -- erwartet: 1
--      SELECT prosrc LIKE '%push_mutes%' FROM pg_proc WHERE proname='fn_send_push_on_notification';
--      -- erwartet: true
--
-- 2. Der CHECK hält, was der Kopf verspricht:
--      INSERT INTO push_mutes (user_id, app, type) VALUES (auth.uid(), 'berkat', 'auction_won');
--      -- erwartet: FEHLER 23514. Zuschlag ist nicht abschaltbar.
--
-- 3. Fremde Zeilen bleiben unsichtbar:
--      SELECT count(*) FROM push_mutes;   -- als angemeldeter Nutzer
--      -- erwartet: nur die eigenen.
--
-- 4. ⚠️ Der eigentliche Beweis braucht zwei Konten und ein echtes Gerät:
--    Termin-Erinnerung stummschalten, Termin anlegen, warten — es darf KEIN
--    Push kommen, die Meldung muss aber in der Glocke stehen. Gehört in Gruppe
--    D der Prüfliste.
-- ─────────────────────────────────────────────────────────────────────────────
