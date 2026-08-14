-- Benachrichtigungen an den Käufer: Zuschlag und Versand.
--
-- Bis jetzt lief die Kette stumm in eine Richtung. Der Verkäufer erfährt, dass
-- bezahlt wurde (`order_paid`). Der Käufer erfuhr nichts — nicht, dass er gewonnen
-- hat, nicht, dass sein Paket unterwegs ist. Er musste von sich aus nachsehen.
--
-- WARUM TRIGGER STATT RPC-ÄNDERUNG: Ein Zuschlag entsteht auf ZWEI Wegen —
-- `settle_live_auction` (Uhr abgelaufen) und `buy_now_live_auction` (Sofortkauf).
-- Beide setzen `status='sold'` + `winner_id`. Ein Trigger auf der Spalte greift für
-- beide und kann nicht auseinanderlaufen, wenn später ein dritter Weg dazukommt.
-- Außerdem müssten sonst zwei umfangreiche Rümpfe per CREATE OR REPLACE neu
-- geschrieben werden — genau die Stelle, an der schon einmal spätere Änderungen
-- verloren gingen (siehe CLAUDE.md, buy_product-Guard).
--
-- ZUSTELLUNG: Ein INSERT in `notifications` löst über `trg_push_notification`
-- (Migration 20260410030000) automatisch `send-push-notification` aus, das
-- wiederum den Web-Push weiterreicht. Die Zeile ist also Quelle für alle Wege.
--
-- ⚠️ Die Mobil-App Berkat hat noch KEIN Push (kein `expo-notifications`, keine
-- Token-Registrierung), und `profiles.push_token` ist EINE Spalte, die sich Serlo
-- und Berkat teilen. Diese Migration legt die Quelle an; die Zustellung an ein
-- Berkat-Gerät braucht zusätzlich Token-Routing pro App und einen EAS-Rebuild.
-- Wer beide Apps hat, bekommt die Ping vorerst in Serlo.

BEGIN;

-- ─── 1. Neuer Typ `auction_won` ──────────────────────────────────────────────
-- `order_shipped` und `order_payment_reminder` gibt es bereits; für den Zuschlag
-- fehlte ein eigener Typ. Vollständige Liste neu setzen (CHECK kennt kein ADD).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'auction_won',
    'order_payment_reminder','scheduled_live_reminder','preorder_interest','support_new',
    'order_review','order_address_updated','order_dispute','new_order','live_invite',
    'order_payment_requested','like','comment','preorder_round_open','guild','order_paid',
    'support_reply','follow_request','follow_request_accepted','gift','repost','dm',
    'order_shipped','order_cancelled','story_reaction','product_saved','follow','mention',
    'comment_like','live'
  ]::text[])
);

-- ─── 2. Zuschlag ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_auction_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cents integer := COALESCE(NEW.current_bid_cents, 0);
BEGIN
  -- Nur der echte Übergang nach 'sold' mit Gewinner. Ein erneutes UPDATE auf
  -- einer bereits verkauften Zeile darf nicht ein zweites Mal pingen.
  IF NEW.status <> 'sold'
     OR OLD.status IS NOT DISTINCT FROM 'sold'
     OR NEW.winner_id IS NULL
     -- Sicherheitsnetz: der Server lässt niemanden auf eigene Artikel bieten
     -- (seller_cannot_bid). Falls doch je ein Weg daran vorbeiführt, soll sich
     -- niemand selbst benachrichtigen.
     OR NEW.winner_id = NEW.seller_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, session_id, product_name, comment_text)
  VALUES (
    NEW.winner_id,
    NEW.seller_id,
    'auction_won',
    NEW.session_id,
    NEW.title,
    -- Betrag bewusst hier formatiert, nicht in der App: Der Text geht
    -- unverändert in Push-Titel UND In-App-Liste. Cent-Arithmetik in Integer,
    -- kein Fließkomma — ein Rundungsfehler in einer Auktion ist ein Rechtsstreit.
    format('%s · %s,%s €', NEW.title, v_cents / 100, lpad((v_cents % 100)::text, 2, '0'))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_auction_won ON public.live_auctions;
CREATE TRIGGER trg_notify_auction_won
  AFTER UPDATE OF status ON public.live_auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auction_won();

-- ─── 3. Versendet ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_order_shipped()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status <> 'shipped'
     OR OLD.status IS NOT DISTINCT FROM 'shipped'
     OR NEW.buyer_id IS NULL
     -- BEWUSST auf Berkat begrenzt: `cart_id` trägt nur eine Auktions-Bestellung,
     -- bei einem Serlo-Produktkauf ist sie NULL (dieselbe Weiche wie in
     -- create-checkout-session). Serlos Shop bekam bisher nie ein Versand-Ping;
     -- das hier still mitzuändern wäre eine Verhaltensänderung an einem
     -- laufenden Produkt. Wer sie will, streicht diese eine Bedingung.
     OR NEW.cart_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, sender_id, type, product_name, comment_text)
  VALUES (
    NEW.buyer_id,
    NEW.seller_id,
    'order_shipped',
    NEW.title,
    CASE
      WHEN NEW.tracking_number IS NOT NULL AND btrim(NEW.tracking_number) <> ''
        THEN format('%s ist unterwegs · %s', COALESCE(NEW.title, 'Dein Paket'), NEW.tracking_number)
      ELSE format('%s ist unterwegs', COALESCE(NEW.title, 'Dein Paket'))
    END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_shipped ON public.product_orders;
CREATE TRIGGER trg_notify_order_shipped
  AFTER UPDATE OF status ON public.product_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_shipped();

-- Trigger-Funktionen sind per RPC nicht aufrufbar; PUBLIC-EXECUTE trotzdem weg,
-- damit sie nicht in der nächsten anon-Prüfung als Befund auftauchen.
REVOKE ALL ON FUNCTION public.notify_auction_won() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_order_shipped() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ─── Noch offen: Zahlungserinnerung ──────────────────────────────────────────
-- Das dritte Ereignis („dein Korb verfällt in X Stunden") fehlt noch. Es braucht
-- keinen Trigger, sondern einen Zeitplan-Job: `auction_carts.closes_at` trägt die
-- 24-Stunden-Frist, ein pg_cron-Lauf müsste offene Körbe kurz vor Ablauf einsammeln
-- und je Korb genau EINMAL pingen (Idempotenz-Spalte oder Abgleich gegen bereits
-- gesendete `order_payment_reminder`-Zeilen). Der Typ existiert bereits in allen
-- Oberflächen. Eigener Schritt.
