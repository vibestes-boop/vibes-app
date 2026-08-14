-- Zahlungserinnerung: der Sammelkorb meldet sich, bevor das Fenster zugeht.
--
-- Das dritte und letzte der drei Käufer-Ereignisse (Zuschlag und Versand: siehe
-- 20260814180000). Ohne diese Erinnerung verfallen Sammelkörbe, ohne dass jemand
-- es merkt — bei Whatnot ist genau dieser Ping der Motor des Formats.
--
-- KEIN TRIGGER, sondern ein Zeitplan-Job: Das Ereignis ist „eine Frist läuft ab",
-- und Fristen lösen in Postgres nichts aus. `auction_carts.closes_at` trägt die
-- 24-Stunden-Grenze, ein Cron-Lauf sammelt die Körbe kurz davor ein.
--
-- GENAU EINMAL pro Korb — über eine eigene Spalte `reminded_at`, nicht über einen
-- Abgleich gegen bereits gesendete Meldungen. Eine Spalte ist billiger, eindeutig
-- und übersteht auch das spätere Löschen alter notifications-Zeilen.
--
-- WIE HART IST DIE FRIST? Weicher, als der Countdown in der App vermuten lässt.
-- `ensure_auction_cart` setzt abgelaufene Körbe auf 'expired', aber TRÄGE — erst
-- wenn derselbe Käufer beim selben Verkäufer erneut etwas gewinnt. Passiert das
-- nie, bleibt der Korb offen und ist weiterhin bezahlbar (`checkout_auction_cart`
-- prüft nur den Zustand, nicht `closes_at`). Für den Umsatz ist das eher gut, für
-- die Ehrlichkeit der Anzeige nicht. Diese Migration ändert daran BEWUSST NICHTS:
-- Körbe hart verfallen zu lassen ist eine Geschäftsentscheidung, keine technische.
-- Der Erinnerungstext nennt die verbleibende Zeit, droht aber nicht mit Verfall.

BEGIN;

-- ─── 1. Einmal-Garantie ──────────────────────────────────────────────────────
ALTER TABLE public.auction_carts
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

-- Der Job fragt jede Viertelstunde nach fälligen Körben. Partieller Index, weil
-- nur die noch nicht erinnerten interessieren — das ist auf Dauer eine Handvoll
-- Zeilen, nicht die ganze Tabelle.
CREATE INDEX IF NOT EXISTS idx_auction_carts_reminder_due
  ON public.auction_carts (closes_at)
  WHERE reminded_at IS NULL AND status IN ('open', 'checkout_pending');

-- ─── 2. Der Lauf ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remind_due_auction_carts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  c       record;
  v_cents bigint;
  v_items int;
  v_hours int;
  v_sent  int := 0;
BEGIN
  FOR c IN
    SELECT id, buyer_id, seller_id, closes_at
      FROM public.auction_carts
     -- Beides sind unbezahlte Zustände mit Ware. 'checkout_pending' heißt: Der
     -- Käufer hat „Bezahlen" gedrückt und es nicht zu Ende gebracht — genau der,
     -- den man erinnern will.
     WHERE status IN ('open', 'checkout_pending')
       AND reminded_at IS NULL
       -- Nicht mehr erinnern, wenn das Fenster ohnehin schon zu ist.
       AND closes_at > now()
       AND closes_at <= now() + interval '4 hours'
     ORDER BY closes_at
     -- Zwei überlappende Läufe dürfen denselben Korb nicht doppelt anfassen.
     FOR UPDATE SKIP LOCKED
  LOOP
    SELECT COALESCE(SUM(current_bid_cents), 0), COUNT(*)
      INTO v_cents, v_items
      FROM public.live_auctions
     WHERE cart_id = c.id AND status = 'sold';

    -- Leerer Korb: nichts zu bezahlen, also nichts zu erinnern. Trotzdem
    -- markieren, damit ihn nicht jeder weitere Lauf erneut aufgreift.
    IF v_items = 0 OR v_cents <= 0 THEN
      UPDATE public.auction_carts SET reminded_at = now() WHERE id = c.id;
      CONTINUE;
    END IF;

    v_hours := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (c.closes_at - now())) / 3600)::int);

    INSERT INTO public.notifications
      (recipient_id, sender_id, type, comment_text, app)
    VALUES (
      c.buyer_id,
      c.seller_id,
      'order_payment_reminder',
      -- Cent-Arithmetik in Integer, kein Fließkomma.
      format('%s Artikel · %s,%s € — noch %s h',
             v_items, v_cents / 100, lpad((v_cents % 100)::text, 2, '0'), v_hours),
      'berkat'
    );

    UPDATE public.auction_carts SET reminded_at = now() WHERE id = c.id;
    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$fn$;

REVOKE ALL ON FUNCTION public.remind_due_auction_carts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remind_due_auction_carts() TO service_role;

-- ─── 3. Erinnerungstext nach App verzweigen ──────────────────────────────────
-- `order_payment_reminder` gab es schon — mit Serlo-Wortlaut („Dein Parfüm
-- wartet"). Rumpf ist wieder der LIVE-Stand, maschinell übernommen und nur an
-- dieser einen Stelle ergänzt.
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Push darf den auslösenden INSERT niemals scheitern lassen.
  RETURN NEW;
END;
$$;

-- ─── 4. Zeitplan ─────────────────────────────────────────────────────────────
-- Viertelstündlich: Bei einem 4-Stunden-Vorlauf ist das genau genug, und der
-- partielle Index macht den Lauf billig. Gleiche Bauform wie
-- 'settle-live-auctions' aus 20260813150000.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'remind-auction-carts';
    PERFORM cron.schedule(
      'remind-auction-carts',
      '*/15 * * * *',
      $cron$SELECT public.remind_due_auction_carts();$cron$
    );
    RAISE NOTICE 'remind-auction-carts läuft alle 15 Minuten';
  ELSE
    RAISE NOTICE 'pg_cron fehlt — Zahlungserinnerung wird NICHT verschickt';
  END IF;
END $$;

COMMIT;

-- ─── Bewusst nicht gebaut ────────────────────────────────────────────────────
-- Eine ZWEITE Erinnerung (etwa 1 h vor Schluss). Design-Gesetz 3 der App:
-- maßhalten, nur Peaks feiern, kein Drängeln. Ein Ping reicht; wer dann nicht
-- zahlt, zahlt auch beim dritten nicht — und die enge Community reagiert auf
-- Druck empfindlicher als auf Stille.
--
-- Harter Verfall abgelaufener Körbe per Cron. Siehe Kopf: Geschäftsentscheidung.
