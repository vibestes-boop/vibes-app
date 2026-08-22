-- ─────────────────────────────────────────────────────────────────────────────
-- Die App-Trennung, dritte Runde: die Meldungen beim Live-Gehen und am Auftrag
--
-- Aus dem Sicherheits-Audit vom 22.08.2026 (Übergabe, Abschnitt 73). Drei
-- Schreibwege in `notifications` setzen `app` nicht und sind von Berkat aus
-- erreichbar — die Meldung fällt damit per DEFAULT auf `'serlo'`, landet in
-- Serlos Posteingang und erreicht den Empfänger in Berkat nie.
--
-- Dieselbe Fehlerklasse wie `report_order_dispute` am 21.08. (20260821170000):
-- `20260814280000` hat die damals bekannten Schreibpfade umgestellt, diese hier
-- standen auf keiner Liste, weil sie älter sind als die Spalte.
--
--     ⚠️ Wer eine Spalte auf einer geteilten Tabelle einführt, sucht danach
--     ALLE Schreibpfade — auch die, die niemand mehr anfasst.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ DER TEUERSTE TEIL: ZWEI TRIGGER FÜR DIESELBE MELDUNG
--
-- Auf `live_sessions` hängen ZWEI Trigger, die beide beim Sendungsstart feuern:
--
--   on_live_session_active         AFTER INSERT OR UPDATE OF status
--                                  → notify_followers_on_live   (alt, 1 INSERT)
--   trg_notify_followers_on_go_live  AFTER INSERT
--                                  → notify_followers_on_go_live (neu)
--
-- Die neue Fassung kann alles, was die alte nicht kann: Stummschaltungen
-- achten, einen Rückstau-Deckel, und sie führt eine Anti-Spam-Sperre —
--
--     SELECT COUNT(*) INTO v_recent_count FROM public.notifications
--      WHERE sender_id = NEW.host_id AND type = 'live'
--        AND created_at > NOW() - INTERVAL '30 minutes';
--     IF v_recent_count > 0 THEN RETURN NEW; END IF;
--
-- **Und genau diese Sperre schaltet sie selbst ab.** Trigger feuern in
-- alphabetischer Reihenfolge: `on_live_session_active` kommt vor
-- `trg_notify_followers_on_go_live`. Die alte, dümmere Fassung schreibt also
-- zuerst ihre Zeile mit `type = 'live'` — und die neue sieht sie eine
-- Millisekunde später, hält sie für eine Wiederholung und steigt aus.
--
-- Ergebnis seit dem 19.05.2026: Die Fassung mit Stummschalt-Respekt ist
-- eingebaut, deployt, dokumentiert — und läuft nie.
--
-- > **Zwei Trigger auf demselben Ereignis sind kein doppelter Boden, sondern
-- > ein Wettlauf. Wer einen zweiten hinzufügt, ohne den ersten abzuschalten,
-- > baut die Ablösung und lässt sie liegen.**
--
-- Behoben: Der alte Trigger wird abgehängt, der neue auf
-- `AFTER INSERT OR UPDATE OF status` erweitert — damit er auch den Fall trägt,
-- den bisher nur der alte abdeckte (Sitzung entsteht nicht-aktiv und wird
-- später aktiviert). Sein Rumpf steigt bei `NEW.status <> 'active'` ohnehin
-- aus, und die Anti-Spam-Sperre trägt die Wiederholung.
--
-- ⚠️ Die alte FUNKTION bleibt stehen. Nur der Trigger geht. Sie zu löschen
-- brächte nichts und könnte einen Aufrufer treffen, den ich nicht kenne.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ DIE RÜMPFE SIND MASCHINELL ÜBERNOMMEN, NICHT ABGETIPPT
--
-- Alle drei Funktionen stammen aus einem frischen `supabase db dump` von heute
-- und wurden per Skript an genau einer Stelle ergänzt. Das Skript bricht ab,
-- wenn eine Ersetzung nicht **genau einmal** trifft, und zählt danach die
-- `CREATE`-Zeilen je Rumpf — die awk-Falle aus Abschnitt 51, bei der ein
-- Bereichsmuster in zwei fremde Funktionen hineinlief.
--
-- Bei `submit_order_review` und `resolve_order_dispute` sind hier schon einmal
-- spätere Änderungen verlorengegangen. Wer sie erneut anfasst, legt das
-- Original daneben.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══ 1) Der doppelte Trigger ═════════════════════════════════════════════════

