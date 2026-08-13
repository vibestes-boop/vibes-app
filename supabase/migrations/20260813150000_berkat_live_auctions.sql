-- ═══════════════════════════════════════════════════════════════════════════
-- Berkat — Live-Auktionen
--
-- Neue App (apps/berkat), gleiche Datenbank. Ergänzt die bestehenden
-- live_sessions um das Format, das Serlo bisher nicht hatte: Bieten.
--
-- Vier Entscheidungen, die den Rest erklären:
--
--  1. GELD IST INTEGER. Alle Beträge in Cent. Kein numeric, kein float —
--     ein Rundungsfehler in einer Auktion ist ein Rechtsstreit.
--
--  2. DIE UHR STEHT AUF DEM SERVER. `ends_at` ist die einzige Wahrheit.
--     Der Client zeigt einen Countdown an, aber er entscheidet nichts.
--     Ein manipulierter Client kann die Zeit nicht verschieben.
--
--  3. NIEMAND ÜBERBIETET SICH SELBST. `place_live_bid` weist ein Gebot des
--     aktuell führenden Bieters ab. Whatnot erlaubt das — es kostet Käufer
--     Geld und erzeugt hinterher genau die Streitfälle, die eine kleine
--     Community nicht verträgt.
--
--  4. EIN PAKET STATT DREI. Gewonnene Artikel desselben Verkäufers wandern in
--     einen offenen Sammelkorb (24 h). Ohne das ist eine 5-€-Auktion
--     wirtschaftlich unmöglich, weil der Versand teurer ist als die Ware.
--
-- KEIN ZUFALL. Es gibt hier bewusst keine Mystery-Box, kein Rad, keine
-- verdeckten Lose. Die Spannung liegt im Preis, nicht im Inhalt. Das ist die
-- Linie zwischen Auktion und Glücksspiel — und der Grund, warum Whatnot seit
-- März 2026 in Schiedsverfahren steckt.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Sammelkorb ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auction_carts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'open'
             CHECK (status IN ('open', 'checked_out', 'expired', 'cancelled')),
  opened_at  timestamptz NOT NULL DEFAULT now(),
  closes_at  timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pro Käufer/Verkäufer-Paar höchstens ein offener Korb.
CREATE UNIQUE INDEX IF NOT EXISTS auction_carts_one_open
  ON public.auction_carts (buyer_id, seller_id)
  WHERE status = 'open';

-- ─── 2. Auktionen ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_auctions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.products(id) ON DELETE SET NULL,

  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 140),
  image_url   text,

  start_price_cents   int NOT NULL DEFAULT 100 CHECK (start_price_cents > 0),
  min_increment_cents int NOT NULL DEFAULT 100 CHECK (min_increment_cents > 0),
  -- Sofortkauf ist optional und muss über dem Startpreis liegen.
  buy_now_cents       int CHECK (buy_now_cents IS NULL OR buy_now_cents > start_price_cents),
  currency    text NOT NULL DEFAULT 'eur',

  status      text NOT NULL DEFAULT 'scheduled'
              CHECK (status IN ('scheduled', 'running', 'sold', 'unsold', 'cancelled')),
  -- Reihenfolge im "Als Nächstes"-Streifen.
  sort_index  int  NOT NULL DEFAULT 0,

  current_bid_cents int,
  current_bidder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  bid_count   int  NOT NULL DEFAULT 0,

  ends_at     timestamptz,
  started_at  timestamptz,
  settled_at  timestamptz,
  winner_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cart_id     uuid REFERENCES public.auction_carts(id) ON DELETE SET NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- "Als Nächstes" und die laufende Auktion eines Streams.
CREATE INDEX IF NOT EXISTS live_auctions_session_order
  ON public.live_auctions (session_id, sort_index)
  WHERE status IN ('scheduled', 'running');

