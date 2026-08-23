-- Jeder konnte jedem eine Meldung schreiben — plus: welche App gehört einer DM?
-- ============================================================================
--
-- Zwei Dinge in einer Migration, weil beide an derselben Tabelle hängen und
-- dieselbe Gegenprobe brauchen.
--
-- ════════════════════════════════════════════════════════════════════════════
-- TEIL 1 — Die INSERT-Policy war eine offene Tür
-- ════════════════════════════════════════════════════════════════════════════
--
-- Bisher (Abzug vom 23.08.2026):
--
--     CREATE POLICY "notif_insert_own_sender" ON notifications
--       FOR INSERT TO authenticated
--       WITH CHECK (sender_id = auth.uid());
--
-- Geprüft wurde also NUR, dass man sich nicht als jemand anderes ausgibt.
-- **Empfänger, Typ und Text waren frei** — und ein Trigger schickt daraufhin
-- einen echten Push aufs Telefon.
--
-- ⚠️ Das untergräbt genau die Zusage aus Übergabe 64: „Berkat schreibt dir nie
-- hier." Der Angreifer braucht den Chat gar nicht — er nimmt den offiziellen
-- Meldungskanal, und dort steht das Symbol der App daneben.
--
-- ── WARUM KEINE RPCs (die Übergabe erwartete welche) ────────────────────────
--
-- Abschnitt 73 hielt fest: „Die Policy zu verschärfen bricht Serlos
-- ausgelieferte App: Fünf Stellen schreiben direkt in die Tabelle. Der Weg
-- dahin führt über RPCs für diese fünf, dann die Policy."
--
-- Beim Nachzählen waren es **sechs**, nicht fünf — `components/ui/
-- LiveShareSheet.tsx:204` fehlte auf der Liste. Genau die Stelle, die eine
-- verschärfte Policy still gebrochen hätte.
--
-- Und beim Lesen fiel auf, dass RPCs gar nicht nötig sind: Alle sechs Stellen
-- schreiben etwas, das **nachprüfbar wahr** ist. Es gibt einen Kommentar, eine
-- laufende Sendung, eine Follow-Anfrage. Die Policy kann das selbst fragen —
-- dann bleiben die Clients unverändert, und es braucht **keinen Serlo-OTA**.
--
-- Das ist der bessere Tausch: Sechs RPCs wären sechs neue Oberflächen, die
-- gepflegt werden müssen, plus eine Rollout-Reihenfolge über zwei Runtimes.
--
-- ── DIE SECHS STELLEN, GEGEN DIE GEPRÜFT WURDE ──────────────────────────────
--
--   1. `components/ui/LiveShareSheet.tsx:204`  → `live_invite` + `session_id`
--   2. `lib/useComments.ts:279`                → `comment` / `mention`
--   3. `lib/useLiveSession.ts:422`             → `live` + `session_id`
--   4. `lib/useFollowRequest.ts:82`            → `follow_request`
--   5. `lib/useFollowRequest.ts:147`           → `follow_request_accepted`
--   6. `apps/web/app/actions/profile.ts:458`   → `follow_request_accepted`
--
-- `supabase/functions/stripe-webhook/index.ts:405` schreibt mit `service_role`
-- und ist von RLS ohnehin nicht betroffen.
--
-- ⚠️ ZWEI DIESER SECHS SIND HEUTE SCHON KAPUTT, und das ist ein Nebenbefund
-- dieser Arbeit, kein Ergebnis davon:
--
--   • Nr. 4 und 5 schreiben `user_id: …`. Die Spalte heisst `recipient_id` und
--     ist `NOT NULL` — der INSERT scheitert IMMER, und beide Aufrufstellen
--     prüfen `error` nicht. **In Serlos App hat noch nie jemand eine Meldung
--     über eine Follow-Anfrage bekommen.** Die Web-Fassung (Nr. 6) macht es
--     richtig; nur die App ist betroffen. Der Client ist im selben Zug
--     korrigiert, wirksam wird es mit dem nächsten Serlo-OTA.
--
--   • `lib/useComments.ts:248` schreibt `type: 'comment_reply'` — dieser Typ
--     steht NICHT im `notifications_type_check`. Auch dieser INSERT scheitert
--     immer. **Hier bewusst NICHT behoben:** Den Typ freizuschalten hiesse,
--     ihn auch in `fn_send_push_on_notification` aufzunehmen, sonst bekäme der
--     Empfänger „Neue Aktivität auf Serlo" (Übergabe 9). Das ist eine eigene
--     Runde und eine Verhaltensänderung an einem laufenden Produkt.
--
-- Die Policy unten lässt beide Fälle weiterhin durch — sie scheitern vorher am
-- Schema, nicht an der Berechtigung. Wer sie repariert, findet die Tür offen.
--
-- ── WARUM EINE SECURITY-DEFINER-FUNKTION UND NICHT EXISTS IN DER POLICY ─────
--
-- ⚠️ Eine Unterabfrage IN einer Policy respektiert die RLS der referenzierten
-- Tabelle. Ein `EXISTS (SELECT 1 FROM comments …)` direkt in der Policy würde
-- also von `comments`' eigenen Policies gefiltert — und wenn die enger sind
-- als gedacht, lehnt die Policy **still** ab. Das ist dieselbe Falle wie
-- „Geerbte Serlo-Tabellen sind enger, als sie aussehen" (Übergabe 3), nur eine
-- Ebene tiefer und ohne jede Fehlermeldung.
--
-- Deshalb `may_notify()` als `SECURITY DEFINER` — dasselbe Muster, das Serlo
-- mit `is_live_session_moderator` schon fährt.

