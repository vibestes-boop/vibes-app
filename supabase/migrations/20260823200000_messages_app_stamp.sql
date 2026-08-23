-- Eine normale Nachricht aus Berkat meldete sich in SERLO
-- ============================================================================
--
-- Von Zaur am Gerät gefunden, direkt nach dem Fix von `20260823190000`:
--
--   „das ist trotzdem falsch, wenn man einfach nachricht in berkat schreibt
--    dann geht die meldung ins serlo nicht berkat, da fehlt was"
--
-- Und er hat recht: `20260823190000` hat den Push dorthin geschickt, wo die
-- Meldung landet — aber die Meldung landete am falschen Ort. Der Fehler lag
-- eine Ebene tiefer, in der Regel selbst.
--
-- ── DER BEFUND: DAS MERKMAL WAR NUR EIN STELLVERTRETER ──────────────────────
--
-- `20260823130000` führte „der Faden entscheidet" ein:
--
--     EXISTS (SELECT 1 FROM messages m
--              WHERE m.conversation_id = NEW.conversation_id
--                AND m.listing_id IS NOT NULL)   → 'berkat', sonst 'serlo'
--
-- Das ist richtig für den Weg, für den es gebaut wurde — „schreib dem
-- Verkäufer zu diesem Angebot". Es ist der einzige Weg, den `messages`
-- überhaupt unterscheiden KONNTE, weil `listing_id` das einzige
-- Berkat-Merkmal an der Tabelle war (`20260822140000`).
--
-- Berkat hat aber mehr Wege in einen Chat: vom Verkäufer-Profil („Nachricht"),
-- aus dem Posteingang, als Antwort auf irgendetwas. **Keiner davon hängt an
-- einem Angebot.** Der Faden fiel damit auf `'serlo'`, und die Meldung landete
-- in Serlos Glocke — bei einem Nutzer, der gerade in Berkat schreibt.
--
-- > **Ein Stellvertreter-Merkmal beantwortet die Frage, die man ihm stellt,
-- > nicht die, die man meint.** `listing_id IS NOT NULL` heißt „hängt an einem
-- > Angebot", nicht „kommt aus Berkat". Solange es nur einen Weg gab, war das
-- > dasselbe. Es blieb dasselbe genau bis zum zweiten Weg.
--
-- ── DER WEG: die Tabelle sagen lassen, woher die Nachricht kommt ────────────
--
-- Neue Spalte `messages.app`, gesetzt vom Client. Nachgebaut, nicht erfunden:
-- dieselbe Form wie `listing_id` (`20260822140000`) und wie der `app`-Stempel
-- auf `notifications`, `live_sessions` und `scheduled_lives`.
--
-- ⚠️ `listing_id` bleibt als ODER in der Regel stehen. Zwei Gründe, beide
-- hart: Die Fäden von VOR dieser Migration tragen keinen Stempel, und
-- ausgelieferte App-Fassungen ohne den OTA schicken ihn nicht. Beide sollen
-- weiterhin als Berkat gelten. Die Zeile fällt erst weg, wenn keine Fassung
-- mehr im Umlauf ist, die ohne Stempel schreibt — also frühestens in Monaten.
--
-- ⚠️ REIHENFOLGE: DATENBANK VOR OTA. Die Spalte muss da sein, bevor ein Client
-- sie schickt, sonst scheitert JEDER Nachrichtenversand aus Berkat an einer
-- unbekannten Spalte. Andersherum ist es harmlos: Ein alter Client schreibt
-- die Spalte nicht, und die `listing_id`-Hälfte der Regel trägt ihn.
--
-- ⚠️ SERLO SCHREIBT DIE SPALTE NICHT und liest sie nicht. Für Serlo ändert
-- sich nichts: `app IS NULL` fällt in den `ELSE`-Zweig, also `'serlo'` — genau
-- das heutige Verhalten.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS app text;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_app_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_app_check
  CHECK (app IS NULL OR app IN ('serlo', 'berkat'));

-- Nur die gestempelten Zeilen. Gefragt wird immer „gibt es in diesem Faden
-- eine Berkat-Nachricht", nie „zeig mir alle Serlo-Nachrichten".
CREATE INDEX IF NOT EXISTS idx_messages_conversation_app
  ON public.messages(conversation_id)
  WHERE app = 'berkat';

COMMENT ON COLUMN public.messages.app IS
  'Aus welcher App diese Nachricht geschrieben wurde. Nullable und additiv — '
  'Serlo schreibt sie nicht, NULL gilt als serlo. Entscheidet zusammen mit '
  'listing_id, in welcher Glocke die Meldung landet (notify_on_dm).';

-- ⚠️ Die Probe auf Regel 11 (CLAUDE.md): Ist die Spaltenliste eingefroren, ist
-- die neue Spalte für die Clients unsichtbar — und ein INSERT, der sie nur
-- erwähnt, scheitert mit 42501.
--
-- ⚠️ UND DIE PROBE AUS `20260822140000` STELLT DIE FALSCHE FRAGE. Dort steht:
--
--     SELECT … FROM information_schema.column_privileges
--      WHERE table_name='messages' AND grantee IN ('anon','authenticated');
--     -- ERWARTET: LEER
--
-- Diese Sicht kann für eine Tabelle mit `GRANT ALL` **niemals leer sein**: Sie
-- fächert auch Rechte auf, die aus dem TABELLEN-Recht folgen. Die Probe meldet
-- damit jede normale Tabelle als eingefroren. Beim Einspielen dieser Migration
-- hat sie prompt angeschlagen — der Lauf brach ab, obwohl `messages` gar keine
-- Spalten-Rechte hat.
--
-- Die richtige Frage ist `pg_attribute.attacl`: Sie ist genau dann gesetzt,
-- wenn jemand ein Recht SPALTENWEISE vergeben oder entzogen hat.
--
-- Am 23.08.2026 mit dem echten Abzug gegengeprüft — Tabellen mit
-- Spalten-Rechten sind: `live_auctions`, `live_sessions`, `product_orders`,
-- `profiles`, `scheduled_lives`. ⚠️ **CLAUDE.md Regel 11 nennt nur
-- `live_sessions` und `user_whip_ingresses`** — die Liste ist an beiden Enden
-- falsch: drei Tabellen fehlen, und `user_whip_ingresses` steht seit
-- `20260823100000` gar nicht mehr darauf.
DO $do$
DECLARE v_frozen int;
BEGIN
  SELECT count(*) INTO v_frozen
    FROM pg_attribute a
   WHERE a.attrelid = 'public.messages'::regclass
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.attacl IS NOT NULL;
  IF v_frozen > 0 THEN
    RAISE EXCEPTION
      'messages hat Spalten-Rechte auf % Spalten: Regel 11 greift, es fehlt '
      'GRANT SELECT, INSERT (app) ON public.messages TO anon, authenticated', v_frozen;
  END IF;
END $do$;

-- ── notify_on_dm mit der erweiterten Regel ──────────────────────────────────
--
-- ⚠️ Rumpf MASCHINELL aus dem frischen Abzug (`/tmp/gen_dm.mjs`): Das Skript
-- bricht ab, wenn der alte Faden-Ausdruck nicht genau einmal vorkommt, und
-- prüft danach, dass `p_app := v_app` (aus `20260823190000`), der `app`-Stempel
-- der Meldungszeile, der Push-Titel und die `conversationId` in der Nutzlast
-- noch dastehen. Diese Funktion ist heute die dritte Änderung in Folge — genau
-- die Lage, in der abgetippte Rümpfe Teile verlieren.

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
  -- ⚠️ ERWEITERT 23.08.2026 — die Fassung darunter war zu eng.
  --
  -- Sie fragte NUR nach `listing_id`. Wer in Berkat einfach jemanden
  -- anschreibt — vom Verkäufer-Profil, aus dem Posteingang, als Antwort —
  -- hängt an keinem Angebot. Der Faden fiel damit auf 'serlo', und die Meldung
  -- landete in SERLOS Glocke. Von Zaur am Gerät gefunden:
  -- „wenn man einfach nachricht in berkat schreibt dann geht die meldung ins
  --  serlo nicht berkat, da fehlt was".
  --
  -- Der Angebots-Bezug war nie das Merkmal, er war nur das einzige, das die
  -- Tabelle hatte. Das Merkmal ist: **in welcher App wurde geschrieben.**
  -- Dafür gibt es jetzt `messages.app`.
  --
  -- `listing_id` bleibt als ODER stehen, und zwar aus zwei Gründen: die
  -- Fäden von VOR dieser Migration tragen keinen Stempel, und ausgelieferte
  -- App-Fassungen ohne den OTA schicken ihn nicht. Beide sollen weiter als
  -- Berkat gelten.
  --
  -- NEW wird ZUSÄTZLICH direkt gefragt, nicht nur über das EXISTS: Damit ist
  -- die Entscheidung unabhängig davon, ob dieser Trigger vor oder nach dem
  -- Schreiben der Zeile läuft.
  SELECT CASE
           WHEN NEW.app = 'berkat' OR NEW.listing_id IS NOT NULL THEN 'berkat'
           WHEN EXISTS (
             SELECT 1 FROM public.messages m
              WHERE m.conversation_id = NEW.conversation_id
                AND (m.listing_id IS NOT NULL OR m.app = 'berkat')
           ) THEN 'berkat'
           ELSE 'serlo'
         END
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
  ,
    p_app := v_app
  );

  RETURN NEW;