-- Der Cron-Filter: nur laufende, fällige Auktionen.
CREATE INDEX IF NOT EXISTS live_auctions_due
  ON public.live_auctions (ends_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS live_auctions_winner
  ON public.live_auctions (winner_id)
  WHERE status = 'sold';

-- ─── 3. Gebote ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_bids (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id   uuid NOT NULL REFERENCES public.live_auctions(id) ON DELETE CASCADE,
  bidder_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents int  NOT NULL CHECK (amount_cents > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Zwei identische Beträge in derselben Auktion kann es nicht geben — das ist
-- der zweite Riegel neben dem Zeilen-Lock in place_live_bid.
CREATE UNIQUE INDEX IF NOT EXISTS live_bids_unique_amount
  ON public.live_bids (auction_id, amount_cents);

CREATE INDEX IF NOT EXISTS live_bids_auction_time
  ON public.live_bids (auction_id, created_at DESC);

-- ─── 4. updated_at pflegen ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_live_auction()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_live_auction ON public.live_auctions;
CREATE TRIGGER trg_touch_live_auction
  BEFORE UPDATE ON public.live_auctions
  FOR EACH ROW EXECUTE FUNCTION public.touch_live_auction();

-- ─── 5. RLS ─────────────────────────────────────────────────────────────────
-- WICHTIG: keine USING(true)-Policy. Postgres verknüpft permissive Policies
-- mit OR — eine einzige USING(true) würde die Frauen-Only-Grenze aushebeln
-- (genau der Fehler, der am 16.7.2026 auf live_sessions gefunden wurde).
-- Sichtbarkeit erbt deshalb immer von der Session.

ALTER TABLE public.live_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_bids     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_auctions_select ON public.live_auctions;
CREATE POLICY live_auctions_select ON public.live_auctions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = live_auctions.session_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

DROP POLICY IF EXISTS live_bids_select ON public.live_bids;
CREATE POLICY live_bids_select ON public.live_bids
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM public.live_auctions a
        JOIN public.live_sessions s ON s.id = a.session_id
       WHERE a.id = live_bids.auction_id
         AND (
           s.women_only = false
           OR s.host_id = auth.uid()
           OR public.is_women_only_verified()
         )
    )
  );

DROP POLICY IF EXISTS auction_carts_select ON public.auction_carts;
CREATE POLICY auction_carts_select ON public.auction_carts
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Schreiben ausschließlich über die RPCs unten. Kein INSERT/UPDATE vom Client:
-- ein direkter Insert in live_bids würde Lock, Mindestschritt und
-- Anti-Snipe umgehen.
REVOKE INSERT, UPDATE, DELETE ON public.live_auctions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.live_bids     FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.auction_carts FROM anon, authenticated;
REVOKE SELECT ON public.auction_carts FROM anon;

-- ─── 6. Sammelkorb finden oder öffnen ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_auction_cart(
  p_buyer_id  uuid,
  p_seller_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cart_id uuid;
BEGIN
  -- Abgelaufene Körbe erst schließen, sonst kollidiert der Unique-Index.
  UPDATE public.auction_carts
     SET status = 'expired'
   WHERE buyer_id = p_buyer_id
     AND seller_id = p_seller_id
     AND status = 'open'
     AND closes_at <= now();

  SELECT id INTO v_cart_id
    FROM public.auction_carts
   WHERE buyer_id = p_buyer_id
     AND seller_id = p_seller_id
     AND status = 'open'
   LIMIT 1;

  IF v_cart_id IS NOT NULL THEN
    RETURN v_cart_id;
  END IF;

  INSERT INTO public.auction_carts (buyer_id, seller_id)
  VALUES (p_buyer_id, p_seller_id)
  RETURNING id INTO v_cart_id;

  RETURN v_cart_id;
END $$;

REVOKE ALL ON FUNCTION public.ensure_auction_cart(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ─── 6b. Artikel in die Show legen ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_live_auction(
  p_session_id          uuid,
  p_title               text,
  p_start_price_cents   int DEFAULT 100,
  p_min_increment_cents int DEFAULT 100,
  p_buy_now_cents       int DEFAULT NULL,
  p_image_url           text DEFAULT NULL,
  p_product_id          uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_host   uuid;
  v_next   int;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT host_id INTO v_host FROM public.live_sessions WHERE id = p_session_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;

  -- Anlegen darf nur der Host. Moderatoren dürfen starten (siehe unten),
  -- aber nicht bestimmen, was verkauft wird — das ist die Ware des Hosts.
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_start_price_cents <= 0 OR p_min_increment_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_price' USING ERRCODE = '22023';
  END IF;
  IF p_buy_now_cents IS NOT NULL AND p_buy_now_cents <= p_start_price_cents THEN
    RAISE EXCEPTION 'buy_now_below_start' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(MAX(sort_index), 0) + 1 INTO v_next
    FROM public.live_auctions WHERE session_id = p_session_id;

  INSERT INTO public.live_auctions (
    session_id, seller_id, product_id, title, image_url,
    start_price_cents, min_increment_cents, buy_now_cents, sort_index
  ) VALUES (
    p_session_id, v_uid, p_product_id, btrim(p_title), p_image_url,
    p_start_price_cents, p_min_increment_cents, p_buy_now_cents, v_next
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.create_live_auction(uuid, text, int, int, int, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_live_auction(uuid, text, int, int, int, text, uuid)
  TO authenticated;

-- ─── 6c. Artikel zurückziehen ───────────────────────────────────────────────
-- Nur solange nicht geboten wurde. Ein laufendes Gebot ist ein Angebot an
-- einen Menschen — das nimmt man nicht einfach vom Tisch.
CREATE OR REPLACE FUNCTION public.cancel_live_auction(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a     public.live_auctions;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF a.status NOT IN ('scheduled', 'running') THEN
    RAISE EXCEPTION 'auction_closed' USING ERRCODE = '22023';
  END IF;
  IF a.bid_count > 0 THEN
    RAISE EXCEPTION 'has_bids' USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_auctions
     SET status = 'cancelled', settled_at = now(), ends_at = now()
   WHERE id = a.id;

  RETURN jsonb_build_object('auction_id', a.id, 'status', 'cancelled');
END $$;

REVOKE ALL ON FUNCTION public.cancel_live_auction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_live_auction(uuid) TO authenticated;

-- ─── 7. Auktion starten ─────────────────────────────────────────────────────
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

  UPDATE public.live_auctions
     SET status     = 'running',
         started_at = now(),
         ends_at    = now() + make_interval(secs => p_duration_seconds)
   WHERE id = a.id;

  RETURN jsonb_build_object(
    'auction_id',    a.id,
    'status',        'running',
    'ends_at',       now() + make_interval(secs => p_duration_seconds),
    'next_min_cents', a.start_price_cents
  );
END $$;

REVOKE ALL ON FUNCTION public.start_live_auction(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_live_auction(uuid, int) TO authenticated;

-- ─── 8. Bieten ──────────────────────────────────────────────────────────────
-- Der einzige Weg, ein Gebot in die Datenbank zu bekommen.
CREATE OR REPLACE FUNCTION public.place_live_bid(
  p_auction_id   uuid,
  p_amount_cents int
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a            public.live_auctions;
  v_uid        uuid := auth.uid();
  v_next_min   int;
  v_new_ends   timestamptz;
  -- Ein Gebot in den letzten 10 Sekunden verlängert um 10 Sekunden.
  -- Ohne das gewinnt die schnellste Leitung, nicht das höchste Gebot.
  c_snipe_window constant interval := interval '10 seconds';
  c_extend       constant interval := interval '10 seconds';
  -- Obergrenze gegen Vertipper und Sabotage: 10.000 €.
  c_max_cents    constant int := 1000000;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Zeilen-Lock: ab hier ist diese Auktion für alle anderen Gebote gesperrt.
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  IF a.status <> 'running' THEN
    RAISE EXCEPTION 'auction_not_running' USING ERRCODE = '22023';
  END IF;

  -- Serverzeit entscheidet, nicht der Countdown auf dem Gerät.
  IF a.ends_at IS NULL OR a.ends_at <= now() THEN
    RAISE EXCEPTION 'auction_ended' USING ERRCODE = '22023';
  END IF;

  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;

  -- Wer führt, bietet nicht gegen sich selbst.
  IF a.current_bidder_id = v_uid THEN
    RAISE EXCEPTION 'already_leading' USING ERRCODE = '22023';
  END IF;

  v_next_min := CASE
    WHEN a.current_bid_cents IS NULL THEN a.start_price_cents
    ELSE a.current_bid_cents + a.min_increment_cents
  END;

  IF p_amount_cents < v_next_min THEN
    RAISE EXCEPTION 'bid_too_low' USING ERRCODE = '22023',
      DETAIL = format('Mindestens %s Cent', v_next_min);
  END IF;

  IF p_amount_cents > c_max_cents THEN
    RAISE EXCEPTION 'bid_too_high' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (a.id, v_uid, p_amount_cents);

  v_new_ends := CASE
    WHEN a.ends_at - now() < c_snipe_window THEN now() + c_extend
    ELSE a.ends_at
  END;

  UPDATE public.live_auctions
     SET current_bid_cents = p_amount_cents,
         current_bidder_id = v_uid,
         bid_count         = a.bid_count + 1,
         ends_at           = v_new_ends
   WHERE id = a.id;

  RETURN jsonb_build_object(
    'auction_id',        a.id,
    'current_bid_cents', p_amount_cents,
    'next_min_cents',    p_amount_cents + a.min_increment_cents,
    'ends_at',           v_new_ends,
    'extended',          v_new_ends <> a.ends_at,
    'leading',           true
  );
END $$;

REVOKE ALL ON FUNCTION public.place_live_bid(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_live_bid(uuid, int) TO authenticated;

-- ─── 9. Sofortkauf ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.buy_now_live_auction(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a       public.live_auctions;
  v_uid   uuid := auth.uid();
  v_cart  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.buy_now_cents IS NULL THEN
    RAISE EXCEPTION 'no_buy_now' USING ERRCODE = '22023';
  END IF;
  IF a.status NOT IN ('scheduled', 'running') THEN
    RAISE EXCEPTION 'auction_closed' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;
  -- Sobald jemand über dem Sofortkaufpreis bietet, ist der Sofortkauf weg.
  IF a.current_bid_cents IS NOT NULL AND a.current_bid_cents >= a.buy_now_cents THEN
    RAISE EXCEPTION 'buy_now_gone' USING ERRCODE = '22023';
  END IF;

  v_cart := public.ensure_auction_cart(v_uid, a.seller_id);

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (a.id, v_uid, a.buy_now_cents);

  UPDATE public.live_auctions
     SET status            = 'sold',
         current_bid_cents = a.buy_now_cents,
         current_bidder_id = v_uid,
         winner_id         = v_uid,
         bid_count         = a.bid_count + 1,
         settled_at        = now(),
         ends_at           = now(),
         cart_id           = v_cart
   WHERE id = a.id;

  RETURN jsonb_build_object(
    'auction_id', a.id,
    'status',     'sold',
    'winner_id',  v_uid,
    'cart_id',    v_cart,
    'paid_cents', a.buy_now_cents
  );
END $$;

REVOKE ALL ON FUNCTION public.buy_now_live_auction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_now_live_auction(uuid) TO authenticated;

-- ─── 10. Zuschlag ───────────────────────────────────────────────────────────
-- Idempotent und von jedem angemeldeten Client aufrufbar: wessen Countdown
-- zuerst auf null läuft, stößt die Abrechnung an. Alle weiteren Aufrufe sind
-- No-Ops. pg_cron unten ist nur das Sicherheitsnetz — eine Minute Auflösung
-- wäre für eine 30-Sekunden-Auktion zu grob.
CREATE OR REPLACE FUNCTION public.settle_live_auction(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a      public.live_auctions;
  v_cart uuid;
BEGIN
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  IF a.status <> 'running' THEN
    RETURN jsonb_build_object('auction_id', a.id, 'status', a.status,
                              'winner_id', a.winner_id, 'settled', false);
  END IF;

  IF a.ends_at IS NULL OR a.ends_at > now() THEN
    RETURN jsonb_build_object('auction_id', a.id, 'status', a.status,
                              'ends_at', a.ends_at, 'settled', false);
  END IF;

  IF a.current_bidder_id IS NULL THEN
    UPDATE public.live_auctions
       SET status = 'unsold', settled_at = now()
     WHERE id = a.id;
    RETURN jsonb_build_object('auction_id', a.id, 'status', 'unsold', 'settled', true);
  END IF;

  v_cart := public.ensure_auction_cart(a.current_bidder_id, a.seller_id);

  UPDATE public.live_auctions
     SET status     = 'sold',
         winner_id  = a.current_bidder_id,
         settled_at = now(),
         cart_id    = v_cart
   WHERE id = a.id;

  RETURN jsonb_build_object(
    'auction_id', a.id,
    'status',     'sold',
    'winner_id',  a.current_bidder_id,
    'cart_id',    v_cart,
    'paid_cents', a.current_bid_cents,
    'settled',    true
  );
END $$;

REVOKE ALL ON FUNCTION public.settle_live_auction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_live_auction(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_due_live_auctions()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r     record;
  v_num int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.live_auctions
     WHERE status = 'running' AND ends_at IS NOT NULL AND ends_at <= now()
     ORDER BY ends_at
     LIMIT 500
  LOOP
    PERFORM public.settle_live_auction(r.id);
    v_num := v_num + 1;
  END LOOP;
  RETURN v_num;
END $$;

REVOKE ALL ON FUNCTION public.settle_due_live_auctions() FROM PUBLIC, anon, authenticated;

-- ─── 11. Sicherheitsnetz per Cron ───────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'settle-live-auctions';
    PERFORM cron.schedule(
      'settle-live-auctions',
      '* * * * *',
      $cron$SELECT public.settle_due_live_auctions();$cron$
    );
    RAISE NOTICE 'settle-live-auctions läuft jede Minute als Sicherheitsnetz';
  ELSE
    RAISE NOTICE 'pg_cron fehlt — Zuschlag läuft nur über Client-Aufrufe';
  END IF;
END $$;

-- ─── 11b. Serveruhr ─────────────────────────────────────────────────────────
-- Der Client rechnet einmal beim Öffnen die Differenz zur Gerätezeit aus und
-- zieht sie von da an ab. Ohne das zeigt ein Handy mit falsch gestellter Uhr
-- einen Countdown, der nichts mit der Auktion zu tun hat.
CREATE OR REPLACE FUNCTION public.berkat_server_time()
RETURNS timestamptz
LANGUAGE sql STABLE
AS $$ SELECT now() $$;

REVOKE ALL ON FUNCTION public.berkat_server_time() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.berkat_server_time() TO anon, authenticated;

-- ─── 12. Realtime ───────────────────────────────────────────────────────────
-- Clients abonnieren GEFILTERT (session_id bzw. auction_id) — nie tabellenweit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'live_auctions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_auctions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'live_bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_bids;
  END IF;
END $$;

-- Für Realtime-Filter auf UPDATE braucht Postgres die alten Werte.
ALTER TABLE public.live_auctions REPLICA IDENTITY FULL;

COMMENT ON TABLE public.live_auctions IS
  'Berkat: eine Auktion = ein Artikel in einem Live-Stream. ends_at ist die Serveruhr.';
COMMENT ON FUNCTION public.place_live_bid(uuid, int) IS
  'Einziger Weg zu einem Gebot. Zeilen-Lock, Mindestschritt, Anti-Snipe, kein Selbstüberbieten.';
