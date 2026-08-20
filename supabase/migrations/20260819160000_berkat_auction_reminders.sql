-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: „Sag mir, wenn der drankommt" — die Glocke je Artikel
--
-- Seit dem 19.08.2026 sieht ein Käufer vorab, was an einem angekündigten Abend
-- drankommt (HANDOFF 49), und kann ein Vorabgebot hinterlegen (HANDOFF 50).
-- Dazwischen fehlt der leiseste Fall: Wer nur EINEN Artikel will, will kein
-- Höchstgebot abgeben — er will dabei sein, wenn genau der aufgerufen wird.
--
-- ⚠️ DER UNTERSCHÄTZTE TEIL IST NICHT DER PUSH, SONDERN DIE ZAHL.
-- Sie sagt dem VERKÄUFER, welcher Artikel Nachfrage hat, **bevor** er ihn
-- aufruft — er kann die Reihenfolge des Abends danach legen. Genau deshalb
-- zeigt Whatnot sie dem Verkäufer und nicht nur dem Käufer (HANDOFF 41, Nr. 4).
--
-- ⚠️ EIN NEUER `notifications`-TYP — UND WARUM ER DIESMAL GERECHTFERTIGT IST
-- Zweimal wurde er hier ausdrücklich ABGELEHNT: bei den Belohnungen
-- (HANDOFF 18) und beim Preisvorschlag (HANDOFF 24), beide Male mit derselben
-- Begründung — „ein Typ braucht neun Oberflächen, und wer nur einen Teil
-- anfasst, bekommt ‚Neue Aktivität auf Serlo'". Diese Begründung gilt weiter.
-- Sie trifft hier nur nicht zu:
--
--   Eine Belohnung ist nicht eilig, ein Preisvorschlag auch nicht — beide
--   können im Aktivitäts-Reiter warten. Diese Meldung hat eine Halbwertszeit
--   von SEKUNDEN. Eine Auktion dauert zwanzig; eine Nachricht, die erst beim
--   nächsten App-Start gelesen wird, ist wertlos. Wenn ein Push je gerechtfertigt
--   ist, dann hier.
--
-- Die neun Oberflächen sind es außerdem nicht. Berkats Meldungsliste filtert auf
-- `app = 'berkat'` und hat ihre eigene Darstellung; Serlos Liste rendert einen
-- unbekannten Typ über ihren Standardzweig. Angefasst werden deshalb: der CHECK,
-- der Text-CASE (beides hier), Berkats Liste und ihr Typ (im Client).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Die Vormerkung ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.berkat_auction_reminders (
  auction_id uuid NOT NULL REFERENCES public.live_auctions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (auction_id, user_id)
);

COMMENT ON TABLE public.berkat_auction_reminders IS
  'Wer will benachrichtigt werden, wenn dieser vorbereitete Artikel aufgerufen wird. '
  'Wird beim Start der Auktion verbraucht (start_live_auction).';

ALTER TABLE public.berkat_auction_reminders ENABLE ROW LEVEL SECURITY;

-- Jeder sieht nur seine eigene Vormerkung. Die ANZAHL bekommt der Verkäufer
-- über eine eigene Funktion — nicht über diese Tabelle, denn dann sähe er auch,
-- WER sich vorgemerkt hat. In einer Gemeinschaft, in der man sich kennt, ist
-- „ich will das haben" nichts, was der Verkäufer namentlich wissen muss.
DROP POLICY IF EXISTS berkat_reminders_select_own ON public.berkat_auction_reminders;
CREATE POLICY berkat_reminders_select_own ON public.berkat_auction_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ⚠️ Vormerken geht NUR auf einen vorbereiteten Artikel, und nur auf einen
-- sichtbaren. Die Bedingung erbt die Frauen-Only-Schranke vom Artikel, statt
-- sie zu wiederholen — dieselbe Lehre wie in `20260819130000`: erben, nicht
-- fragen. Ohne den EXISTS-Block könnte sich jeder auf jede beliebige
-- Auktions-ID vormerken, auch auf eine geschützte, und der Fan-out beim Start
-- schickte ihm den Titel frei Haus.
DROP POLICY IF EXISTS berkat_reminders_insert_own ON public.berkat_auction_reminders;
CREATE POLICY berkat_reminders_insert_own ON public.berkat_auction_reminders
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.live_auctions a
       WHERE a.id = berkat_auction_reminders.auction_id
         AND a.session_id IS NULL
         AND a.status = 'scheduled'
         -- Auf eigene Artikel merkt man sich nichts vor.
         AND a.seller_id <> auth.uid()
         AND (
           a.women_only = false
           OR public.is_women_only_verified()
         )
    )
  );