DROP TRIGGER IF EXISTS "on_live_session_active" ON public.live_sessions;

CREATE OR REPLACE FUNCTION "public"."notify_followers_on_go_live"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_recent_count int;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Anti-spam: host has pushed recently. Covers reconnects/restarts.
  SELECT COUNT(*) INTO v_recent_count
    FROM public.notifications
   WHERE sender_id = NEW.host_id
     AND type = 'live'
     AND created_at > NOW() - INTERVAL '30 minutes';

  IF v_recent_count > 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    sender_id,
    type,
    session_id,
    comment_text,
    created_at,
    app
  )
  SELECT
    f.follower_id,
    NEW.host_id,
    'live',
    NEW.id,
    NEW.title,
    NOW(),
    COALESCE(NEW.app, 'serlo')
  FROM public.follows f
  WHERE f.following_id = NEW.host_id
    AND f.follower_id <> NEW.host_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.muted_live_hosts m
      WHERE m.user_id = f.follower_id
        AND m.host_id = NEW.host_id
    )
    -- If the same recipient has not opened a recent live notification from
    -- this host, a new one adds badge pressure without adding value.
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.recipient_id = f.follower_id
        AND n.sender_id = NEW.host_id
        AND n.type = 'live'
        AND n.read = false
        AND n.created_at > NOW() - INTERVAL '7 days'
    )
    -- Backlog cap: users with a large unread live queue do not receive more
    -- live pings until they return and clear/open notifications.
    AND (
      SELECT COUNT(*)
      FROM public.notifications n
      WHERE n.recipient_id = f.follower_id
        AND n.type IN ('live', 'scheduled_live_reminder')
        AND n.read = false
        AND n.created_at > NOW() - INTERVAL '30 days'
    ) < 100;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "trg_notify_followers_on_go_live"
  AFTER INSERT OR UPDATE OF status ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_go_live();


-- ═══ 2) Die Auflösung eines Streitfalls ══════════════════════════════════════
-- Die MELDUNG des Falls wurde am 21.08. repariert, die ANTWORT darauf nicht —
-- beide Parteien hätten sie in Berkat nie gesehen.

CREATE OR REPLACE FUNCTION "public"."resolve_order_dispute"("p_dispute_id" "uuid", "p_resolution" "text" DEFAULT NULL::"text", "p_dismiss" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_dispute public.order_disputes%rowtype;
  v_res     text := nullif(btrim(p_resolution), '');
  v_app     text;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF NOT COALESCE(public.is_admin(), false) THEN RETURN jsonb_build_object('error','not_authorized'); END IF;

  SELECT * INTO v_dispute FROM public.order_disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','dispute_not_found'); END IF;

  -- Dieselbe Weiche wie in report_order_dispute (20260821170000): cart_id gibt
  -- es nur in Berkat, und beide Berkat-Geldwege setzen ihn. Exakte Grenze,
  -- keine Naeherung.
  SELECT CASE WHEN o.cart_id IS NOT NULL THEN 'berkat' ELSE 'serlo' END
    INTO v_app
    FROM public.product_orders o
   WHERE o.id = v_dispute.order_id;
  v_app := COALESCE(v_app, 'serlo');

  UPDATE public.order_disputes
     SET status = CASE WHEN p_dismiss THEN 'dismissed' ELSE 'resolved' END,
         resolution = v_res,
         resolved_at = now()
   WHERE id = p_dispute_id;

  -- Beide Parteien informieren.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, app)
    VALUES
      (v_dispute.reporter_id, v_caller, 'order_dispute', 'Deine Streit-Meldung wurde geklärt ✓', v_app),
      (v_dispute.against_id,  v_caller, 'order_dispute', 'Eine Streit-Meldung zu deiner Bestellung wurde geklärt ✓', v_app);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END $$;


