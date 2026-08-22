-- ─────────────────────────────────────────────────────────────────────────────
-- Sicherheits-Audit, zweite Runde: Betriebszahlen, Beziehungsdaten, Bestellungen
--
-- Alle drei Blöcke stammen aus dem Durchgang vom 22.08.2026 (Übergabe,
-- Abschnitt 73) und sind von aussen GEMESSEN, nicht aus dem Abzug abgelesen.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══ BLOCK 1: Betriebszahlen waren ohne Anmeldung abrufbar ═══════════════════
--
-- GEMESSEN mit dem öffentlichen Schlüssel, HTTP 200 mit echten Daten:
--
--   product_health_snapshot     {"audience":{"mau":5,"wau":3,"wau_mau":0.60,…
--   cost_health_snapshot        {"ai":{"errors_month":0,"cost_cents_…
--   moderation_health_snapshot  {"sla_hours":24,"admin_audit":{"events_7d":0,…
--
-- Das sind Nutzerzahlen, Kosten und der Moderations-Rückstau der Plattform.
-- Kein Zugriff auf fremde Daten, aber eine Auskunft, die niemandem ausser dem
-- Betreiber gehört — und jede dieser Funktionen ist zugleich ein Vollscan über
-- die grössten Tabellen, also ein billiger Weg, die Datenbank zu beschäftigen.
--
-- ⚠️ `REVOKE … FROM PUBLIC, anon` — BEIDE. Nur `anon` zu nennen genügt nicht:
-- `EXECUTE` gehört bei Funktionen von Haus aus PUBLIC, und `pg_dump` schreibt
-- das nicht aus. Genau daran ist `20260822170000` gescheitert
-- (siehe `20260822190000`).

REVOKE ALL ON FUNCTION public.product_health_snapshot()    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cost_health_snapshot()       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderation_health_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.push_feed_health_snapshot()  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.product_health_snapshot()    TO service_role;
GRANT EXECUTE ON FUNCTION public.cost_health_snapshot()       TO service_role;
GRANT EXECUTE ON FUNCTION public.moderation_health_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION public.push_feed_health_snapshot()  TO service_role;

-- Die AI-Bild-Funktionen. ⚠️ Zwei davon ruft ein Client wirklich
-- (`apps/web/app/actions/ai.ts`, `lib/useGenerateImage.ts`) — die behalten
-- `authenticated`. Die anderen vier sind Betrieb und Aufräumen; ein `grep`
-- über beide Apps findet keinen Aufrufer.
REVOKE ALL ON FUNCTION public.get_ai_image_user_quota(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_ai_image_consumed(uuid)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_image_user_quota(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_ai_image_consumed(uuid)  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_ai_image_rate_limit(uuid, public.ai_image_purpose) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_ai_image_daily_report(timestamp with time zone)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_ai_image_storage_paths_for_user(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_ai_image_unconsumed_paths(interval, integer)        FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_ai_image_rate_limit(uuid, public.ai_image_purpose) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_image_daily_report(timestamp with time zone)      TO service_role;
GRANT EXECUTE ON FUNCTION public.list_ai_image_storage_paths_for_user(uuid)               TO service_role;
GRANT EXECUTE ON FUNCTION public.list_ai_image_unconsumed_paths(interval, integer)        TO service_role;


-- ═══ BLOCK 2: Beziehungsdaten waren ohne Anmeldung lesbar ════════════════════
--
-- GEMESSEN: `message_reactions`, `story_views` und `stories` gaben einem
-- unangemeldeten Aufrufer je zwei echte Zeilen heraus.
--
-- Das ist kein Inhalts-, sondern ein Beziehungs-Leck: WER auf WESSEN private
-- Nachricht reagiert hat, und WER WESSEN Story gesehen hat. In einer engen
-- Gemeinschaft ist das die empfindlichere Auskunft.
--
-- ⚠️ Bei `stories` ist es die permissive-ODER-Falle ZUM DRITTEN MAL — nach
-- `live_sessions` (16.07.) und `posts` (22.08., `20260822160000`):
--
--     stories_own_archived_select   USING (auth.uid() = user_id OR archived = false)
--     stories_select                USING (true)            ← hebelt sie auf
--
-- Die erste Policy ist richtig gebaut und tut trotzdem nichts, weil Postgres
-- permissive Policies mit ODER verknüpft. Gelöscht wird deshalb die zweite;
-- die erste bleibt und trägt danach die ganze Aussage: eigene Stories immer,
-- fremde nur unarchiviert.

DROP POLICY IF EXISTS "stories_select" ON public.stories;

-- Reaktionen gehören zu einer Nachricht, und die gehört zu einer Unterhaltung.
-- Sichtbar ist deshalb, wer an dieser Unterhaltung beteiligt ist — dieselbe
-- Grenze, die für die Nachricht selbst gilt. Ein Erbe, keine zweite Wahrheit.
DROP POLICY IF EXISTS "reactions public read" ON public.message_reactions;

CREATE POLICY "reactions_select_participants" ON public.message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
       WHERE m.id = message_reactions.message_id
         AND auth.uid() IN (c.participant_1, c.participant_2)
    )
  );

-- Wer eine Story gesehen hat, geht die Urheberin an — und den Betrachter
-- selbst, damit die App „schon gesehen" anzeigen kann. Sonst niemanden.
DROP POLICY IF EXISTS "story_views_select" ON public.story_views;

CREATE POLICY "story_views_select_owner_or_self" ON public.story_views
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.stories s
       WHERE s.id = story_views.story_id
         AND s.user_id = auth.uid()
    )
  );


-- ═══ BLOCK 3: Ein Verkäufer konnte seine Bestellungen umschreiben ════════════
--
-- `orders` trägt `GRANT ALL … TO authenticated`, und die einzige UPDATE-Policy
-- lautete:
--
--     orders_update_seller  FOR UPDATE USING (seller_id = auth.uid())
--
-- **Ohne `WITH CHECK`.** `USING` sagt nur, WELCHE Zeilen man anfassen darf —
-- nicht, wie sie danach aussehen dürfen. Ein Verkäufer konnte seine eigene
-- Bestellung also einem anderen `seller_id` zuschieben, und Betrag wie Käufer
-- ohnehin ändern.
--
-- ⚠️ Das Recht KANN nicht entzogen werden: `apps/web/app/actions/shop.ts:550`
-- und `lib/useAdmin.ts:236` schreiben mit der Nutzer-Rolle direkt auf die
-- Tabelle (`status`, `delivery_notes`). Beides läuft in einer ausgelieferten
-- App. Deshalb zwei Riegel statt eines Entzugs.

DROP POLICY IF EXISTS "orders_update_seller" ON public.orders;

CREATE POLICY "orders_update_seller" ON public.orders
  FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Und der Teil, den `WITH CHECK` NICHT abdeckt: Betrag und Käufer der eigenen
-- Bestellung.
--
-- ⚠️ Verglichen wird über `to_jsonb`, nicht über `NEW.spalte`. Das ist kein
-- Kunstgriff, sondern Absicht: Eine Spalte, die es nicht (mehr) gibt, liefert
-- so auf beiden Seiten NULL und zählt als „unverändert", statt die Funktion
-- zur Laufzeit zu brechen. Ein Wächter, der beim nächsten Schema-Umbau die
-- ganze Bestellliste lahmlegt, wäre schlimmer als die Lücke.
--
-- Rollenprüfung wie bei `guard_profile_privileges` (`20260822150000`): geprüft
-- wird, WER schreibt. SECURITY DEFINER (läuft als `postgres`) und
-- `service_role` kommen durch, damit `buy_product`, `set_order_shipped` und
-- der Stripe-Webhook unberührt bleiben.
CREATE OR REPLACE FUNCTION public.guard_order_money()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  o jsonb := to_jsonb(OLD);
  n jsonb := to_jsonb(NEW);
  v_changed text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  v_changed := CASE
    WHEN n->>'total_coins' IS DISTINCT FROM o->>'total_coins' THEN 'total_coins'
    WHEN n->>'buyer_id'    IS DISTINCT FROM o->>'buyer_id'    THEN 'buyer_id'
    WHEN n->>'product_id'  IS DISTINCT FROM o->>'product_id'  THEN 'product_id'
    WHEN n->>'seller_id'   IS DISTINCT FROM o->>'seller_id'   THEN 'seller_id'
    ELSE NULL
  END;

  IF v_changed IS NOT NULL THEN
    RAISE EXCEPTION '% darf nicht vom Client geaendert werden', v_changed
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_order_money() OWNER TO postgres;

CREATE OR REPLACE TRIGGER trg_guard_order_money
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_money();

COMMENT ON FUNCTION public.guard_order_money() IS
  'Sperrt Betrag, Kaeufer, Produkt und Verkaeufer einer Bestellung gegen '
  'direkte Client-Schreibzugriffe. Geprueft wird die ROLLE — SECURITY DEFINER '
  'und service_role kommen durch. Ergaenzt das WITH CHECK auf '
  'orders_update_seller (22.08.2026).';


-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
--
-- ⚠️ ALLE von aussen, mit dem oeffentlichen Schluessel — nicht am Abzug.
--
-- 1. Betriebszahlen sind zu:
--      POST /rest/v1/rpc/product_health_snapshot   {}
--      -- erwartet: 401 / 42501. Vorher: 200 mit {"audience":{"mau":5,…
--      (dito cost_, moderation_, push_feed_)
--
-- 2. Beziehungsdaten sind zu:
--      GET /rest/v1/message_reactions?select=*&limit=2
--      GET /rest/v1/story_views?select=*&limit=2
--      -- erwartet: 0 Zeilen. Vorher: je 2.
--
-- 3. Stories: unarchivierte bleiben oeffentlich, archivierte nicht:
--      GET /rest/v1/stories?select=id&archived=eq.false   → weiterhin Zeilen
--      GET /rest/v1/stories?select=id&archived=eq.true    → 0 Zeilen
--
-- 4. ⚠️ Der Normalfall muss WEITER GEHEN, und das ist die wichtigere Haelfte:
--    • Serlos Shop: eine Bestellung als Verkaeufer auf 'shipped' setzen
--      (apps/web → `status`) muss unveraendert laufen.
--    • Der AI-Bild-Weg in Serlos App (`useGenerateImage`) muss weiter laufen —
--      `get_ai_image_user_quota` und `mark_ai_image_consumed` behalten
--      `authenticated`.
--    • Story-Ansichten: Die Urheberin muss ihre Zuschauer weiter sehen.
--
-- 5. Und der Angriff, der jetzt scheitern muss (angemeldet, als Verkaeufer):
--      PATCH /rest/v1/orders?id=eq.<eigene-bestellung>  {"total_coins": 1}
--      -- erwartet: 4xx 'total_coins darf nicht vom Client geaendert werden'
-- ─────────────────────────────────────────────────────────────────────────────