CREATE OR REPLACE FUNCTION public.may_notify(
  p_type      text,
  p_recipient uuid,
  p_session   uuid,
  p_comment   uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_recipient IS NULL THEN
    RETURN false;
  END IF;

  -- Sich selbst zu benachrichtigen ist immer sinnlos und in keinem der sechs
  -- Wege vorgesehen — alle filtern den Absender ausdrücklich heraus.
  IF p_recipient = v_uid THEN
    RETURN false;
  END IF;

  -- ⚠️ GESUCHTES CASE (`CASE WHEN <bedingung>`), nicht die einfache Form mit
  -- einem Ausdruck hinter `CASE`. Der erste Entwurf schrieb
  -- `WHEN 'comment', 'comment_reply', 'mention' THEN` — und eine Kommaliste
  -- gibt es nur in der ANWEISUNGS-Form von PL/pgSQL, nicht im AUSDRUCK.
  -- Postgres antwortet darauf mit `42601 syntax error at or near ","`. Die
  -- zwei Formen sehen fast gleich aus und sind es nicht.
  RETURN CASE

    -- Kommentar, Antwort und Erwähnung: Der Kommentar muss existieren UND von
    -- mir sein. Damit ist der Text nicht mehr frei erfunden, sondern das, was
    -- ich ohnehin öffentlich geschrieben habe.
    WHEN p_type IN ('comment', 'comment_reply', 'mention') THEN
      p_comment IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.comments c
         WHERE c.id = p_comment AND c.user_id = v_uid
      )

    -- „Ich bin live": Nur der Gastgeber der genannten Sendung.
    WHEN p_type = 'live' THEN
      p_session IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.live_sessions s
         WHERE s.id = p_session AND s.host_id = v_uid
      )

    -- Einladung in eine Sendung: Die Sendung muss laufen. Bewusst NICHT auf
    -- den Gastgeber begrenzt — das Teilen-Blatt ist für Zuschauer gebaut.
    WHEN p_type = 'live_invite' THEN
      p_session IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.live_sessions s
         WHERE s.id = p_session AND s.status = 'active'
      )

    -- Follow-Anfrage: Es muss eine geben, und sie muss von mir an genau diesen
    -- Empfänger gehen.
    WHEN p_type = 'follow_request' THEN
      EXISTS (
        SELECT 1 FROM public.follow_requests r
         WHERE r.sender_id = v_uid AND r.receiver_id = p_recipient
      )

    -- Angenommen: Der Empfänger muss mir jetzt tatsächlich folgen. Das ist die
    -- Tatsache, über die die Meldung berichtet — gibt es sie nicht, ist die
    -- Meldung eine Behauptung.
    WHEN p_type = 'follow_request_accepted' THEN
      EXISTS (
        SELECT 1 FROM public.follows f
         WHERE f.follower_id = p_recipient AND f.following_id = v_uid
      )

    -- ⚠️ ALLES ANDERE IST SERVERSACHE. `auction_won`, `order_paid`,
    -- `saved_search_hit`, `order_dispute`, `gift` … entstehen in Triggern und
    -- SECURITY-DEFINER-Funktionen, die als `postgres` laufen und diese Policy
    -- gar nicht sehen. Ein Client, der sie schreiben will, will etwas
    -- vortäuschen.
    ELSE false
  END;
END $fn$;

