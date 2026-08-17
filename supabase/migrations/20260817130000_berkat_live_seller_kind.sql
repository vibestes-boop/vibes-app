-- Auch der Live-Verkauf trägt eine Anbieterkennzeichnung
--
-- WAS FEHLTE
-- `create_live_auction` schreibt `session_id, seller_id, product_id, title,
-- image_url, start_price_cents, min_increment_cents, buy_now_cents, sort_index`
-- — `seller_kind` steht nicht in der Liste. Jeder Show-Artikel entstand damit
-- ohne Kennzeichnung, und die Live-Oberfläche holte die Spalte gar nicht erst.
--
-- Das ist nicht der Nebenschauplatz, sondern der HAUPTverkaufsweg: Über
-- `BidButton` läuft derselbe Sofortkauf wie im Regal, und ein Zuschlag am Ende
-- einer Auktion schließt ebenso einen Vertrag. Art. 246d § 1 EGBGB verlangt die
-- Angabe vor JEDER Vertragserklärung, nicht nur vor der im Regal.
--
-- Die Skeptiker hatten genau das beim Entwurf vom 17.08. schon angemerkt
-- („`seller_kind` hätte den Hauptverkaufsweg nie erreicht"); die gebaute
-- Fassung hat es damals nicht behoben. `set_berkat_seller_kind` zieht zwar
-- offene Show-Artikel nach — aber nur die, die zum Zeitpunkt der Erklärung
-- schon existierten. Die normale Reihenfolge ist umgekehrt: einmal erklären,
-- danach senden. Alles danach blieb NULL.
--
-- ⚠️ KEIN `INSERT ... ON CONFLICT DO NOTHING` WIE IM REGAL.
-- `create_standing_listing` darf die Vorgabe „privat" festhalten, weil sie im
-- Composer sichtbar über dem Knopf steht — wer drückt, erklärt sie. Im
-- Live-Studio steht sie nirgends. Eine Erklärung zu speichern, die niemand
-- gesehen hat, wäre der Fehler von 20260816220000 in Grün: Diesmal hätte die
-- Datenbank eine Angabe, die die Oberfläche nicht zeigt.
--
-- Wer noch nichts erklärt hat, bekommt also NULL — und die Oberfläche zeigt
-- dann nichts. Dass das in der Praxis selten vorkommt, ist kein Zufall, sondern
-- gebaut: „Deine ersten Schritte" stellt **Regal vor Show** (Übergabe
-- Abschnitt 18), und das Einstellen ins Regal erklärt den Typ. Wer der
-- empfohlenen Reihenfolge folgt, hat seine Kennzeichnung, bevor er zum ersten
-- Mal sendet.

BEGIN;

