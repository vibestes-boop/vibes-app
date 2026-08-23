-- `comment_reply` freischalten — der Typ scheiterte seit Monaten still
-- ============================================================================
--
-- Punkt 6 der Liste aus Übergabe 75. Der Fund selbst steht dort unter „vier
-- tote Pfade":
--
--   `lib/useComments.ts:248` schreibt `type: 'comment_reply'`, wenn jemand auf
--   einen Kommentar antwortet. Der Typ steht NICHT im `notifications_type_check`
--   — am frischen Abzug vom 23.08.2026 nachgesehen, die Liste kennt 32 Typen
--   und diesen nicht. Der INSERT scheitert also IMMER, und niemand prüft dort
--   `error`. **Wer auf einen Kommentar antwortet, erreicht den anderen nicht.**
--
-- Das ist Serlos Fläche, nicht Berkats, und Serlo ist im App Store.
--
-- ── WARUM DAS NICHT NUR EINE ZEILE IM CHECK IST ─────────────────────────────
--
-- Ein neuer Meldungstyp muss VIER Oberflächen kennen (Übergabe 9, und die
-- Lehre aus `auction_won`):
--
--   1. der CHECK           ← hier, Teil 1
--   2. der Push-Text       ← hier, Teil 2. Ohne eigenen Zweig fällt der Typ in
--                            den ELSE und kommt als „Neue Aktivität auf Serlo"
--                            an — zugestellt, aber ohne Anlass
--   3. die In-App-Liste    ← `app/(tabs)/notifications.tsx` + drei Sprachen
--   4. die Web-Liste       ← `apps/web/components/notifications/…` + drei Sprachen
--
-- 3 und 4 liegen im Client und gehen mit dem OTA bzw. dem Web-Deploy raus.
-- **Diese Migration allein macht den Typ nicht fertig** — sie macht ihn nur
-- möglich. Bis der Client nach ist, zeigt die Liste den Rückfalltext.
--
-- ⚠️ REIHENFOLGE: DATENBANK VOR CLIENT. Andersherum schriebe der neue Client
-- einen Typ, den der CHECK ablehnt — also derselbe stille Fehlschlag wie
-- heute, nur mit mehr Code. Dieselbe Regel wie bei `listing_id` (Übergabe 72).
--
-- ⚠️ Web-Push bleibt hiervon UNBERÜHRT und ist für Nicht-DM ohnehin tot (seit
-- 1.7.26 feuert der SQL-CASE, nicht die Edge Function). Kein Rückschritt, aber
-- auch kein Fortschritt — gehört in eine eigene Runde.

-- ── 1. Der CHECK ────────────────────────────────────────────────────────────
-- UNION mit dem Bestand, damit kein bestehender Typ verlorengeht (Muster aus
-- `20260819160000`, zuletzt `20260821120000`). Die Aufzählung unten ist der
-- LIVE-Stand vom 23.08.2026 plus dem einen neuen.

DO $do$
DECLARE v_types text;
BEGIN
  SELECT string_agg(quote_literal(t), ', ' ORDER BY t) INTO v_types
  FROM (
    SELECT unnest(ARRAY[
      'auction_up','auction_won','comment','comment_like','dm','follow',
      'follow_request','follow_request_accepted','gift','guild','like','live',
      'live_invite','mention','new_order','order_address_updated',
      'order_cancelled','order_dispute','order_paid','order_payment_reminder',
      'order_payment_requested','order_review','order_shipped',
      'preorder_interest','preorder_round_open','product_saved','repost',
      'saved_search_hit','scheduled_live_reminder','story_reaction',
      'support_new','support_reply',
      -- NEU
      'comment_reply'
    ]) AS t
    UNION
    SELECT DISTINCT type FROM public.notifications WHERE type IS NOT NULL
  ) s;

  EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check';
  EXECUTE format(
    'ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (%s))',
    v_types
  );
END $do$;

