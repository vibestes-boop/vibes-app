-- ═══════════════════════════════════════════════════════════════════════════
-- Gespeicherte Suche — wer nichts findet, bekommt Bescheid, wenn etwas kommt
-- 21.08.2026 · Berkat · neunte Whatnot-Analyse, Korb A
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WOZU
-- Eine erfolglose Suche ist heute verloren. Wer „Abaya 42" tippt und nichts
-- findet, geht — und erfährt nie, dass zwei Tage später genau das eingestellt
-- wurde. Whatnot lässt dieselbe Geste dreierlei merken: eine Sendung, ein
-- Angebot ODER eine Suche (`help.whatnot.com/hc/de/articles/9780885421069`).
--
-- Das ist das einzige Werkzeug aus der ganzen Analyse, das eine erfolglose
-- Suche in einen späteren Besuch verwandelt — und es wirkt bei Berkats DÜNNEM
-- Regal stärker als bei Whatnots vollem: Je öfter eine Suche ins Leere läuft,
-- desto mehr ist sie wert.
--
-- ⚠️ WARUM HIER EIN PUSH GERECHTFERTIGT IST
-- Zweimal wurde ein neuer `notifications`-Typ in diesem Projekt ABGELEHNT — bei
-- den Belohnungen (Abschnitt 18) und beim Preisvorschlag (Abschnitt 24), beide
-- Male mit „ist nicht eilig, kann im Aktivitäts-Reiter warten". Bei `auction_up`
-- (Abschnitt 51) trug die Begründung „Halbwertszeit von Sekunden".
--
-- Hier gilt eine DRITTE Begründung, und sie ist die stärkste: Der Zweck dieser
-- Meldung ist, jemanden ZURÜCKZUHOLEN, der die App verlassen hat. Eine Zeile im
-- Aktivitäts-Reiter erreicht nur den, der ohnehin schon da ist — für eine
-- gespeicherte Suche ist das kein halber Nutzen, sondern gar keiner.
--
-- ⚠️ FRAUEN-ONLY WIRD GEERBT, NICHT GEFRAGT
-- Die Lehre aus `20260819130000`: Eine SECURITY-DEFINER-Funktion sieht an RLS
-- vorbei. Der Trigger prüft deshalb selbst, ob der Empfänger den Artikel sehen
-- dürfte — sonst verriete eine Push-Meldung die Existenz eines Frauen-Only-
-- Angebots an jeden, der zufällig das passende Wort gespeichert hat.

-- ─── 1. Die Tabelle ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.berkat_saved_searches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Nur der Suchtext, KEINE Filter. Absicht: Filter (Kategorie, Größe, Zustand,
  -- Ort, Preis) würden das Treffer-Prädikat vervielfachen, und ein Treffer, den
  -- der Nutzer nicht nachvollziehen kann, ist schlimmer als keiner. Der Text
  -- wird gegen dieselben drei Felder gehalten wie die Suche im Regal:
  -- Titel, Größe, Ort (Abschnitt 47).
  query       text NOT NULL CHECK (char_length(btrim(query)) BETWEEN 2 AND 60),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Die Drossel. Ohne sie erzeugt ein Verkäufer, der zwanzig Abayas einstellt,
  -- zwanzig Pushes — und verliert die Push-Berechtigung für alle.
  last_notified_at timestamptz
);

-- Dieselbe Suche zweimal zu speichern ist kein Fehler, sondern ein Fehltipp.
CREATE UNIQUE INDEX IF NOT EXISTS berkat_saved_searches_one_per_user
  ON public.berkat_saved_searches (user_id, lower(btrim(query)));

CREATE INDEX IF NOT EXISTS berkat_saved_searches_user
  ON public.berkat_saved_searches (user_id, created_at DESC);

ALTER TABLE public.berkat_saved_searches ENABLE ROW LEVEL SECURITY;

