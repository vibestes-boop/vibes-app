-- ═══════════════════════════════════════════════════════════════════════════
-- Berkat — Max-Gebot (Stellvertreter-Bieten)
--
-- Whatnots „Max. Gebot": Man hinterlegt, wie weit man gehen würde, und das
-- System bietet für einen mit — immer nur so viel wie nötig, nie mehr als das
-- Maximum. Wer nicht jede Sekunde am Handy klebt, kann trotzdem mitbieten.
--
-- Zwei Entscheidungen:
--
--  1. DIE AUFLÖSUNG LÄUFT AUF DEM SERVER, in derselben Transaktion und unter
--     demselben Zeilen-Lock wie das Gebot. Im Client wäre sie manipulierbar:
--     wer die Maxima anderer kennt, könnte sie exakt überbieten.
--
--  2. GESCHLOSSENE FORM STATT SCHLEIFE. Der Preis springt in EINEM Schritt auf
--     „zweithöchstes Maximum + Schritt". Eine Schleife, die in Ein-Euro-
--     Schritten von 5 auf 500 hochzählt, wäre 495 Durchläufe pro Gebot.
--
-- Die Maxima sind für niemanden lesbar außer dem Besitzer — sonst wäre das
-- ganze Verfahren wertlos.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.live_auto_bids (
  auction_id uuid NOT NULL REFERENCES public.live_auctions(id) ON DELETE CASCADE,
  bidder_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_cents  int  NOT NULL CHECK (max_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (auction_id, bidder_id)
);

CREATE INDEX IF NOT EXISTS live_auto_bids_ranking
  ON public.live_auto_bids (auction_id, max_cents DESC, created_at ASC);

ALTER TABLE public.live_auto_bids ENABLE ROW LEVEL SECURITY;

-- Jeder sieht ausschließlich sein eigenes Maximum. Würde man fremde Maxima
-- lesen können, wäre Stellvertreter-Bieten sinnlos.
DROP POLICY IF EXISTS live_auto_bids_select_own ON public.live_auto_bids;
CREATE POLICY live_auto_bids_select_own ON public.live_auto_bids
  FOR SELECT USING (auth.uid() = bidder_id);

REVOKE ALL ON public.live_auto_bids FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.live_auto_bids FROM authenticated;

-- ─── Auflösung ──────────────────────────────────────────────────────────────
-- Ermittelt aus allen Maxima (plus dem aktuellen Gebot des Führenden, das wie
-- ein Maximum zählt), wer führen muss und zu welchem Preis.
CREATE OR REPLACE FUNCTION public.resolve_auto_bids(p_auction_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a          public.live_auctions;
  r          record;
  v_win_id   uuid;
  v_win_max  int;
  v_run_max  int;
  v_price    int;
  v_rank     int := 0;
BEGIN
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id;
  IF NOT FOUND OR a.status <> 'running' THEN RETURN; END IF;

  -- Zwei Beste ermitteln. Der aktuell Führende zählt mit seinem abgegebenen
  -- Gebot mit, falls er kein (höheres) Maximum hinterlegt hat.
  FOR r IN
    SELECT bidder_id, MAX(m) AS m, MIN(t) AS t
      FROM (
        SELECT ab.bidder_id, ab.max_cents AS m, ab.created_at AS t
          FROM public.live_auto_bids ab
         WHERE ab.auction_id = p_auction_id
        UNION ALL
        SELECT a.current_bidder_id, a.current_bid_cents, '-infinity'::timestamptz
         WHERE a.current_bidder_id IS NOT NULL AND a.current_bid_cents IS NOT NULL
      ) AS entries
     GROUP BY bidder_id
     ORDER BY 2 DESC, 3 ASC
     LIMIT 2
  LOOP
    v_rank := v_rank + 1;
    IF v_rank = 1 THEN
      v_win_id  := r.bidder_id;
      v_win_max := r.m;
    ELSE
      v_run_max := r.m;
    END IF;
  END LOOP;

  IF v_win_id IS NULL THEN RETURN; END IF;

  -- Preis: gerade so viel, dass der Zweitbeste überboten ist — nie mehr.
  v_price := CASE
    WHEN v_run_max IS NULL THEN GREATEST(COALESCE(a.current_bid_cents, 0), a.start_price_cents)
    ELSE LEAST(v_win_max, v_run_max + a.min_increment_cents)
  END;
  v_price := GREATEST(v_price, a.start_price_cents);

  -- Nichts zu tun, wenn derselbe schon zu diesem Preis führt.
  IF a.current_bidder_id = v_win_id AND a.current_bid_cents = v_price THEN RETURN; END IF;
  IF v_price > v_win_max THEN RETURN; END IF;

  INSERT INTO public.live_bids (auction_id, bidder_id, amount_cents)
  VALUES (p_auction_id, v_win_id, v_price)
  ON CONFLICT (auction_id, amount_cents) DO NOTHING;

  UPDATE public.live_auctions
     SET current_bid_cents = v_price,
         current_bidder_id = v_win_id,
         bid_count         = bid_count + 1
   WHERE id = p_auction_id;
END $$;

REVOKE ALL ON FUNCTION public.resolve_auto_bids(uuid) FROM PUBLIC, anon, authenticated;

-- ─── Maximum setzen ─────────────────────────────────────────────────────────
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
  IF a.status <> 'running' THEN
    RAISE EXCEPTION 'auction_not_running' USING ERRCODE = '22023';
  END IF;
  IF a.ends_at IS NULL OR a.ends_at <= now() THEN
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

  PERFORM public.resolve_auto_bids(p_auction_id);

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'auction_id',        a.id,
    'current_bid_cents', a.current_bid_cents,
    'leading',           a.current_bidder_id = v_uid,
    'my_max_cents',      p_max_cents,
    'ends_at',           a.ends_at
  );
END $$;

REVOKE ALL ON FUNCTION public.set_max_bid(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_max_bid(uuid, int) TO authenticated;

-- ─── Normales Gebot löst Maxima mit aus ─────────────────────────────────────
-- Ein Handgebot muss sofort gegen die hinterlegten Maxima geprüft werden,
-- sonst führt jemand für ein paar Sekunden zu Unrecht.
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
  v_extended   boolean;
  c_snipe_window constant interval := interval '10 seconds';
  c_extend       constant interval := interval '10 seconds';
  c_max_cents    constant int := 1000000;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.status <> 'running' THEN
    RAISE EXCEPTION 'auction_not_running' USING ERRCODE = '22023';
  END IF;
  IF a.ends_at IS NULL OR a.ends_at <= now() THEN
    RAISE EXCEPTION 'auction_ended' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id = v_uid THEN
    RAISE EXCEPTION 'seller_cannot_bid' USING ERRCODE = '42501';
  END IF;
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

  v_extended := (a.ends_at - now()) < c_snipe_window;
  v_new_ends := CASE WHEN v_extended THEN now() + c_extend ELSE a.ends_at END;

  UPDATE public.live_auctions
     SET current_bid_cents = p_amount_cents,
         current_bidder_id = v_uid,
         bid_count         = a.bid_count + 1,
         ends_at           = v_new_ends
   WHERE id = a.id;

  -- Erst jetzt die Maxima anderer greifen lassen. Die Verlängerung oben zählt
  -- bewusst nur für das Handgebot: ein automatischer Konter im selben Moment
  -- soll die Uhr nicht ein zweites Mal hochsetzen.
  PERFORM public.resolve_auto_bids(a.id);

  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'auction_id',        a.id,
    'current_bid_cents', a.current_bid_cents,
    'next_min_cents',    a.current_bid_cents + a.min_increment_cents,
    'ends_at',           a.ends_at,
    'extended',          v_extended,
    'leading',           a.current_bidder_id = v_uid
  );
END $$;

REVOKE ALL ON FUNCTION public.place_live_bid(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_live_bid(uuid, int) TO authenticated;

COMMENT ON TABLE public.live_auto_bids IS
  'Berkat: hinterlegte Maxima. Nur der Besitzer darf sein eigenes lesen.';
