-- Der Push ging an BEIDE Apps — nur die Meldung war getrennt
-- ============================================================================
--
-- Von Zaur am Gerät gefunden, nicht im Code:
--
--   „der push kommt ins serlo app und berkat app und heißt Neue Nachricht,
--    wenn man es anklickt gelangt man ins ‚Meldungen'-Seite, dort ist nicht
--    der chat — also wird man in die falsche Seite geleitet?!"
--
-- Zwei Fehler in einer Beobachtung. Dieser hier ist der erste; der zweite
-- (falsches Ziel beim Antippen) liegt im Berkat-Client.
--
-- ── DER BEFUND ──────────────────────────────────────────────────────────────
--
-- `send_push_to_user` kann seit dem 14.08.2026 nach App filtern
-- (`20260814190000`, Parameter `p_app`). Der Weg über die Meldungs-Tabelle
-- nutzt das auch: `fn_send_push_on_notification` übergibt
-- `p_app := COALESCE(NEW.app, 'serlo')`.
--
-- **Die vier DIREKT-Push-Wege übergeben ihn nicht.** Sie stehen genau deshalb
-- in der Überspring-Liste von `fn_send_push_on_notification` („Typen mit
-- eigenem Direkt-Push hier überspringen → sonst Doppel-Push") — und sind damit
-- die einzigen, die den Filter selbst setzen müssten.
--
-- Bei `p_app IS NULL` ist die Bedingung `(p_app IS NULL OR … app = p_app)`
-- für JEDE Zeile wahr. Der Filter ist also nicht etwa lax, sondern **komplett
-- aus**: Jedes Gerät des Nutzers bekommt den Push, in jeder App.
--
-- Am frischen Abzug vom 23.08.2026 gemessen, alle Aufrufer von
-- `send_push_to_user`:
--
--   fn_send_push_on_notification   p_app dabei ✅
--   notify_scheduled_post_failure  p_app dabei ✅
--   notify_on_dm                   ❌
--   notify_on_like                 ❌
--   notify_on_comment              ❌
--   notify_on_follow               ❌
--
-- ⚠️ Gemeldet war nur die DM. Die drei Nachbarn hatten denselben Fehler und
-- werden im selben Zug behoben — die Lehre aus der Versandzeit-Kachel
-- (Übergabe 75): **Wer eine Falle für einen Aufruf findet, prüft die Aufrufe
-- daneben, bevor er sie für Einzelfälle hält.**
--
-- ── WELCHE APP JE FUNKTION ──────────────────────────────────────────────────
--
-- Die Regel ist nicht „was wäre schön", sondern: **Der Push geht dorthin, wo
-- auch die Meldung landet.** Alles andere wäre eine zweite Wahrheit über
-- dasselbe Ereignis.
--
--   • `notify_on_dm`  → `v_app`, also der Faden. Die Zeile daneben schreibt
--     schon `app => v_app` (seit `20260823130000`, „der Faden entscheidet").
--     Der Push benutzt jetzt denselben Wert — eine Quelle, zwei Zustellwege.
--
--   • `notify_on_like` / `notify_on_comment` → `'serlo'`. Beide hängen an
--     `posts`; Berkat hat keinen Feed und keine Post-Kommentare. Ein Push
--     dorthin führte ins Leere.
--
--   • `notify_on_follow` → `'serlo'`. ⚠️ Das ist der einzige unsaubere Fall:
--     **Berkat hat Follower** (Verkäufer-Profil, „2 Follower · 3 Gefolgt").
--     Die Meldungszeile fällt heute aber auch auf `'serlo'` — `follows` trägt
--     keinen App-Stempel, und niemand weiß, in welcher App gefolgt wurde. Der
--     Push zieht damit nur nach, was die Glocke ohnehin tut. **Wer das
--     richtigstellen will, stempelt `follows` und beide Wege gemeinsam** —
--     das ist eine eigene Runde, keine Zeile hier.
--
-- ⚠️ RISIKOARM IN BEIDE RICHTUNGEN, und zwar wegen des bewussten Rückfalls in
-- `send_push_to_user`: Findet sich KEIN Gerät der Ziel-App (`v_count = 0`),
-- gehen die Meldungen weiterhin an alle Geräte. Ein Nutzer mit altem Token
-- ohne `app`-Wert verliert also nichts — schlimmstenfalls bleibt es beim
-- heutigen Verhalten.
--
-- ⚠️ Rümpfe MASCHINELL aus dem frischen Abzug (`/tmp/gen_app.mjs`): Der Aufruf
-- wird über Klammer-Zählung gefunden (er enthält `COALESCE(NULLIF(LEFT(…)))`,
-- daran ist ein Regex gescheitert), das Skript bricht bei mehr als einem
-- Aufruf ab, prüft die CREATE-Zahl, dass `p_app` genau einmal vorkommt, und
-- dass `notify_on_dm` seine Faden-Logik behalten hat.

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
  ,
    p_app := v_app
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."notify_on_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_post_author_id UUID;
  v_liker_username TEXT;
  v_post_caption   TEXT;
BEGIN
  SELECT author_id, COALESCE(SUBSTRING(caption, 1, 40), 'Dein Post')
    INTO v_post_author_id, v_post_caption
    FROM public.posts WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand') INTO v_liker_username
    FROM public.profiles WHERE id = NEW.user_id;

  PERFORM send_push_to_user(
    p_user_id := v_post_author_id,
    p_title   := '❤️ Neues Like',
    p_body    := '@' || v_liker_username || ' hat „' || v_post_caption || '" geliked',
    p_data    := json_build_object('type', 'like', 'postId', NEW.post_id)::jsonb
  ,
    p_app := 'serlo'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."notify_on_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_post_author_id UUID;
  v_commenter_name TEXT;
  v_comment_preview TEXT;
BEGIN
  SELECT author_id INTO v_post_author_id
    FROM public.posts WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(username, 'Jemand') INTO v_commenter_name
    FROM public.profiles WHERE id = NEW.user_id;

  v_comment_preview := COALESCE(SUBSTRING(NEW.text, 1, 50), '...');

  PERFORM send_push_to_user(
    p_user_id := v_post_author_id,
    p_title   := '💬 Neuer Kommentar',
    p_body    := '@' || v_commenter_name || ': ' || v_comment_preview,
    p_data    := json_build_object('type', 'comment', 'postId', NEW.post_id)::jsonb
  ,
    p_app := 'serlo'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."notify_on_follow"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_follower_name TEXT;
BEGIN
  SELECT COALESCE(username, 'Jemand') INTO v_follower_name
    FROM public.profiles WHERE id = NEW.follower_id;

  PERFORM send_push_to_user(
    p_user_id := NEW.following_id,
    p_title   := '👤 Neuer Follower',
    p_body    := '@' || v_follower_name || ' folgt dir jetzt',
    p_data    := json_build_object('type', 'follow', 'userId', NEW.follower_id)::jsonb
  ,
    p_app := 'serlo'
  );

  RETURN NEW;
END;
$$;

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Alle vier tragen den Filter jetzt. Erwartet: vier Zeilen, alle `t`.
--
--      SELECT proname, prosrc LIKE '%p_app%' AS hat_filter
--        FROM pg_proc
--       WHERE proname IN ('notify_on_dm','notify_on_like',
--                         'notify_on_comment','notify_on_follow')
--       ORDER BY proname;
--
-- 2) ⚠️ Und der Bestand steht noch — die Probe, ohne die ein maschinelles
--    Ersetzen nichts wert ist. Erwartet: t.
--
--      SELECT prosrc LIKE '%listing_id IS NOT NULL%' FROM pg_proc
--       WHERE proname = 'notify_on_dm';
--
-- 3) Je genau eine Signatur, kein HTTP 300. Erwartet: vier Zeilen mit 1.
--
--      SELECT proname, count(*) FROM pg_proc p
--        JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public'
--         AND proname IN ('notify_on_dm','notify_on_like',
--                         'notify_on_comment','notify_on_follow')
--       GROUP BY proname;
--
-- 4) ⚠️ Die Probe, die zählt, geht nur am Gerät und braucht BEIDE Apps auf
--    DEMSELBEN Telefon (Prüfliste E8): Eine Direktnachricht ohne Angebots-
--    Bezug schreiben. Der Push darf nur in SERLO ankommen, nicht in Berkat.
--    Dann eine aus einem Angebot heraus — die nur in BERKAT.
--
--    Gegenprobe gegen den Rückfall: Wer nur eine der beiden Apps hat, muss
--    weiterhin jeden Push bekommen.
