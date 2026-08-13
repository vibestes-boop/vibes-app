-- ═══════════════════════════════════════════════════════════════════════════
-- Berkat — aufgelegten Artikel nachträglich ändern
--
-- Bisher gab es nur löschen und neu auflegen. Wer sich beim Startpreis vertippt
-- oder das falsche Bild erwischt hat, verlor damit auch seinen Platz in der
-- Reihenfolge — mitten in einer laufenden Show der schlechteste Moment für so
-- etwas.
--
-- Zwei Grenzen, und beide zieht der Server:
--
--  1. NUR SOLANGE ER WARTET. `scheduled` und sonst nichts. Den Preis eines
--     laufenden Artikels zu ändern, während Leute darauf bieten, ist kein
--     Bedienfehler, den man abfangen müsste — es ist die Manipulation selbst.
--     Verkauftes ist ohnehin Vergangenheit.
--
--  2. VOLLSTÄNDIG ERSETZEN, NICHT FLICKEN. Alle Felder werden gesetzt, auch die
--     leeren. Sonst wäre NULL zweideutig — „lass wie es war" oder „mach weg"?
--     Das Formular schickt immer den ganzen Zustand, damit die Frage gar nicht
--     erst entsteht.
--
-- `sort_index` bleibt bewusst unberührt: Ändern ist Korrektur, nicht Umsortieren.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_live_auction(
  p_auction_id          uuid,
  p_title               text,
  p_start_price_cents   int,
  p_min_increment_cents int,
  p_buy_now_cents       int DEFAULT NULL,
  p_image_url           text DEFAULT NULL
)
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

  -- Zeilen-Lock wie beim Abbrechen: zwischen Prüfung und Schreiben darf der
  -- Artikel nicht losstarten.
  SELECT * INTO a FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = '22023';
  END IF;

  IF a.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF a.status <> 'scheduled' THEN
    RAISE EXCEPTION 'auction_not_editable' USING ERRCODE = '22023';
  END IF;

  -- Kann bei 'scheduled' nicht vorkommen. Steht trotzdem hier, weil die
  -- Annahme sonst nur im Kopf existiert und beim nächsten Statuswechsel
  -- unbemerkt fällt.
  IF a.bid_count > 0 THEN
    RAISE EXCEPTION 'has_bids' USING ERRCODE = '22023';
  END IF;

  IF char_length(btrim(COALESCE(p_title, ''))) NOT BETWEEN 2 AND 140 THEN
    RAISE EXCEPTION 'invalid_title' USING ERRCODE = '22023';
  END IF;
  IF p_start_price_cents <= 0 OR p_min_increment_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_price' USING ERRCODE = '22023';
  END IF;
  IF p_buy_now_cents IS NOT NULL AND p_buy_now_cents <= p_start_price_cents THEN
    RAISE EXCEPTION 'buy_now_below_start' USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_auctions
     SET title               = btrim(p_title),
         start_price_cents   = p_start_price_cents,
         min_increment_cents = p_min_increment_cents,
         buy_now_cents       = p_buy_now_cents,
         image_url           = p_image_url
   WHERE id = a.id;

  RETURN jsonb_build_object('auction_id', a.id, 'status', 'updated');
END $$;

REVOKE ALL ON FUNCTION public.update_live_auction(uuid, text, int, int, int, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_live_auction(uuid, text, int, int, int, text)
  TO authenticated;
