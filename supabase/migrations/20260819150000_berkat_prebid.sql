-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: Vorabgebot auf einen vorbereiteten Artikel
--
-- Seit `20260819110000` kann ein Verkäufer Artikel für einen angekündigten Abend
-- vorbereiten, und seit dem 19.08.2026 sehen Käufer sie vorher (HANDOFF 49).
-- Was fehlt, ist die Handlung: Wer um 20:00 nicht kann, hat keine Möglichkeit,
-- trotzdem mitzubieten — und schaut deshalb gar nicht erst hin.
--
-- ⚠️ DAS IST KEIN NEUES FEATURE, SONDERN `set_max_bid` OHNE LAUFENDE SHOW.
-- Berkat hat Stellvertreter-Bieten seit `20260813220000`: Man hinterlegt, wie
-- weit man gehen würde, der Server bietet in Schritten mit. Ein Vorabgebot ist
-- genau das — „bis hierhin will ich gehen", nur früher gesetzt. Damit fällt die
-- ganze Gebotslogik weg; es bleibt die Frage, WANN aufgelöst wird.
-- Begründung: HANDOFF 41, Punkt 2 (Stufe B).
--
-- DER AUDIT VOM 18.08. LAG DANEBEN — ZUGUNSTEN DES EINFACHEREN WEGS
-- Abschnitt 41 erwartete Policy-Arbeit an `live_bids`: „Bei `session_id IS NULL`
-- ist der JOIN leer → niemand sieht die Vorabgebote." Das stimmt, ist hier aber
-- gegenstandslos, weil **während der Vorbereitung gar nicht aufgelöst wird**:
--
--   `resolve_auto_bids` beginnt mit `IF … a.status <> 'running' THEN RETURN`.
--
-- Es entsteht also keine `live_bids`-Zeile, solange der Artikel nur vorbereitet
-- ist. Aufgelöst wird beim START der Auktion — dann hat sie eine Session, und
-- die bestehende Policy greift wie immer. **Keine neue Policy, kein Zweit-Gate,
-- kein Sonderweg für `live_bids`.**
--
-- WAS DER KÄUFER BEIM START ERLEBT
-- Die Auktion öffnet nicht bei null, sondern mit den Vorabgeboten bereits
-- verrechnet — in geschlossener Form, wie immer: Bei einem Vorabbieter startet
-- sie beim Startpreis mit ihm als Führendem, bei zweien beim zweithöchsten
-- Maximum plus Schritt. Das ist dieselbe Rechnung wie im laufenden Betrieb,
-- nur eine Sekunde früher.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Maximum setzen — jetzt auch vor der Show ─────────────────────────────
-- ⚠️ Der Rumpf ist WÖRTLICH der aus `20260813220000`; geändert ist allein der
-- Zustands-Block und der Rückgabewert (ein Schlüssel mehr). Diese Funktion hat
-- schon einmal bei einer Neufassung Teile verloren — das Original lag daneben.
-- Gleiche Signatur, deshalb `CREATE OR REPLACE`: kein DROP, keine GRANT-Falle.
CREATE OR REPLACE FUNCTION public.set_max_bid(
  p_auction_id uuid,
  p_max_cents  int
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a           public.live_auctions;
  v_uid       uuid := auth.uid();
  v_next_min  int;
  v_prebid    boolean := false;
  c_max_cents constant int := 1000000;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Derselbe Lock wie beim normalen Gebot: Maximum setzen und Auflösung
  -- müssen zusammen atomar sein.
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  -- Zwei erlaubte Zustände statt einem:
  --   'running'                             → das bisherige Verhalten
  --   'scheduled' UND session_id IS NULL    → Vorabgebot auf Vorbereitetes
  --
  -- Die zweite Bedingung ist nicht überflüssig: Ein Artikel, der in einer
  -- laufenden Show wartet, hat ebenfalls `status = 'scheduled'` — auf DEN darf
  -- man nicht vorab bieten, denn dort entscheidet der Gastgeber Sekunden
  -- später über Start und Dauer. Vorabgebote gehören zur Vorbereitung, nicht
  -- zur Warteschlange.
  IF a.status = 'scheduled' AND a.session_id IS NULL THEN
    v_prebid := true;
  ELSIF a.status <> 'running' THEN
    RAISE EXCEPTION 'auction_not_running' USING ERRCODE = '22023';
  END IF;

  -- Ein Vorabgebot hat kein Ende — die Uhr entsteht erst beim Start.
  IF NOT v_prebid AND (a.ends_at IS NULL OR a.ends_at <= now()) THEN
    RAISE EXCEPTION 'auction_ended' USING ERRCODE = '22023';
  END IF;

  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;
  IF p_max_cents > c_max_cents THEN
    RAISE EXCEPTION 'bid_too_high' USING ERRCODE = '22023';
  END IF;

  v_next_min := CASE
    WHEN a.current_bid_cents IS NULL THEN a.start_price_cents
    ELSE a.current_bid_cents + a.min_increment_cents
  END;

  IF p_max_cents < v_next_min THEN
    RAISE EXCEPTION 'bid_too_low' USING ERRCODE = '22023',
      DETAIL = format('Mindestens %s Cent', v_next_min);
  END IF;

  INSERT INTO public.live_auto_bids (auction_id, bidder_id, max_cents)
  VALUES (p_auction_id, v_uid, p_max_cents)
  ON CONFLICT (auction_id, bidder_id) DO UPDATE
    -- Nur nach oben: ein gesenktes Maximum könnte einen bereits erteilten
    -- Zuschlag rückwirkend entwerten.
    SET max_cents = GREATEST(public.live_auto_bids.max_cents, EXCLUDED.max_cents);

  -- Vor der Show wird NICHT aufgelöst. `resolve_auto_bids` würde ohnehin sofort
  -- zurückkehren (`status <> 'running'`), aber der Aufruf hier wegzulassen sagt,
  -- dass das Absicht ist und kein Zufall: Bis zum Start gibt es keinen
  -- Gebotsstand, keinen Führenden und keine Zeile in `live_bids`.
  IF NOT v_prebid THEN
    PERFORM public.resolve_auto_bids(p_auction_id);
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'auction_id',        a.id,
    'current_bid_cents', a.current_bid_cents,
    'leading',           a.current_bidder_id = v_uid,
    'my_max_cents',      p_max_cents,
    'ends_at',           a.ends_at,
    -- Neu: Der Client soll „hinterlegt" sagen können statt „du führst" —
    -- vor dem Start führt niemand, und ein „Du führst" wäre eine Behauptung
    -- über einen Wettbewerb, der noch nicht begonnen hat.
    'prebid',            v_prebid
  );