-- Eine gespeicherte Suche ist ein Wunsch, und ein Wunsch geht niemanden sonst
-- etwas an — kein `USING (true)`, auch nicht für den Verkäufer. (Whatnots
-- „unbeantwortete Suchen dem Verkäufer zeigen" wäre eine eigene, aggregierte
-- Abfrage; sie steht in Korb C und braucht dann eine RPC, nicht diese Policy.)
DROP POLICY IF EXISTS berkat_saved_searches_select ON public.berkat_saved_searches;
CREATE POLICY berkat_saved_searches_select ON public.berkat_saved_searches
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS berkat_saved_searches_insert ON public.berkat_saved_searches;
CREATE POLICY berkat_saved_searches_insert ON public.berkat_saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS berkat_saved_searches_delete ON public.berkat_saved_searches;
CREATE POLICY berkat_saved_searches_delete ON public.berkat_saved_searches
  FOR DELETE USING (auth.uid() = user_id);

-- Kein UPDATE: Eine Suche ändert man nicht, man legt eine neue an. Damit kann
-- auch `last_notified_at` niemand vom Client aus zurücksetzen und die Drossel
-- umgehen — der Trigger schreibt sie als SECURITY DEFINER.

REVOKE ALL ON public.berkat_saved_searches FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.berkat_saved_searches TO authenticated;