-- ═══ 3) Die Bewertung ════════════════════════════════════════════════════════
-- `v_order` ist hier bereits `product_orders%rowtype`, die Weiche steht also
-- ohne zusätzliche Abfrage zur Verfügung.

CREATE OR REPLACE FUNCTION "public"."submit_order_review"("p_order_id" "uuid", "p_rating" integer, "p_comment" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_order    public.product_orders%rowtype;
  v_role     text;
  v_reviewee uuid;
  v_comment  text := nullif(btrim(p_comment), '');
  v_existing boolean;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RETURN jsonb_build_object('error','invalid_rating'); END IF;
  IF v_comment IS NOT NULL AND length(v_comment) > 1000 THEN v_comment := left(v_comment, 1000); END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_caller = v_order.buyer_id THEN v_role := 'buyer'; v_reviewee := v_order.seller_id;
  ELSIF v_caller = v_order.seller_id THEN v_role := 'seller'; v_reviewee := v_order.buyer_id;
  ELSE RETURN jsonb_build_object('error','not_authorized'); END IF;

  IF v_order.status <> 'delivered' THEN RETURN jsonb_build_object('error','not_delivered'); END IF;

  SELECT EXISTS(SELECT 1 FROM public.order_reviews WHERE order_id = p_order_id AND reviewer_id = v_caller)
    INTO v_existing;

  INSERT INTO public.order_reviews (order_id, reviewer_id, reviewee_id, reviewer_role, rating, comment)
  VALUES (p_order_id, v_caller, v_reviewee, v_role, p_rating, v_comment)
  ON CONFLICT (order_id, reviewer_id) DO UPDATE
    SET rating = excluded.rating, comment = excluded.comment, updated_at = now();

  IF NOT v_existing THEN
    BEGIN
      INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text, app)
      VALUES (v_reviewee, v_caller, 'order_review', 'Du wurdest mit ' || p_rating || '★ bewertet ⭐',
              CASE WHEN v_order.cart_id IS NOT NULL THEN 'berkat' ELSE 'serlo' END);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- 1. Nur noch EIN Trigger für die Go-Live-Meldung:
--      SELECT tgname FROM pg_trigger
--       WHERE tgrelid = 'public.live_sessions'::regclass AND NOT tgisinternal
--       ORDER BY tgname;
--      -- erwartet: KEIN on_live_session_active, aber
--      --           trg_notify_followers_on_go_live
--
-- 2. Je genau eine Signatur, kein HTTP 300:
--      SELECT p.proname, count(*)
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname='public'
--         AND p.proname IN ('notify_followers_on_go_live','resolve_order_dispute',
--                           'submit_order_review')
--       GROUP BY 1;
--      -- erwartet: je 1
--
-- 3. ⚠️ DIE EIGENTLICHE PROBE — sie braucht eine echte Berkat-Sendung:
--      Show in Berkat starten, dann:
--      SELECT app, type, created_at FROM notifications
--       WHERE type = 'live' ORDER BY created_at DESC LIMIT 3;
--      -- erwartet: app = 'berkat', und GENAU EINE Zeile je Follower.
--      -- Vorher: app = 'serlo', und zwei Zeilen (beide Trigger).
--
-- 4. Und die Gegenrichtung, die diese Migration NICHT löst:
--    Serlos Glocke (`lib/useNotifications.ts`) filtert nicht auf `app` und
--    zeigt Berkat-Meldungen weiter mit an. Das ist eine Client-Änderung in
--    einer ausgelieferten App und braucht einen eigenen OTA.
-- ─────────────────────────────────────────────────────────────────────────────
