-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: Größe am Artikel
--
-- WARUM DIESE SPALTE UND KEIN VARIANTEN-SYSTEM
-- Von 36 Testartikeln tragen neun die Größe im TITEL („Sneaker weiß, Gr. 42",
-- „Babyjacke, Gr. 74"). Das ist eine Notlösung mit drei Kosten: nicht filterbar,
-- nicht vergleichbar, und sie frisst den Platz, den der Titel für die Sache
-- selbst bräuchte.
--
-- Der naheliegende Reflex wäre Whatnots Varianten-System („Größe 10 · noch 4").
-- Das ist für Berkat falsch, und zwar aus einem Grund, der im Schema steht:
-- `live_auctions` hat KEIN `stock`. Ein Angebot ist genau ein Stück, der Status
-- springt beim Kauf auf `sold`. Varianten setzen Mengenführung voraus — samt
-- atomarem Dekrement, sonst verkauft man Größe M zweimal. Und der Markt ist
-- Secondhand: Eine gebrauchte Abaya gibt es einmal. Höchstens fünf der 36
-- Testartikel wären echte Serienware.
--
-- Diese Spalte löst, was die neun Titel wirklich brauchen: Die Größe wird
-- sichtbar und filterbar, ohne Bestandsführung, ohne Race, ohne neuen Kaufweg.
-- Volle Varianten lohnen erst mit einem Händler, der Serienware hat — dann als
-- eigene Tabelle, NIE als JSONB-Spalte (Bestand muss man sperren können).
-- Begründung ausführlich: HANDOFF, Abschnitt 41.
--
-- FREITEXT, KEINE LISTE — Absicht.
-- „42", „M", „74", „One Size", „38/40" sind alle richtig, und welche Skala gilt,
-- weiß nur der Verkäufer. Eine gepflegte Liste müsste Konfektions-, Schuh- und
-- Kindergrößen gleichzeitig abbilden und wäre am ersten Tag unvollständig. Für
-- den FILTER wird später normalisiert, nicht bei der Eingabe — sonst sperrt die
-- Datenbank jemanden aus, dessen Größe sie nicht kennt.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Die Spalte ───────────────────────────────────────────────────────────
-- 24 Zeichen reichen für „38/40 (EU)" und schließen aus, dass jemand die
-- Beschreibung hier hineinschreibt.
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS size text
  CONSTRAINT live_auctions_size_len CHECK (size IS NULL OR char_length(size) <= 24);

COMMENT ON COLUMN public.live_auctions.size IS
  'Größe als Freitext (42, M, 74, One Size). Keine gepflegte Liste — siehe 20260819100000.';

-- ⚠️ KEIN `GRANT SELECT (size)` nötig.
-- Die eingefrorene Spaltenliste betrifft `live_sessions`, `user_whip_ingresses`
-- und `profiles` (CLAUDE.md Regel 11). `live_auctions` hat nie ein
-- spaltenweises REVOKE bekommen — die Tabelle wird als Ganzes gewährt, neue
-- Spalten sind sofort lesbar. Vor dem nächsten Spalten-Zusatz trotzdem prüfen:
--   \dp public.live_auctions

-- ─── 2. Anlegen mit Größe ────────────────────────────────────────────────────
-- DROP + CREATE, weil ein neuer Parameter die Signatur ändert.
--
-- ⚠️ DIE GRANT-FALLE. Ein DROP entfernt die Rechte, ein CREATE gibt EXECUTE
-- standardmäßig an PUBLIC — und PUBLIC schließt `anon` ein. Genau so war
-- `credit_coins` am 14.08.2026 ohne Anmeldung aufrufbar. Die REVOKE/GRANT-Zeilen
-- am Ende sind deshalb Pflicht, nicht Kosmetik.
DROP FUNCTION IF EXISTS public.create_standing_listing(
  text, integer, text[], boolean, boolean, text, text, text, text, text);

CREATE FUNCTION public.create_standing_listing(
  p_title          text,
  p_price_cents    integer,
  p_image_urls     text[] DEFAULT NULL,
  p_women_only     boolean DEFAULT false,
  p_accepts_offers boolean DEFAULT false,
  p_category       text DEFAULT NULL,
  p_description    text DEFAULT NULL,
  p_condition      text DEFAULT NULL,
  p_postal_code    text DEFAULT NULL,
  p_city           text DEFAULT NULL,
  p_size           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_kind text;
  v_urls text[];
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_price_cents IS NULL OR p_price_cents <= 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;
  IF p_women_only AND NOT public.is_women_only_verified() THEN
    RAISE EXCEPTION 'not_women_only_verified' USING ERRCODE = '42501';
  END IF;
  IF p_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.berkat_categories WHERE slug = p_category AND active
  ) THEN
    RAISE EXCEPTION 'unknown_category' USING ERRCODE = '22023';
  END IF;

  v_urls := ARRAY(
    SELECT btrim(u)
      FROM unnest(coalesce(p_image_urls, '{}'::text[])) WITH ORDINALITY AS t(u, ord)
     WHERE NULLIF(btrim(u), '') IS NOT NULL
     ORDER BY ord
  );
  IF coalesce(array_length(v_urls, 1), 0) > 8 THEN
    RAISE EXCEPTION 'too_many_images' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.berkat_sellers (user_id, kind)
  VALUES (v_uid, 'private')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT kind INTO v_kind FROM public.berkat_sellers WHERE user_id = v_uid;

  INSERT INTO public.live_auctions (
    session_id, seller_id, title, image_url, image_urls,
    start_price_cents, buy_now_cents, status, women_only, accepts_offers, category,
    description, condition, postal_code, city, seller_kind, size
  ) VALUES (
    NULL, v_uid, btrim(p_title), v_urls[1], v_urls,
    100, p_price_cents, 'listed', coalesce(p_women_only, false),
    coalesce(p_accepts_offers, false), p_category,
    NULLIF(btrim(coalesce(p_description, '')), ''),
    NULLIF(btrim(coalesce(p_condition, '')), ''),
    NULLIF(btrim(coalesce(p_postal_code, '')), ''),
    NULLIF(btrim(coalesce(p_city, '')), ''),
    v_kind,
    NULLIF(btrim(coalesce(p_size, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_standing_listing(
  text, integer, text[], boolean, boolean, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_standing_listing(
  text, integer, text[], boolean, boolean, text, text, text, text, text, text)
  TO authenticated;

-- ─── 3. Bearbeiten mit Größe ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.update_standing_listing(
  uuid, text, integer, text[], boolean, boolean, text, text, text, text, text);

CREATE FUNCTION public.update_standing_listing(
  p_id             uuid,
  p_title          text,
  p_price_cents    integer,
  p_image_urls     text[] DEFAULT NULL,
  p_women_only     boolean DEFAULT false,
  p_accepts_offers boolean DEFAULT false,
  p_category       text DEFAULT NULL,
  p_description    text DEFAULT NULL,
  p_condition      text DEFAULT NULL,
  p_postal_code    text DEFAULT NULL,
  p_city           text DEFAULT NULL,
  p_size           text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a      public.live_auctions;
  v_uid  uuid := auth.uid();
  v_urls text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.live_auctions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR a.session_id IS NOT NULL THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;
  IF a.seller_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF a.status <> 'listed' THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;

  IF p_title IS NULL OR char_length(btrim(p_title)) < 2 THEN
    RAISE EXCEPTION 'title_too_short' USING ERRCODE = '22023';
  END IF;
  IF p_price_cents IS NULL OR p_price_cents <= 100 THEN
    RAISE EXCEPTION 'price_too_low' USING ERRCODE = '22023';
  END IF;
  IF p_women_only AND NOT public.is_women_only_verified() THEN
    RAISE EXCEPTION 'not_women_only_verified' USING ERRCODE = '42501';
  END IF;
  IF p_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.berkat_categories WHERE slug = p_category AND active
  ) THEN
    RAISE EXCEPTION 'unknown_category' USING ERRCODE = '22023';
  END IF;

  v_urls := ARRAY(
    SELECT btrim(u)
      FROM unnest(coalesce(p_image_urls, '{}'::text[])) WITH ORDINALITY AS t(u, ord)
     WHERE NULLIF(btrim(u), '') IS NOT NULL
     ORDER BY ord
  );
  IF coalesce(array_length(v_urls, 1), 0) > 8 THEN
    RAISE EXCEPTION 'too_many_images' USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_auctions
     SET title          = btrim(p_title),
         buy_now_cents  = p_price_cents,
         image_url      = v_urls[1],
         image_urls     = v_urls,
         women_only     = coalesce(p_women_only, false),
         accepts_offers = coalesce(p_accepts_offers, false),
         category       = p_category,
         description    = NULLIF(btrim(coalesce(p_description, '')), ''),
         condition      = NULLIF(btrim(coalesce(p_condition, '')), ''),
         postal_code    = NULLIF(btrim(coalesce(p_postal_code, '')), ''),
         city           = NULLIF(btrim(coalesce(p_city, '')), ''),
         size           = NULLIF(btrim(coalesce(p_size, '')), ''),
         updated_at     = now()
   WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.update_standing_listing(
  uuid, text, integer, text[], boolean, boolean, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_standing_listing(
  uuid, text, integer, text[], boolean, boolean, text, text, text, text, text, text)
  TO authenticated;

-- ─── Gegenprobe ──────────────────────────────────────────────────────────────
-- 1. Spalte da und begrenzt:
--      INSERT … (size) VALUES (repeat('x', 25));  -- muss 23514 werfen
-- 2. Rechte NICHT an anon (die Falle von oben):
--      SELECT p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE')
--        FROM pg_proc p, pg_roles r
--       WHERE p.proname IN ('create_standing_listing','update_standing_listing')
--         AND r.rolname IN ('anon','authenticated');
--      -- anon MUSS false sein, authenticated true.