-- ─── 1. Der Stempel am Show-Artikel ──────────────────────────────────────────
--
-- ⚠️ Der Rumpf ist wörtlich der aus `20260813150000`; geändert sind nur die
-- Deklaration `v_kind` und die INSERT-Spaltenliste. Das Original lag daneben.
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
  v_kind   text;
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

  -- Nur LESEN, nicht anlegen — Begründung im Kopf dieser Datei.
  SELECT kind INTO v_kind FROM public.berkat_sellers WHERE user_id = v_uid;

  INSERT INTO public.live_auctions (
    session_id, seller_id, product_id, title, image_url,
    start_price_cents, min_increment_cents, buy_now_cents, sort_index,
    seller_kind
  ) VALUES (
    p_session_id, v_uid, p_product_id, btrim(p_title), p_image_url,
    p_start_price_cents, p_min_increment_cents, p_buy_now_cents, v_next,
    v_kind
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.create_live_auction(uuid, text, int, int, int, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_live_auction(uuid, text, int, int, int, text, uuid)
  TO authenticated;

-- ─── 2. Ein Typwechsel darf das Impressum nicht löschen ──────────────────────
--
-- `set_berkat_seller_kind` ist ein Ganz-Datensatz-Setzer: Alle neun Spalten
-- werden aus `EXCLUDED` geschrieben. Der Composer im Regal ruft ihn aber als
-- Teil-Änderung für NUR den Anbietertyp (`useBerkatSeller.ts` füllt den Rest
-- mit NULL). Jedes Antippen von „Gewerblich"/„Privatperson" leerte damit
-- `legal_name`, `street`, `postal_code`, `city`, `country`, `contact_email`,
-- `vat_id` und `lucid_id`.
--
-- Heute folgenlos, weil diese Spalten überall NULL sind und es noch kein
-- Formular dafür gibt. Genau deshalb ist es eine kurze Zündschnur: Sie zündet
-- in dem Moment, in dem das Formular gebaut wird — und trifft dann die
-- Impressumsangaben eines gewerblichen Verkäufers, also Pflichtangaben.
--
-- `COALESCE(EXCLUDED.<feld>, s.<feld>)` heißt: „nicht übergeben" ändert nichts.
-- Ein ausdrückliches Leeren braucht später einen eigenen Weg (Leerstring statt
-- NULL) — dieselbe Trennung, die `checkout_enabled` schon hat.
--
-- ⚠️ `kind` bleibt bewusst ohne COALESCE: Der Typ IST der Zweck des Aufrufs,
-- und er wird von der Funktion vorher gegen `('private','business')` geprüft,
-- kann also nie NULL sein.
CREATE OR REPLACE FUNCTION public.set_berkat_seller_kind(
  p_kind          text,
  p_legal_name    text DEFAULT NULL,
  p_street        text DEFAULT NULL,
  p_postal_code   text DEFAULT NULL,
  p_city          text DEFAULT NULL,
  p_country       text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_vat_id        text DEFAULT NULL,
  p_lucid_id      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('private', 'business') THEN
    RAISE EXCEPTION 'unknown_seller_kind' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.berkat_sellers AS s (
    user_id, kind, legal_name, street, postal_code, city, country,
    contact_email, vat_id, lucid_id, declared_at
  ) VALUES (
    v_uid, p_kind,
    NULLIF(btrim(coalesce(p_legal_name, '')), ''),
    NULLIF(btrim(coalesce(p_street, '')), ''),
    NULLIF(btrim(coalesce(p_postal_code, '')), ''),
    NULLIF(btrim(coalesce(p_city, '')), ''),
    NULLIF(btrim(coalesce(p_country, '')), ''),
    NULLIF(btrim(coalesce(p_contact_email, '')), ''),
    NULLIF(btrim(coalesce(p_vat_id, '')), ''),
    NULLIF(btrim(coalesce(p_lucid_id, '')), ''),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    kind          = EXCLUDED.kind,
    legal_name    = COALESCE(EXCLUDED.legal_name,    s.legal_name),
    street        = COALESCE(EXCLUDED.street,        s.street),
    postal_code   = COALESCE(EXCLUDED.postal_code,   s.postal_code),
    city          = COALESCE(EXCLUDED.city,          s.city),
    country       = COALESCE(EXCLUDED.country,       s.country),
    contact_email = COALESCE(EXCLUDED.contact_email, s.contact_email),
    vat_id        = COALESCE(EXCLUDED.vat_id,        s.vat_id),
    lucid_id      = COALESCE(EXCLUDED.lucid_id,      s.lucid_id),
    declared_at   = now()
  -- `checkout_enabled` steht bewusst NICHT in der Liste: Ein Wechsel des
  -- Anbietertyps darf die Kassen-Freigabe weder erteilen noch verlieren.
  WHERE s.user_id = v_uid;

  -- ⚠️ Noch OFFENE eigene Angebote ziehen den neuen Typ nach, VERKAUFTE nie.
  -- Art. 246d verlangt die Angabe vor der Vertragserklärung — ein bereits
  -- geschlossener Kauf behält den Stand von damals, sonst änderte eine spätere
  -- Umstufung rückwirkend die Rechtslage abgeschlossener Geschäfte. Ein noch
  -- offenes Angebot muss dagegen den heutigen Stand zeigen, sonst wirbt ein
  -- Unternehmer weiter mit „Privatverkauf".
  UPDATE public.live_auctions
     SET seller_kind = p_kind
   WHERE seller_id = v_uid
     AND status IN ('listed', 'scheduled', 'running');
END $$;

REVOKE ALL ON FUNCTION public.set_berkat_seller_kind(text, text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_berkat_seller_kind(text, text, text, text, text, text, text, text, text)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─── Gegenprobe nach dem Einspielen ──────────────────────────────────────────
-- 1. Je genau EINE Fassung im Katalog (sonst antwortet PostgREST mit HTTP 300):
--      SELECT oid::regprocedure FROM pg_proc
--       WHERE proname IN ('create_live_auction', 'set_berkat_seller_kind');
--
-- 2. Ein Artikel, den ein erklärter Verkäufer in einer Show auflegt, trägt
--    danach `seller_kind` — und im Live-Raum steht die Kennzeichnung unter dem
--    Artikelnamen, neben dem Versandhinweis.
--
-- 3. Der Typwechsel löscht nichts mehr: Ein Feld von Hand setzen, im Composer
--    auf „Gewerblich" und zurück auf „Privatperson" tippen, danach steht das
--    Feld weiterhin da.
