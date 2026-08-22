-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: die Brücke zwischen Regal und Show — in BEIDE Richtungen
--
-- DAS PROBLEM
-- Regal-Artikel und Show-Artikel liegen seit `20260815210000` in DERSELBEN
-- Tabelle. Der Unterschied ist eine Spalte:
--
--   session_id NULL  + status 'listed'    → Regal, jetzt kaufbar
--   session_id NULL  + status 'scheduled' → für einen Termin vorbereitet
--   session_id gesetzt                    → in der Show
--
-- Trotzdem gab es keinen Weg dazwischen. `claim_prepared_auctions` filtert auf
-- `status = 'scheduled'` und übersieht damit jeden Regal-Artikel;
-- `create_live_auction` legt immer eine NEUE Zeile aus dem Formular an. Ein
-- Verkäufer mit zwanzig Artikeln im Regal musste sie für die Show ein zweites
-- Mal eintippen.
--
-- Und die Gegenrichtung war eine Sackgasse: `settle_live_auction` setzt bei
-- einer Auktion ohne Gebot `status = 'unsold'` — danach passiert mit dem
-- Artikel nie wieder etwas. Foto, Beschreibung und Sendezeit sind weg. Bei
-- zwanzig Artikeln am Abend und einem Drittel ohne Gebot ist das die Hälfte
-- eines Regals, die jede Woche verfällt.
--
-- DIE PREISE PASSEN BEREITS
-- `create_standing_listing` hält seit dem 15.08.2026 `start_price_cents` auf
-- 100 mit genau dieser Begründung im eigenen Kommentar: „Wandert der Artikel
-- später doch in eine Show, startet er bei 1 €." Der Festpreis steht als
-- `buy_now_cents` da und wird in der Show zum Sofortkauf. Der Weg ins Regal
-- braucht deshalb kein neues Feld — nur einen Preis in der Gegenrichtung, weil
-- ein Show-Artikel `buy_now_cents` leer haben darf und ein Regal-Artikel nicht.
--
-- DER DOPPELVERKAUF IST STRUKTURELL AUSGESCHLOSSEN
-- `live_auctions_shelf_check` lautet seit `20260819120000`:
--   (session_id IS NOT NULL AND status <> 'listed') OR (session_id IS NULL AND …)
-- Ein Artikel KANN nicht gleichzeitig im Regal und in der Show liegen. Beide
-- Funktionen hier verschieben deshalb, sie kopieren nicht — dieselbe
-- Entscheidung wie in `claim_prepared_auctions`.
--
-- ⚠️ ZWEI FRAUEN-ONLY-LECKS, DIE DIESE MIGRATION SCHLIESSEN MUSS
--
-- `live_auctions` hat ZWEI Lese-Policies, und sie entscheiden nach
-- VERSCHIEDENEN Spalten:
--
--   live_auctions_select           (mit Session)  → erbt von
--        `live_sessions.women_only`; die eigene Spalte des Artikels wird
--        überhaupt nicht angesehen
--   live_auctions_select_standing  (ohne Session) → `live_auctions.women_only`
--        am Artikel selbst
--
-- Ein Umzug wechselt damit die zuständige Policy. Daraus folgen zwei Fallen,
-- beide von der Klasse aus HANDOFF Abschnitt 3 („Eine SECURITY-DEFINER-Funktion
-- geht an der Frauen-Only-Grenze vorbei"):
--
--   1. Ein Regal-Artikel mit `women_only = true`, der in eine ÖFFENTLICHE Show
--      wandert, wird durch den Session-Erbgang für jeden sichtbar. Die
--      Verkäuferin hat nur „in die Show" getippt und dem nie zugestimmt.
--      → wird ABGELEHNT (`women_only_mismatch`), nicht stillschweigend geöffnet.
--      In die Gegenrichtung (öffentlicher Artikel in eine WOZ-Show) wird
--      geerbt: enger ist immer erlaubt.
--
--   2. Der Rückweg ist der gefährlichere, weil er auf einem Fehler aufsetzt,
--      der HEUTE SCHON in der Datenbank steht: `create_live_auction` setzt
--      `women_only` nicht. Jeder Artikel, der spontan in einer Frauen-Only-Show
--      aufgelegt wurde, trägt am eigenen Datensatz `false` — folgenlos, solange
--      er eine Session hat, weil die Policy dann die Session fragt. Nimmt man
--      ihm die Session weg, entscheidet plötzlich diese Spalte, und die
--      gesamte Ware einer Frauen-Only-Sendung stünde offen im Regal.
--      → `move_auction_to_shelf` ERBT `women_only` von der Session, die der
--        Artikel gerade verlässt. Erben, nicht fragen — dieselbe Antwort wie in
--        `20260819130000`, und aus demselben Grund: Es gibt keine Gelegenheit,
--        es zu vergessen.
--
-- KEINE SCHEMA-ÄNDERUNG. Keine neue Spalte, keine neue Tabelle, kein neuer
-- Status, keine Änderung an einer bestehenden Funktion. Nur zwei Wege, die es
-- vorher nicht gab.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Regal → Show ─────────────────────────────────────────────────────────
-- Zwei Ziele, eine Funktion: eine LAUFENDE Show (`p_session_id`) oder ein
-- TERMIN (`p_planned_for`). Genau eines von beiden, nie beides.
--
-- Warum nicht zwei Funktionen: Die Wächter sind zu neunzig Prozent dieselben
-- (Besitz, Regal-Zustand, Frauen-Only-Vergleich, `sort_index`). Zwei Fassungen
-- hießen zwei Orte, an denen die Frauen-Only-Prüfung stehen muss — und einer
-- davon vergisst sie irgendwann.
CREATE OR REPLACE FUNCTION public.move_listing_to_show(
  p_id          uuid,
  p_session_id  uuid DEFAULT NULL,
  p_planned_for uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_item       public.live_auctions%ROWTYPE;
  v_target_woz boolean;
  v_next       int;
  v_count      int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Genau ein Ziel. Beides gesetzt wäre keine Bequemlichkeit, sondern eine
  -- offene Frage darüber, wohin der Artikel gehört.
  IF (p_session_id IS NULL) = (p_planned_for IS NULL) THEN
    RAISE EXCEPTION 'target_required' USING ERRCODE = '22023';
  END IF;

  -- Sperren, bevor irgendetwas geprüft wird: Zwischen Prüfung und UPDATE
  -- könnte sonst ein zweiter Ruf denselben Artikel in eine andere Show ziehen.
  SELECT * INTO v_item
    FROM public.live_auctions
   WHERE id = p_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_item.seller_id <> v_uid THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;

  -- Nur was WIRKLICH im Regal liegt. `sold` und `cancelled` haben ebenfalls
  -- keine Session — ohne diese Prüfung ließe sich ein verkaufter Artikel
  -- erneut versteigern.
  IF v_item.session_id IS NOT NULL OR v_item.status <> 'listed' THEN
    RAISE EXCEPTION 'not_on_shelf' USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NOT NULL THEN
    -- ⚠️ `app = 'berkat'` gehört dazu. Wer in beiden Apps sendet, zöge seinen
    -- Artikel sonst in eine SERLO-Session — Serlo kennt `live_auctions` nicht,
    -- und Berkats Abfragen finden ihn über die fremde Session nie wieder.
    -- Derselbe Fehler wie Nr. 2 in `20260819130000`.
    SELECT coalesce(s.women_only, false) INTO v_target_woz
      FROM public.live_sessions s
     WHERE s.id = p_session_id
       AND s.host_id = v_uid
       AND s.app = 'berkat'
       AND s.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'show_not_available' USING ERRCODE = '22023';
    END IF;
  ELSE
    SELECT coalesce(p.women_only, false) INTO v_target_woz
      FROM public.scheduled_lives p
     WHERE p.id = p_planned_for
       AND p.host_id = v_uid
       AND p.app = 'berkat';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'plan_not_available' USING ERRCODE = '22023';
    END IF;

    -- Derselbe Deckel wie in `prepare_live_auction`. Wer aus dem Regal
    -- vorbereitet, darf ihn nicht umgehen.
    SELECT count(*) INTO v_count
      FROM public.live_auctions
     WHERE planned_for = p_planned_for AND session_id IS NULL;
    IF v_count >= 50 THEN
      RAISE EXCEPTION 'too_many_prepared' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ⚠️ Siehe Kopf, Leck 1. Enger darf immer, weiter nie.
  IF v_item.women_only AND NOT v_target_woz THEN
    RAISE EXCEPTION 'women_only_mismatch' USING ERRCODE = '42501';
  END IF;

  -- `max(…) + 1` statt `count(*)`: Fehler 3 aus `20260819130000`.
  IF p_session_id IS NOT NULL THEN
    SELECT coalesce(max(sort_index), -1) + 1 INTO v_next
      FROM public.live_auctions WHERE session_id = p_session_id;
  ELSE
    SELECT coalesce(max(sort_index), -1) + 1 INTO v_next
      FROM public.live_auctions
     WHERE planned_for = p_planned_for AND session_id IS NULL;
  END IF;

  UPDATE public.live_auctions
     SET session_id  = p_session_id,
         planned_for = p_planned_for,
         status      = 'scheduled',
         women_only  = v_target_woz,
         sort_index  = v_next,
         updated_at  = now()
   WHERE id = p_id;

  RETURN p_id;
END $$;

REVOKE ALL ON FUNCTION public.move_listing_to_show(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_listing_to_show(uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.move_listing_to_show(uuid, uuid, uuid) IS
  'Verschiebt einen Regal-Artikel (status listed) in eine laufende Show oder an '
  'einen Termin. Verschiebt, kopiert nicht — der Artikel verlässt das Regal. '
  'Erbt women_only vom Ziel und lehnt den weiter machenden Fall ab.';

-- ─── 2. Show → Regal ─────────────────────────────────────────────────────────
-- Der Rückweg für alles, was in einer Show nicht weggegangen ist: `unsold`
-- (Uhr abgelaufen, kein Gebot) und `scheduled` (nie drangekommen).
--
-- ⚠️ `running` ist bewusst NICHT dabei. Einen Artikel aus einer laufenden
-- Auktion zu ziehen, während jemand bietet, ist kein Umräumen, sondern ein
-- Wortbruch. Dafür gibt es `cancel_live_auction`.
--
-- Der Preis ist ein Pflicht-Parameter und keine Ableitung aus `buy_now_cents`.
-- Ein Sofortkauf ist ein Preis, den jemand zahlt, um die Auktion ABZUKÜRZEN —
-- er steht bewusst hoch. Als stiller Regalpreis wäre er zu teuer, und der
-- Artikel läge wieder wie Blei. Der Client schlägt ihn vor, der Mensch
-- bestätigt.
CREATE OR REPLACE FUNCTION public.move_auction_to_shelf(
  p_id          uuid,
  p_price_cents integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_item public.live_auctions%ROWTYPE;
  v_woz  boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Dieselbe Untergrenze wie in `create_standing_listing`: Der Startpreis
  -- bleibt bei 100, und `buy_now_cents > start_price_cents` steht als CHECK auf
  -- der Spalte. Ein Regalpreis von genau 1 € wäre also nicht speicherbar — das
  -- hier vorher zu sagen ist freundlicher als ein 23514 aus der Tiefe.
  IF p_price_cents IS NULL OR p_price_cents <= 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_item
    FROM public.live_auctions
   WHERE id = p_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_item.seller_id <> v_uid THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;
  IF v_item.status NOT IN ('unsold', 'scheduled') THEN
    RAISE EXCEPTION 'not_returnable' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ Siehe Kopf, Leck 2. Die Session ist die einzige Stelle, an der die
  -- Wahrheit über den Schutz dieses Artikels heute steht; sobald sie weg ist,
  -- zählt nur noch die Spalte. Ohne Session (vorbereitet, aber nie gesendet)
  -- gilt, was schon am Artikel steht.
  IF v_item.session_id IS NOT NULL THEN
    SELECT coalesce(s.women_only, false) INTO v_woz
      FROM public.live_sessions s
     WHERE s.id = v_item.session_id;
    v_woz := coalesce(v_woz, false) OR v_item.women_only;
  ELSE
    v_woz := v_item.women_only;
  END IF;

  -- Der Artikel wird zurückgesetzt, nicht bloß umgehängt: Ein Regal-Artikel mit
  -- `ends_at` aus der letzten Show hätte einen abgelaufenen Countdown, und ein
  -- stehengebliebener `winner_id` wäre eine Behauptung über einen Menschen.
  -- `bid_count` geht mit — bei `unsold` ist er ohnehin 0, bei `scheduled` auch.
  UPDATE public.live_auctions
     SET session_id        = NULL,
         planned_for       = NULL,
         status            = 'listed',
         women_only        = v_woz,
         start_price_cents = 100,
         buy_now_cents     = p_price_cents,
         current_bid_cents = NULL,
         current_bidder_id = NULL,
         bid_count         = 0,
         ends_at           = NULL,
         started_at        = NULL,
         settled_at        = NULL,
         winner_id         = NULL,
         cart_id           = NULL,
         sort_index        = 0,
         updated_at        = now()
   WHERE id = p_id;

  RETURN p_id;
END $$;

REVOKE ALL ON FUNCTION public.move_auction_to_shelf(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_auction_to_shelf(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.move_auction_to_shelf(uuid, integer) IS
  'Legt einen nicht verkauften oder nie gestarteten Show-Artikel als Dauerangebot '
  'ins Regal. Setzt die Auktionsspuren zurück und erbt women_only von der Session, '
  'die der Artikel verlässt — sonst stünde die Ware einer Frauen-Only-Show offen.';

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN — im SQL-Editor, mit einem angemeldeten Konto
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. Beide Funktionen genau einmal, kein `anon`:
--
--      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
--             has_function_privilege('anon',  p.oid, 'EXECUTE') AS anon_darf,
--             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS user_darf
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public'
--         AND p.proname IN ('move_listing_to_show', 'move_auction_to_shelf');
--      -- erwartet: zwei Zeilen, anon_darf = false, user_darf = true
--
-- 2. Der Umzug ins Regal räumt wirklich auf:
--
--      SELECT status, session_id, planned_for, buy_now_cents, start_price_cents,
--             winner_id, ends_at, cart_id, women_only
--        FROM live_auctions WHERE id = '<artikel>';
--      -- erwartet: listed / NULL / NULL / <preis> / 100 / NULL / NULL / NULL
--
-- 3. ⚠️ Die Frauen-Only-Probe, und sie ist die einzige, die man nicht
--    nebenbei macht (HANDOFF Abschnitt 56, Gruppe E — in der Datenbank liegt
--    bis heute NULL WOZ-Datum):
--
--    a) Regal-Artikel mit women_only = true in eine öffentliche Show:
--         SELECT move_listing_to_show('<woz-artikel>', '<öffentliche-show>');
--       -- erwartet: FEHLER women_only_mismatch
--
--    b) Artikel aus einer Frauen-Only-Show ins Regal:
--         SELECT move_auction_to_shelf('<artikel-aus-woz-show>', 2000);
--         SELECT women_only FROM live_auctions WHERE id = '<artikel>';
--       -- erwartet: true — OBWOHL create_live_auction ihn mit false angelegt hat.
--       -- Steht dort false, ist das Leck offen und die Ware öffentlich.
--
-- 4. Was NICHT gehen darf:
--
--      SELECT move_auction_to_shelf('<laufende-auktion>', 2000);  -- not_returnable
--      SELECT move_listing_to_show('<verkaufter-artikel>', '<show>');  -- not_on_shelf
--      SELECT move_listing_to_show('<artikel>', '<show>', '<termin>'); -- target_required
--      SELECT move_auction_to_shelf('<artikel>', 100);            -- price_too_low
-- ─────────────────────────────────────────────────────────────────────────────