DROP POLICY IF EXISTS berkat_reminders_delete_own ON public.berkat_auction_reminders;
CREATE POLICY berkat_reminders_delete_own ON public.berkat_auction_reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.berkat_auction_reminders FROM anon;
GRANT SELECT, INSERT, DELETE ON public.berkat_auction_reminders TO authenticated;

-- Der Fan-out beim Start liest nach `auction_id`; der PK deckt das ab. Für die
-- Zähl-Funktion über mehrere Artikel ebenso.

-- ─── 2. Der Meldungstyp ──────────────────────────────────────────────────────
-- ⚠️ Dynamisch, mit UNION über die bestehenden Werte: So kann diese Migration
-- keinen Typ verlieren, der nach dem Schreiben dieser Datei dazugekommen ist.
-- Muster aus `20260705150000`, unverändert übernommen.
DO $do$
DECLARE
  v_types text;
BEGIN
  SELECT string_agg(quote_literal(t), ', ') INTO v_types
  FROM (
    SELECT t FROM unnest(ARRAY[
      'like','comment','follow','dm','live','live_invite','gift',
      'scheduled_live_reminder','new_order','mention','follow_request',
      'follow_request_accepted','comment_like','repost','story_reaction','guild',
      'preorder_interest','preorder_round_open',
      'order_payment_requested','order_payment_reminder','order_paid',
      'order_shipped','order_cancelled','order_address_updated',
      'order_review','order_dispute','product_saved','support_reply','support_new',
      'auction_won',
      -- NEU
      'auction_up'
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

-- ─── 3. Der Push-Text ────────────────────────────────────────────────────────
-- ⚠️ Rumpf ist der LIVE-Stand, maschinell aus `supabase db dump` übernommen und
-- an EINER Stelle ergänzt (ein WHEN vor dem ELSE). Nicht abgetippt — bei genau
-- dieser Funktion sind schon einmal spätere Änderungen verlorengegangen
-- (CLAUDE.md, buy_product; und der Hinweis steht auch in 20260814190000).
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

-- ─── 4. Beim Start benachrichtigen ───────────────────────────────────────────
-- ⚠️ Ebenfalls der Live-Stand (also die Fassung aus `20260819150000` inklusive
-- Vorabgebot-Auflösung), maschinell übernommen, ergänzt um den Fan-out und das
-- Aufräumen.
CREATE OR REPLACE FUNCTION "public"."start_live_auction"("p_auction_id" "uuid", "p_duration_seconds" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  a       public.live_auctions;
  v_host  uuid;
  v_uid   uuid := auth.uid();
  v_ends  timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_duration_seconds < 5 OR p_duration_seconds > 600 THEN
    RAISE EXCEPTION 'invalid_duration' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT host_id INTO v_host FROM public.live_sessions WHERE id = a.session_id;

  -- Host oder Moderator. Der Helper schließt seit v1.27.2 aktive CoHosts ein,
  -- damit gilt hier dieselbe Autoritätsgrenze wie bei der Chat-Moderation.
  --
  -- Nebenwirkung, die hier zum Schutz wird: Ein VORBEREITETER Artikel hat keine
  -- Session, `v_host` ist damit NULL und der Vergleich schlägt fehl. Er lässt
  -- sich also nicht starten, bevor `claim_prepared_auctions` ihn in eine Show
  -- geholt hat — genau richtig.
  IF v_host IS DISTINCT FROM v_uid
     AND NOT public.is_live_session_moderator(a.session_id, v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF a.status <> 'scheduled' THEN
    RAISE EXCEPTION 'auction_not_scheduled' USING ERRCODE = '22023';
  END IF;

  -- Nur eine laufende Auktion pro Stream. Sonst konkurrieren zwei Countdowns
  -- um denselben Daumen.
  IF EXISTS (
    SELECT 1 FROM public.live_auctions
     WHERE session_id = a.session_id AND status = 'running'
  ) THEN
    RAISE EXCEPTION 'another_auction_running' USING ERRCODE = '22023';
  END IF;

  v_ends := now() + make_interval(secs => p_duration_seconds);

  UPDATE public.live_auctions
     SET status     = 'running',
         started_at = now(),
         ends_at    = v_ends
   WHERE id = a.id;

  -- Vorabgebote gelten ab jetzt. Der Aufruf steht NACH dem UPDATE, weil
  -- `resolve_auto_bids` auf `status = 'running'` prüft und vorher nichts täte.
  -- Er ist folgenlos, wenn niemand vorab geboten hat.
  PERFORM public.resolve_auto_bids(a.id);

  -- Und die Glocke: Wer sich den Artikel vorgemerkt hat, erfährt es jetzt.
  --
  -- Ein mengenbasiertes INSERT statt einer Schleife. Der Trigger auf
  -- `notifications` feuert je Zeile und schickt den Push über pg_net, also
  -- ASYNCHRON — der Start der Auktion wartet auf nichts. Bei fünfzig
  -- Vormerkungen sind es fünfzig Warteschlangen-Einträge, keine fünfzig
  -- HTTP-Aufrufe.
  --
  -- ⚠️ `app = 'berkat'` ist Pflicht. Ohne das ginge die Meldung nach der
  -- Voreinstellung an das SERLO-Gerät des Nutzers (20260814190000) — genau
  -- der Fehler, den die App-Trennung damals beheben sollte.
  --
  -- `session_id` mitzugeben ist der eigentliche Nutzen: Ein Tipp auf die
  -- Meldung landet im laufenden Raum, nicht auf einer Übersicht. Bei einer
  -- Auktion, die zwanzig Sekunden dauert, ist jeder Zwischenschritt einer
  -- zu viel.
  INSERT INTO public.notifications (recipient_id, sender_id, type, app, session_id, comment_text)
  SELECT r.user_id, a.seller_id, 'auction_up', 'berkat', a.session_id,
         a.title || ' · ab ' || to_char(a.start_price_cents / 100.0, 'FM999G999D00') || ' €'
    FROM public.berkat_auction_reminders r
   WHERE r.auction_id = a.id
     AND r.user_id <> a.seller_id;

  -- Verbraucht. Eine Vormerkung hat genau einen Zweck, und der ist jetzt
  -- erfüllt — sie stehen zu lassen hieße, dem Verkäufer beim nächsten Blick
  -- eine Nachfrage anzuzeigen, die längst bedient ist.
  DELETE FROM public.berkat_auction_reminders WHERE auction_id = a.id;

  -- Neu einlesen: Die Auflösung kann Gebotsstand und Führenden gesetzt haben,
  -- und `next_min_cents` wäre sonst der Startpreis — also eine Zahl, unter der
  -- der erste Handbieter sofort abgewiesen würde.
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'auction_id',    a.id,
    'status',        'running',
    'ends_at',       v_ends,
    'next_min_cents', CASE
                        WHEN a.current_bid_cents IS NULL THEN a.start_price_cents
                        ELSE a.current_bid_cents + a.min_increment_cents
                      END
  );
END $$;

-- ─── 5. Das Nachfrage-Signal für den Verkäufer ───────────────────────────────
-- Nur die ANZAHL, nie die Namen — Begründung an der SELECT-Policy oben.
-- Dieselbe Trennung wie bei `get_prebid_counts` (20260819150000),
-- `get_seller_rating` und `get_vouch_weights`.
CREATE OR REPLACE FUNCTION public.get_reminder_counts(p_auction_ids uuid[])
RETURNS TABLE (auction_id uuid, watchers int)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
  SELECT r.auction_id, count(*)::int
    FROM public.berkat_auction_reminders r
    JOIN public.live_auctions a ON a.id = r.auction_id
   WHERE r.auction_id = ANY (p_auction_ids)
     -- Nur die eigenen Artikel. Ohne das könnte jeder die Nachfrage eines
     -- fremden Verkäufers ausmessen.
     AND a.seller_id = auth.uid()
   GROUP BY r.auction_id;
$fn$;

REVOKE ALL ON FUNCTION public.get_reminder_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reminder_counts(uuid[]) TO authenticated;

-- ─── Gegenprobe ──────────────────────────────────────────────────────────────
-- 1. Vormerken geht auf einen fremden, vorbereiteten Artikel:
--      INSERT INTO berkat_auction_reminders (auction_id, user_id)
--      VALUES ('<fremder vorbereiteter Artikel>', auth.uid());
--
-- 2. Auf den EIGENEN Artikel nicht:
--      -- muss an der INSERT-Policy scheitern (42501)
--
-- 3. Auf einen Artikel in einer laufenden Show nicht:
--      -- ebenfalls 42501, weil session_id NOT NULL
--
-- 4. Beim Start entsteht die Meldung und die Vormerkung ist weg:
--      SELECT start_live_auction('<Artikel>', 30);
--      SELECT type, app, session_id FROM notifications ORDER BY created_at DESC LIMIT 1;
--      -- type = 'auction_up', app = 'berkat', session_id gesetzt
--      SELECT count(*) FROM berkat_auction_reminders WHERE auction_id = '<Artikel>';
--      -- muss 0 sein
--
-- 5. Der Typ ist erlaubt und kein anderer verlorengegangen:
--      SELECT pg_get_constraintdef(oid) FROM pg_constraint
--       WHERE conname = 'notifications_type_check';
--      -- muss 'auction_up' UND alle bisherigen enthalten
--
-- 6. Rechte (die credit_coins-Falle):
--      SELECT has_function_privilege('anon', 'public.get_reminder_counts(uuid[])', 'EXECUTE');
--      -- muss false sein