-- ─── 2. Der neue Meldungstyp ────────────────────────────────────────────────
-- UNION mit dem Bestand, damit kein bestehender Typ verlorengeht (Muster aus
-- `20260819160000`).
DO $do$
DECLARE v_types text;
BEGIN
  SELECT string_agg(quote_literal(t), ', ' ORDER BY t) INTO v_types
  FROM (
    SELECT unnest(ARRAY[
      'like','comment','follow','dm','live','live_invite','gift',
      'scheduled_live_reminder','new_order','mention','follow_request',
      'follow_request_accepted','comment_like','repost','story_reaction','guild',
      'preorder_interest','preorder_round_open',
      'order_payment_requested','order_payment_reminder','order_paid',
      'order_shipped','order_cancelled','order_address_updated',
      'order_review','order_dispute','product_saved','support_reply','support_new',
      'auction_won','auction_up',
      -- NEU
      'saved_search_hit'
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

-- ─── 3. Der Push-Text ───────────────────────────────────────────────────────
-- ⚠️ Rumpf ist der LIVE-Stand vom 21.08.2026, maschinell aus `supabase db dump`
-- übernommen und an EINER Stelle ergänzt (ein WHEN vor dem `auction_up`-Zweig).
-- Nicht abgetippt: Bei genau dieser Funktion sind schon zweimal spätere
-- Änderungen verlorengegangen (Abschnitt 51, und der Hinweis in 20260814190000).
-- Nach dem Schneiden wurden die CREATE-Zeilen gezählt — genau eine.
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

-- ─── 4. Der Trigger, der Treffer meldet ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_saved_searches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  s record;
BEGIN
  -- Nur Regal-Angebote. Ein Show-Artikel (`session_id IS NOT NULL`) ist nicht
  -- dauerhaft kaufbar, und ein vorbereiteter (`scheduled`) gehört noch keinem
  -- Regal an — eine Meldung darauf ginge ins Leere.
  IF NEW.status <> 'listed' OR NEW.session_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR s IN
    -- ⚠️ `DISTINCT ON (ss.user_id)`: HÖCHSTENS EINE Meldung je Mensch und
    -- Angebot. Ohne das erzeugte ein einziges „Abaya schwarz, Gr. 42, Berlin"
    -- bei jemandem mit fünf gespeicherten Suchen fünf Pushes in derselben
    -- Sekunde — im lokalen Postgres nachgestellt. Die zuletzt gespeicherte
    -- Suche gewinnt; sie liefert auch den Begriff fürs Sprungziel.
    SELECT DISTINCT ON (ss.user_id) ss.id, ss.user_id, ss.query
      FROM public.berkat_saved_searches ss
      -- Das Muster einmal je Zeile bauen, statt es dreimal zu wiederholen.
      CROSS JOIN LATERAL (
        SELECT '%' || replace(replace(replace(
                 lower(btrim(ss.query)), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pat
      ) p
     WHERE ss.user_id <> NEW.seller_id
       -- Drossel 1, je Suche.
       AND (ss.last_notified_at IS NULL
            OR ss.last_notified_at < now() - interval '20 hours')
       -- ⚠️ Drossel 2, je MENSCH. Die erste allein reicht nicht: Sie hängt an
       -- der Zeile, und wer viele Suchen hat, hat viele Zeilen. Serverseitig
       -- ist deren Zahl durch nichts begrenzt — RLS erlaubt beliebig viele
       -- INSERTs, der eindeutige Index verhindert nur exakte Dubletten, und
       -- das `.limit(50)` im Client ist eine Anzeige-Grenze, kein Riegel.
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
          WHERE n.recipient_id = ss.user_id
            AND n.type = 'saved_search_hit'
            AND n.app = 'berkat'
            AND n.created_at > now() - interval '20 hours'
       )
       -- ⚠️ FELDWEISE, nicht über einen verketteten Gesamttext. Die erste
       -- Fassung baute `concat_ws(' ', title, size, city)` und suchte darin —
       -- damit traf „Abaya 42" auf „abaya 42 berlin", die Regal-Suche im
       -- Client aber NICHT (`app/shop.tsx` prüft jedes Feld einzeln). Die
       -- Meldung hätte einen Treffer versprochen, den die App danach nicht
       -- zeigen kann, und dabei die 20-Stunden-Drossel verbraucht.
       -- **Server und Client müssen dieselbe Frage stellen.**
       AND (
         lower(NEW.title) LIKE p.pat ESCAPE '\'
         OR lower(coalesce(NEW.size, '')) LIKE p.pat ESCAPE '\'
         OR lower(coalesce(NEW.city, '')) LIKE p.pat ESCAPE '\'
       )
       -- ⚠️ Frauen-Only wird hier GEPRÜFT, nicht geerbt-durch-RLS: Diese
       -- Funktion läuft als SECURITY DEFINER und sieht an jeder Policy vorbei.
       --
       -- BEIDE Hälften, und das ist der Punkt: Die echte Lesegrenze ist
       -- `is_women_only_verified()`, und die verlangt `gender = 'female'` UND
       -- `women_only_verified = true`. Die erste Fassung prüfte nur die zweite.
       -- Ein Konto, das freigegeben wurde und danach sein Geschlecht ändert
       -- (erlaubt — der Sperr-Trigger schützt nur `women_only_verified`),
       -- hätte die Meldung samt Titel bekommen, während das Regal ihm
       -- dasselbe Angebot verweigert. Zwei Wahrheiten darüber, wer in der
       -- Frauen-Zone ist — genau das Metadaten-Leck, das `20260819140000` an
       -- vier anderen Tabellen geschlossen hat.
       --
       -- Der Helper selbst ist hier NICHT einsetzbar: Er läuft auf
       -- `auth.uid()`, und das ist im Trigger der VERKÄUFER, nicht der
       -- Empfänger. Deshalb Handarbeit — aber vollständig.
       AND (
         NEW.women_only = false
         OR EXISTS (
           SELECT 1 FROM public.profiles pr
            WHERE pr.id = ss.user_id
              AND pr.gender = 'female'
              AND pr.women_only_verified = true
         )
       )
     ORDER BY ss.user_id, ss.created_at DESC
  LOOP
    INSERT INTO public.notifications
      (recipient_id, sender_id, type, product_name, comment_text, app)
    VALUES (
      s.user_id,
      NEW.seller_id,
      'saved_search_hit',
      -- ⚠️ `product_name` trägt hier den SUCHBEGRIFF, nicht den Artikelnamen.
      -- Absicht: Der Client baut daraus das Sprungziel `/shop?q=…`, und dafür
      -- braucht er den Begriff sauber — nicht aus einem zusammengesetzten Satz
      -- herausgeschnitten. Der Artikelname steht vollständig in `comment_text`.
      btrim(s.query),
      -- Beide Hälften: was gefunden wurde UND wonach gesucht war. Ohne das
      -- zweite weiß der Empfänger nach zwei Wochen nicht mehr, warum er das
      -- bekommt.
      format('%s · passend zu „%s"', NEW.title, btrim(s.query)),
      -- ⚠️ Ohne `app` ginge die Meldung nach Voreinstellung ans SERLO-Gerät
      -- (`20260814190000`) — genau der Fehler, den die App-Trennung behebt.
      'berkat'
    );

    -- ⚠️ ALLE Suchen dieses Menschen stempeln, nicht nur die getroffene. Sonst
    -- bliebe der Rest sofort wieder feuerbereit und das nächste Angebot löste
    -- die nächste Meldung aus — die Drossel wäre wirkungslos.
    UPDATE public.berkat_saved_searches
       SET last_notified_at = now()
     WHERE user_id = s.user_id;
  END LOOP;

  RETURN NEW;
END;
$fn$;

-- Stützt die Personen-Drossel oben (das NOT EXISTS auf `notifications`).
-- Teil-Index, damit er Serlos Meldungen nicht mitträgt.
CREATE INDEX IF NOT EXISTS notifications_saved_search_recent
  ON public.notifications (recipient_id, created_at DESC)
  WHERE type = 'saved_search_hit';

REVOKE ALL ON FUNCTION public.notify_saved_searches() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_saved_searches ON public.live_auctions;
CREATE TRIGGER trg_notify_saved_searches
  AFTER INSERT ON public.live_auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_saved_searches();

-- ⚠️ NUR AFTER INSERT, nicht AFTER UPDATE. Ein Angebot, dessen Titel später
-- geändert wird, meldet sich also nicht nachträglich. Das ist Absicht: Bei
-- UPDATE müsste der Trigger unterscheiden, ob der Titel sich wirklich geändert
-- hat, und ein Verkäufer, der dreimal nachbessert, löste drei Meldungen aus.
-- Der Preis dafür ist ein verpasster Treffer bei einer Titeländerung — das ist
-- der billigere Fehler.

-- ═══════════════════════════════════════════════════════════════════════════
-- GEGENPROBEN nach dem Einspielen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Tabelle für anon dicht (muss 401/42501 geben):
--      curl -s "$URL/rest/v1/berkat_saved_searches?select=id" -H "apikey: $ANON"
--
-- 2. Der Typ ist im CHECK und nichts ging verloren (muss 32 sein, vorher 31):
--      SELECT count(*) FROM regexp_split_to_table(
--        (SELECT pg_get_constraintdef(oid) FROM pg_constraint
--          WHERE conname = 'notifications_type_check'), ',');
--
-- 3. Der Push-Zweig steht im Live-Code:
--      SELECT prosrc LIKE '%saved_search_hit%'
--        FROM pg_proc WHERE proname = 'fn_send_push_on_notification';
--
-- 4. Trigger hängt:
--      SELECT tgname FROM pg_trigger WHERE tgname = 'trg_notify_saved_searches';
--
-- 5. Die Drossel greift — zweimal einstellen, es darf nur EINE Meldung geben:
--      SELECT count(*) FROM notifications WHERE type = 'saved_search_hit';
--
-- 6. Frauen-Only: Ein WOZ-Angebot darf bei einem ungeprüften Konto mit
--    passender Suche KEINE Meldung erzeugen. (Braucht ein geprüftes
--    Frauenkonto — steht in der Prüfliste, Abschnitt 56, Gruppe E.)