END $$;

REVOKE ALL ON FUNCTION public.set_max_bid(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_max_bid(uuid, int) TO authenticated;

-- ─── 2. Vorabgebot zurückziehen ──────────────────────────────────────────────
-- ⚠️ NUR vor dem Start, und das ist die ganze Begründung.
--
-- Ein Gebot in einer laufenden Auktion ist eine bindende Willenserklärung —
-- deshalb kennt `set_max_bid` auch nur den Weg nach oben. Ein Vorabgebot auf
-- einen Artikel, dessen Auktion noch gar nicht eröffnet ist, ist etwas anderes:
-- Es gibt noch keinen Wettbewerb, den ein Rückzug entwerten könnte, und
-- zwischen „übermorgen" und „jetzt" liegt ein Tag, an dem sich eine Meinung
-- ändern darf. Sobald die Auktion läuft, ist Schluss — dann greift derselbe
-- Grundsatz wie bei jedem anderen Gebot.
CREATE OR REPLACE FUNCTION public.cancel_prebid(p_auction_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  a     public.live_auctions;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'scheduled' OR a.session_id IS NOT NULL THEN
    -- Dieselbe Sprache wie überall: Was man nicht darf, „gibt es nicht" —
    -- sonst sickert über die Fehlermeldung durch, dass die Show schon läuft.
    RAISE EXCEPTION 'prebid_locked' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.live_auto_bids
   WHERE auction_id = p_auction_id AND bidder_id = v_uid;
END $$;

REVOKE ALL ON FUNCTION public.cancel_prebid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_prebid(uuid) TO authenticated;

-- ─── 3. Beim Start die Vorabgebote verrechnen ────────────────────────────────
-- ⚠️ Rumpf wörtlich aus `20260813150000`; neu sind die letzten beiden Blöcke.
-- Ohne sie läge das Maximum zwar in der Tabelle, aber die Auktion startete bei
-- null und der Vorabbieter müsste doch am Handy sitzen — das Feature wäre ein
-- Versprechen ohne Wirkung.
CREATE OR REPLACE FUNCTION public.start_live_auction(
  p_auction_id       uuid,
  p_duration_seconds int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

REVOKE ALL ON FUNCTION public.start_live_auction(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_live_auction(uuid, int) TO authenticated;

-- ─── 4. Das Nachfrage-Signal für den Verkäufer ───────────────────────────────
-- Der unterschätzte Teil (HANDOFF 41, Punkt 4): Die ZAHL sagt dem Verkäufer,
-- welcher Artikel Nachfrage hat, **bevor** er ihn aufruft — er kann die
-- Reihenfolge des Abends danach legen. Genau deshalb zeigt Whatnot sie dem
-- Verkäufer und nicht nur dem Käufer.
--
-- ⚠️ Nur die ANZAHL, nie die Beträge. `live_auto_bids` ist bewusst für niemanden
-- außer den Besitzer lesbar — wer fremde Maxima kennt, kann sie exakt
-- überbieten, und Stellvertreter-Bieten wäre wertlos. Dieselbe Trennung wie bei
-- `get_seller_rating` (Schnitt statt Einzelbewertungen) und `get_vouch_weights`.
CREATE OR REPLACE FUNCTION public.get_prebid_counts(p_auction_ids uuid[])
RETURNS TABLE (auction_id uuid, bidders int)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT ab.auction_id, count(*)::int
    FROM public.live_auto_bids ab
    JOIN public.live_auctions a ON a.id = ab.auction_id
   WHERE ab.auction_id = ANY (p_auction_ids)
     -- Nur die eigenen Artikel. Ohne das könnte jeder die Nachfrage eines
     -- fremden Verkäufers ausmessen.
     AND a.seller_id = auth.uid()
   GROUP BY ab.auction_id;
$$;

REVOKE ALL ON FUNCTION public.get_prebid_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prebid_counts(uuid[]) TO authenticated;

-- ─── Gegenprobe ──────────────────────────────────────────────────────────────
-- 1. Vorabgebot auf einen vorbereiteten Artikel geht:
--      SELECT set_max_bid('<vorbereiteter Artikel>', 2000);
--      -- muss `"prebid": true` enthalten, `current_bid_cents` bleibt NULL
--
-- 2. Es entsteht KEINE Gebotszeile vor dem Start:
--      SELECT count(*) FROM live_bids WHERE auction_id = '<derselbe>';
--      -- muss 0 sein
--
-- 3. Auf einen Artikel in der Warteschlange einer LAUFENDEN Show geht es nicht:
--      SELECT set_max_bid('<scheduled MIT session_id>', 2000);
--      -- muss `auction_not_running` werfen
--
-- 4. Beim Start wird verrechnet:
--      SELECT start_live_auction('<derselbe>', 30);
--      -- danach: current_bidder_id = der Vorabbieter, current_bid_cents =
--      --         start_price_cents (bei genau einem Vorabgebot)
--
-- 5. Zurückziehen nur vorher:
--      SELECT cancel_prebid('<laufende Auktion>');  -- muss `prebid_locked` werfen
--
-- 6. Rechte (die `credit_coins`-Falle):
--      SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE')
--        FROM pg_proc p
--       WHERE p.proname IN ('set_max_bid','cancel_prebid','start_live_auction',
--                           'get_prebid_counts');
--      -- alle vier MÜSSEN false sein