-- ⚠️ Zählprobe statt Vertrauen. `ON CONFLICT DO NOTHING` hat am 23.08. eine
-- ganze Migration lautlos verschluckt (Übergabe 75) — seither wird nachgezählt,
-- was tatsächlich dasteht, statt dem Erfolgsmeldung zu glauben.
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'notifications_type_check';
  IF v_def IS NULL OR position('comment_reply' in v_def) = 0 THEN
    RAISE EXCEPTION 'comment_reply steht nach dem Lauf NICHT im CHECK: %', v_def;
  END IF;
END $do$;

-- ── 2. Der Push-Text ────────────────────────────────────────────────────────
--
-- ⚠️ Rumpf ist der LIVE-Stand vom 23.08.2026, MASCHINELL aus einem frischen
-- `pg_dump` übernommen und an genau einer Stelle ergänzt (`/tmp/gen_reply.mjs`:
-- bricht ab, wenn der Anker nicht genau einmal trifft, zählt danach die
-- CREATE-Zeilen und prüft, dass ein Bestandszweig noch dasteht).
--
-- Nicht abgetippt: Bei genau dieser Funktion sind schon zweimal spätere
-- Änderungen verlorengegangen (Übergabe 51 und der Hinweis in
-- `20260814190000`). Der Rumpf enthält damit auch die Ergänzungen vom 21.08.
-- (`saved_search_hit`, das `query`-Feld in der Nutzlast) und vom 23.08.
--
-- `comment_reply` steht bewusst NICHT in der Überspring-Liste ganz oben
-- (`like, comment, follow, follow_request, dm`). Die stehen dort, weil sie
-- einen eigenen Direkt-Push haben — `notify_on_comment` etwa pusht an den
-- AUTOR DES POSTS. Eine Antwort auf einen Kommentar erreicht aber den
-- Kommentierenden, und für den gibt es keinen zweiten Weg. Kein Doppel-Push.

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
    -- Antwort auf einen Kommentar. Ohne eigenen Zweig fiele der Typ in den
    -- ELSE darunter und käme als "Neue Aktivität auf Serlo" an — richtig
    -- zugestellt, aber ohne zu sagen, worum es geht.
    WHEN 'comment_reply' THEN
      v_title := '💬 Antwort auf deinen Kommentar';
      v_body  := COALESCE(v_actor || ': ' || NEW.comment_text,
                          v_actor || ' hat dir geantwortet');
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

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Der Typ ist erlaubt. Erwartet: t.
--
--      SELECT pg_get_constraintdef(oid) LIKE '%comment_reply%'
--        FROM pg_constraint WHERE conname = 'notifications_type_check';
--
-- 2) Kein Bestandstyp verloren. Erwartet: 33 (32 vorher + 1).
--
--      SELECT count(*) FROM regexp_matches(
--        (SELECT pg_get_constraintdef(oid) FROM pg_constraint
--          WHERE conname = 'notifications_type_check'), '''[a-z_]+''', 'g');
--
-- 3) Der Zweig steht im LIVE-Code, nicht nur in dieser Datei. Erwartet: t.
--
--      SELECT prosrc LIKE '%comment_reply%' FROM pg_proc
--       WHERE proname = 'fn_send_push_on_notification';
--
-- 4) Und der Bestand steht noch — die Probe, die bei dieser Funktion zweimal
--    gefehlt hat. Erwartet: beide t.
--
--      SELECT prosrc LIKE '%saved_search_hit%' AS suche,
--             prosrc LIKE '%''query''%'        AS query_feld
--        FROM pg_proc WHERE proname = 'fn_send_push_on_notification';
--
-- 5) Genau eine Signatur, kein HTTP 300. Erwartet: 1.
--
--      SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public' AND p.proname = 'fn_send_push_on_notification';
--
-- 6) ⚠️ Die Probe, die nur zu zweit geht: Konto A kommentiert einen Post,
--    Konto B ANTWORTET auf diesen Kommentar. Bei A muss eine Meldung stehen
--    („hat auf deinen Kommentar geantwortet") und ein Push ankommen, dessen
--    Titel „Antwort auf deinen Kommentar" lautet — NICHT „Neue Aktivität auf
--    Serlo". Gehört in Gruppe B der Prüfliste.
--
--    ⚠️ Und die Gegenprobe dazu: Ein normaler Kommentar auf einen POST muss
--    weiterhin GENAU EINEN Push auslösen, nicht zwei.