REVOKE ALL ON FUNCTION public.may_notify(text, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.may_notify(text, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.may_notify(text, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.may_notify(text, uuid, uuid, uuid) TO service_role;

-- ── Die Policy ──────────────────────────────────────────────────────────────
--
-- ⚠️ `DROP` und neu, nicht daneben: Postgres verknüpft permissive Policies mit
-- ODER. Bliebe die alte stehen, hebelte sie die neue vollständig aus — genau
-- der Fehler, der am 16.07.2026 die Frauen-Only-Grenze auf `live_sessions`
-- riss und am 22.08.2026 auf `posts` noch einmal (Übergabe 73, Fund 2).
--
-- Der Name bleibt derselbe, damit der Abzug vergleichbar bleibt.

DROP POLICY IF EXISTS "notif_insert_own_sender" ON public.notifications;

CREATE POLICY "notif_insert_own_sender" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.may_notify(type, recipient_id, session_id, comment_id)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- TEIL 2 — Welche App gehört einer Direktnachricht?
-- ════════════════════════════════════════════════════════════════════════════
--
-- Die offene Frage aus Übergabe 74 („gehört entschieden, nicht geraten"),
-- entschieden am 23.08.2026: **der Faden entscheidet.** Die Begründung steht
-- im Rumpf unten.
--
-- Der Rumpf ist MASCHINELL aus einem frischen Abzug übernommen und an genau
-- zwei Stellen ergänzt (`/tmp/gen_notif.mjs`).

-- Damit die Faden-Frage O(1) beantwortet wird statt den ganzen Verlauf zu
-- lesen. `msg_conv_idx` deckt `(conversation_id, created_at)` ab, was hier
-- einen Scan über alle Nachrichten des Fadens bedeutet — bei einem langen
-- Verlauf und einem Trigger auf JEDEM INSERT ist das die falsche Kurve.
CREATE INDEX IF NOT EXISTS idx_messages_conv_listing
  ON public.messages (conversation_id)
  WHERE listing_id IS NOT NULL;

CREATE OR REPLACE FUNCTION "public"."notify_on_dm"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sender_id    UUID;
  v_recipient_id UUID;
  v_sender_name  TEXT;
  v_app          TEXT;
BEGIN
  v_sender_id := NEW.sender_id;

  -- Empfänger = der andere Teilnehmer der Konversation
  SELECT CASE
           WHEN participant_1 = v_sender_id THEN participant_2
           ELSE participant_1
         END
    INTO v_recipient_id
    FROM public.conversations
   WHERE id = NEW.conversation_id;

  IF v_recipient_id IS NULL           THEN RETURN NEW; END IF;
  IF v_recipient_id = v_sender_id     THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand')
    INTO v_sender_name
    FROM public.profiles
   WHERE id = v_sender_id;

  -- ⚠️ DER FADEN ENTSCHEIDET, NICHT DIE NACHRICHT.
  --
  -- Bis zum 23.08.2026 stand hier kein `app`, die Zeile fiel also auf den
  -- Vorgabewert `'serlo'`. Seit dem 22.08. filtern BEIDE Glocken
  -- (`20260822220000` und Serlos Client) — eine Direktnachricht aus Berkat
  -- erschien damit in keiner Berkat-Glocke.
  --
  -- Der naheliegende Weg wäre, die einzelne Nachricht zu fragen
  -- (`NEW.listing_id IS NOT NULL`). Der ist falsch: Nur die ERSTE Nachricht
  -- aus einem Angebot trägt den Bezug, die Antwort darauf nicht mehr — derselbe
  -- Faden läge dann in zwei Apps, und der Verkäufer bekäme die Frage in Berkat
  -- und die Rückfrage in Serlo.
  --
  -- Deshalb entscheidet die UNTERHALTUNG: Trug irgendeine ihrer Nachrichten je
  -- einen Angebots-Bezug, ist es ein Berkat-Faden — dauerhaft. Sonst bleibt es
  -- bei `'serlo'`, also beim heutigen Verhalten.
  --
  -- Bewusst NICHT gewählt: zwei Zeilen schreiben, eine je App. Wer beide Apps
  -- hat, bekäme zwei Pushes für eine Nachricht — und das ist die Sorte Fehler,
  -- die Nutzer Benachrichtigungen ganz abschalten lässt.
  SELECT CASE WHEN EXISTS (
           SELECT 1 FROM public.messages m
            WHERE m.conversation_id = NEW.conversation_id
              AND m.listing_id IS NOT NULL
         ) THEN 'berkat' ELSE 'serlo' END
    INTO v_app;

  -- In-App Notification
  INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, app)
  VALUES (v_recipient_id, v_sender_id, 'dm', LEFT(NEW.content, 200), v_app)
  ON CONFLICT DO NOTHING;

  -- Push über den kanonischen Direkt-Helper (identisch zu notify_on_like).
  PERFORM public.send_push_to_user(
    p_user_id := v_recipient_id,
    p_title   := '✉️ Neue Nachricht',
    p_body    := COALESCE(NULLIF(LEFT(NEW.content, 140), ''),
                          '@' || v_sender_name || ' schreibt dir'),
    p_data    := jsonb_build_object(
      'type',           'dm',
      'conversationId', NEW.conversation_id::text,
      'senderId',       v_sender_id::text,
      'senderUsername', v_sender_name
    )
  );

  RETURN NEW;
END;
$$;

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Genau EINE INSERT-Policy auf der Tabelle — sonst hebelt die zweite die
--    erste per ODER aus. Erwartet: 1.
--
--      SELECT count(*) FROM pg_policies
--       WHERE tablename = 'notifications' AND cmd = 'INSERT';
--
-- 2) ⚠️ DIE PROBE, DIE ZÄHLT — von aussen, aus einer ANGEMELDETEN Sitzung.
--    Vorher ging das durch; jetzt muss es scheitern.
--
--      POST /rest/v1/notifications
--      { "recipient_id": "<irgendwer>", "sender_id": "<ich>",
--        "type": "gift", "comment_text": "Berkat: bitte Konto bestaetigen" }
--
--    Erwartet: **403 / 42501**. Kommt eine 201, ist die Policy nicht scharf.
--
--    Und die Gegenrichtung mit einem plausiblen Typ, aber ohne Tatsache
--    dahinter — muss ebenfalls scheitern:
--
--      { "recipient_id": "<irgendwer>", "sender_id": "<ich>",
--        "type": "follow_request_accepted" }
--
-- 3) Die sechs legitimen Wege müssen weiterlaufen. Ohne Gerät prüfbar:
--
--      SELECT public.may_notify('live', '<irgendwer>', '<eigene-session>', NULL);  -- t
--      SELECT public.may_notify('live', '<irgendwer>', '<fremde-session>', NULL);  -- f
--      SELECT public.may_notify('gift', '<irgendwer>', NULL, NULL);                -- f
--
--    ⚠️ Aus dem SQL-Editor ist `auth.uid()` NULL, die Funktion gibt dann
--    immer `false` zurück. Diese drei Zeilen brauchen eine angemeldete
--    Sitzung — sonst misst man nur, dass NULL nichts darf.
--
-- 4) Am Gerät, in SERLO (die Wege, die es nur dort gibt): einen Kommentar
--    schreiben, jemanden erwähnen, live gehen, eine Sendung teilen. Alle vier
--    müssen beim Empfänger ankommen wie bisher. **Kommt einer nicht an, ist
--    die Policy zu eng** — und der Fehler ist still, weil alle Aufrufstellen
--    `error` ignorieren.
--
-- 5) Der Faden-Stempel — braucht zwei Konten und ein Angebot:
--
--    a) Aus einem Angebot heraus schreiben. Erwartet: `app = 'berkat'`.
--    b) Der Empfänger ANTWORTET (die Antwort trägt keine `listing_id`).
--       Erwartet: **weiterhin `app = 'berkat'`** — das ist der ganze Punkt.
--    c) Eine Unterhaltung ohne jeden Angebots-Bezug. Erwartet: `'serlo'`.
--
--      SELECT n.app, n.created_at, m.listing_id IS NOT NULL AS aus_angebot
--        FROM notifications n
--        JOIN messages m ON m.conversation_id = n.conversation_id
--       WHERE n.type = 'dm'
--       ORDER BY n.created_at DESC LIMIT 5;
--
-- 6) Und die Bestandsaufnahme, die niemand vergessen sollte: Wurde der offene
--    Weg je benutzt? Meldungen mit einem Typ, den ein Client hätte schreiben
--    können, aber ohne die Tatsache dahinter.
--
--      SELECT type, count(*) FROM notifications
--       WHERE sender_id IS NOT NULL
--         AND type NOT IN ('comment','comment_reply','mention','live',
--                          'live_invite','follow_request',
--                          'follow_request_accepted','dm')
--       GROUP BY type ORDER BY 2 DESC;
--
--    Diese Zeilen stammen alle aus Triggern — was hier auftaucht, ist normal.
--    Auffällig wäre eine Häufung mit einem `sender_id`, der kein Betreiber ist.