END;
$$;
-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Die Spalte ist da, nullable, mit CHECK. Erwartet: text / YES.
--
--      SELECT data_type, is_nullable FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='messages' AND column_name='app';
--
-- 2) Die Regel kennt jetzt beide Merkmale. Erwartet: t.
--
--      SELECT prosrc LIKE '%m.app = ''berkat''%' FROM pg_proc
--       WHERE proname = 'notify_on_dm';
--
-- 3) ⚠️ Und der Bestand aus den zwei Migrationen davor steht noch — ohne diese
--    Probe ist ein maschinelles Ersetzen nichts wert. Erwartet: alle t.
--
--      SELECT prosrc LIKE '%p_app := v_app%'   AS push_filter,
--             prosrc LIKE '%conversationId%'   AS nutzlast,
--             prosrc LIKE '%Neue Nachricht%'   AS titel
--        FROM pg_proc WHERE proname = 'notify_on_dm';
--
-- 4) Genau eine Signatur. Erwartet: 1.
--
--      SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--       WHERE n.nspname='public' AND p.proname='notify_on_dm';
--
-- 5) ⚠️ Die Probe, die zählt, geht nur am Gerät und braucht beide Apps auf
--    demselben Telefon (Prüfliste E8):
--
--      • In Berkat jemanden vom PROFIL aus anschreiben — ohne Angebot.
--        Die Meldung muss in BERKATS Glocke stehen und der Push dort ankommen.
--      • In Serlo eine ganz normale DM schreiben — muss weiterhin in SERLO
--        landen. Das ist die Gegenprobe, ohne die der Fix nur die Seite
--        gewechselt hätte.
