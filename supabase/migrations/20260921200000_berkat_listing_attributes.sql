-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: Marke, Farbe und Material am Artikel
--
-- WOHER DIE FRAGE KOMMT (21.09.2026)
-- Zaur hat die Kleinanzeigen-Artikelseite danebengelegt: Dort steht eine
-- Merkmalstabelle (Typ · Zustand · Marke · Farbe · Material). Berkat hatte
-- davon zwei — Zustand und Größe. Ich habe die drei fehlenden zunächst NICHT
-- gebaut, weil am selben Tag das Einstell-Formular entrümpelt worden war
-- (Übergabe 113) und vier neue Felder das Gegenteil gewesen wären. Zaur hat
-- sie danach ausdrücklich bestellt.
--
-- WARUM DREI SPALTEN UND KEIN MERKMALS-SYSTEM
-- Der Reflex wäre eine Tabelle `listing_attributes (auction_id, key, value)`
-- oder eine JSONB-Spalte — „dann kann man später alles". Beides ist hier
-- falsch, und zwar aus demselben Grund, aus dem `size` am 19.08.2026 eine
-- Spalte wurde:
--
--   • Ein Filter über JSONB braucht einen GIN-Index und eine Abfragesprache,
--     die niemand mehr liest. Drei Spalten bekommen drei normale Indizes.
--   • Ein Schlüssel-Wert-Paar hat keinen Typ und keine Länge. `char_length`
--     und `CHECK` gibt es nur an einer echten Spalte.
--   • Die Merkmale sind NICHT offen: Es sind genau die drei, die auf der
--     Artikelseite stehen sollen. Ein System für „beliebige Merkmale" löst ein
--     Problem, das Berkat nicht hat.
--
-- Wenn eines Tages je Kategorie eigene Merkmale nötig werden (Schuhweite,
-- Ringgröße, Auflage), ist das der Moment für ein System — dann als eigene
-- Tabelle mit einer gepflegten Merkmalsliste, nie als JSONB.
--
-- FREITEXT, KEINE LISTE — dieselbe Absicht wie bei `size`.
-- Die Oberfläche bietet für die FARBE dreizehn Vorschläge an, damit „Schwarz"
-- nicht in fünf Schreibweisen zerfällt. Die DATENBANK nimmt trotzdem jeden
-- Text an. Der Grund steht in `20260819100000`: „Für den FILTER wird später
-- normalisiert, nicht bei der Eingabe — sonst sperrt die Datenbank jemanden
-- aus, dessen Größe sie nicht kennt." Für „petrol", „altrosa" oder „roségold"
-- gilt das genauso.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1 · Die drei Spalten ────────────────────────────────────────────────────
--
-- 40 Zeichen für Marke und Material, 24 für die Farbe. Die Grenzen schließen
-- aus, dass jemand die Beschreibung hier hineinschreibt — dieselbe Überlegung
-- wie bei `live_auctions_size_len`.
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS material text;

ALTER TABLE public.live_auctions
  DROP CONSTRAINT IF EXISTS live_auctions_brand_len;
ALTER TABLE public.live_auctions
  ADD CONSTRAINT live_auctions_brand_len
    CHECK (brand IS NULL OR char_length(brand) <= 40);

ALTER TABLE public.live_auctions
  DROP CONSTRAINT IF EXISTS live_auctions_color_len;
ALTER TABLE public.live_auctions
  ADD CONSTRAINT live_auctions_color_len
    CHECK (color IS NULL OR char_length(color) <= 24);

ALTER TABLE public.live_auctions
  DROP CONSTRAINT IF EXISTS live_auctions_material_len;
ALTER TABLE public.live_auctions
  ADD CONSTRAINT live_auctions_material_len
    CHECK (material IS NULL OR char_length(material) <= 40);

COMMENT ON COLUMN public.live_auctions.brand IS
  'Marke als Freitext (Nike, Zara, handgemacht). Keine gepflegte Liste — siehe 20260921200000.';
COMMENT ON COLUMN public.live_auctions.color IS
  'Farbe als Freitext. Die App schlägt dreizehn vor, die Spalte nimmt jeden Text.';
COMMENT ON COLUMN public.live_auctions.material IS
  'Material als Freitext (Baumwolle, Leder, 925 Silber).';

-- ⚠️ REGEL 11 — GEPRÜFT, NICHT ANGENOMMEN, UND MIT EINER WARNUNG.
--
-- `live_auctions` steht in CLAUDE.md Regel 11 in der Liste der fünf Tabellen
-- mit „eingefrorener Spaltenliste". Die Migration `20260823140000` hat am
-- echten Abzug nachgemessen und festgehalten: Die Tabelle trägt weiterhin ein
-- TABELLEN-weites `GRANT SELECT … TO anon, authenticated` (Abzug Z. 28870/71).
-- Neue Spalten sind damit gedeckt — deshalb funktionieren `size` (19.08.) und
-- `planned_for` (19.08.) bis heute ohne eigenen GRANT.
--
-- ⚠️ Der Grund für den Fehlalarm: Die Probe in Regel 11 fragt
-- `pg_attribute.attacl IS NOT NULL`. Dieses Feld ist aber auch dann gesetzt,
-- wenn jemand eine Spalte ausdrücklich GEWÄHRT hat — und genau das ist hier
-- sechsmal passiert (`women_only`, `category`, `seller_kind`, `shipping_tier`
-- …). Die Probe erkennt „hat Spalten-Rechte", nicht „das Tabellen-Recht wurde
-- aufgelöst". Für `live_auctions` meldet sie deshalb einen Zustand, den es
-- nicht gibt. Wer die Liste das nächste Mal prüft, muss ZUSÄTZLICH fragen, ob
-- das Tabellen-Recht noch steht:
--
--   SELECT relacl FROM pg_class WHERE oid = 'public.live_auctions'::regclass;
--   -- enthält `anon=r/...` und `authenticated=r/...`? Dann ist nichts
--   -- eingefroren, egal was attacl sagt.
--
-- Die GRANTs unten sind nach diesem Befund REDUNDANT. Sie bleiben trotzdem
-- stehen: Sie kosten nichts, sie halten den Abzug einheitlich, und sollte
-- irgendwann doch jemand eine Spalte per REVOKE herauslösen, sind diese drei
-- dann die einzigen, die überleben.
GRANT SELECT (brand) ON public.live_auctions TO anon, authenticated;
GRANT SELECT (color) ON public.live_auctions TO anon, authenticated;
GRANT SELECT (material) ON public.live_auctions TO anon, authenticated;

-- ── 2 · Indizes für den späteren Filter ─────────────────────────────────────
--
-- Nur Marke und Farbe, nicht Material: Nach einer Marke sucht man („alles von
-- Nike"), nach einer Farbe filtert man, nach einem Material praktisch nie.
-- Ein Index, den niemand benutzt, kostet bei jedem Schreiben.
--
-- `lower(...)` im Index, weil die Eingabe Freitext ist und der Filter später
-- ohne Rücksicht auf Groß- und Kleinschreibung suchen muss. Teil-Index auf
-- `IS NOT NULL`: Heute trägt keine einzige Zeile einen Wert.
CREATE INDEX IF NOT EXISTS live_auctions_brand_idx
  ON public.live_auctions (lower(brand)) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS live_auctions_color_idx
  ON public.live_auctions (lower(color)) WHERE color IS NOT NULL;

-- ── 3 · Der Schreibweg: eine EIGENE Funktion ────────────────────────────────
--
-- ⚠️ `create_standing_listing` UND `update_standing_listing` BEKOMMEN KEINE
-- NEUEN PARAMETER. Der Grund steht wörtlich in `lib/useStanding.ts`:
--
--     „Wer diese RPC jetzt noch einmal per DROP + CREATE ersetzt, macht jede
--      ausgelieferte Fassung ohne passenden OTA blind — das Anlegen scheitert
--      dann mit PGRST202."
--
-- Und ein Parameter mit Vorgabewert hilft nicht: `CREATE OR REPLACE` ersetzt
-- nur bei GLEICHER Signatur. Mit drei zusätzlichen Parametern entstünde eine
-- ZWEITE Funktion daneben, und PostgREST kann zwischen zwei Überladungen nicht
-- wählen — HTTP 300, für ALLE Aufrufer gleichzeitig.
--
-- Deshalb dieselbe Bauweise wie `set_listing_shipping_tier` (23.08.) und
-- `move_listing_to_show` (21.08.): ein zweiter Ruf nach dem Anlegen. Er darf
-- scheitern, ohne den ersten mitzureißen — dann steht der Artikel ohne
-- Merkmale, und die lassen sich nachtragen.
CREATE OR REPLACE FUNCTION public.set_listing_attributes(
  p_auction_id uuid,
  p_brand      text,
  p_color      text,
  p_material   text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_seller uuid;
  v_status text;
  v_brand    text := NULLIF(btrim(COALESCE(p_brand, '')), '');
  v_color    text := NULLIF(btrim(COALESCE(p_color, '')), '');
  v_material text := NULLIF(btrim(COALESCE(p_material, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Die Längen spiegeln die CHECKs oben. Sie hier ZUSÄTZLICH zu prüfen ist
  -- kein Doppel: Ein CHECK wirft `23514` mit dem Constraint-Namen im Text —
  -- eine Meldung, die kein Mensch liest. Diese Prüfung gibt der Oberfläche
  -- einen Namen, den sie übersetzen kann.
  IF char_length(COALESCE(v_brand, '')) > 40
     OR char_length(COALESCE(v_color, '')) > 24
     OR char_length(COALESCE(v_material, '')) > 40 THEN
    RAISE EXCEPTION 'attribute_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT seller_id, status INTO v_seller, v_status
    FROM public.live_auctions WHERE id = p_auction_id FOR UPDATE;

  -- „Gibt es nicht" statt „gehört dir nicht": Die Antwort darf die Existenz
  -- eines fremden — womöglich Frauen-Only — Artikels nicht verraten. Dieselbe
  -- Sprache wie in `buy_now_live_auction` und `set_listing_shipping_tier`.
  IF v_seller IS NULL OR v_seller <> v_uid THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ Nach dem Zuschlag ist die Beschaffenheit Teil dessen, wofür jemand
  -- bezahlt hat. Sie dann noch zu ändern hiesse, den Kaufgegenstand
  -- nachträglich umzuschreiben — beim Privatverkauf genau die Angabe, an der
  -- der Verkäufer gemessen wird.
  IF v_status IN ('sold', 'cancelled') THEN
    RAISE EXCEPTION 'listing_closed' USING ERRCODE = '22023';
  END IF;

  -- Vollersatz, kein Teil-Update: Das Formular schickt immer alle drei Werte,
  -- und nur so lässt sich eine Marke auch wieder LEEREN. Dieselbe Regel wie
  -- bei `update_standing_listing`.
  UPDATE public.live_auctions
     SET brand = v_brand, color = v_color, material = v_material
   WHERE id = p_auction_id;
END $fn$;

-- ⚠️ DIE GRANT-FALLE. `CREATE OR REPLACE` behält Rechte nicht über alle
-- Postgres-Fassungen hinweg garantiert, und ein frisches CREATE gibt EXECUTE
-- standardmässig an PUBLIC — PUBLIC schliesst `anon` ein. Genau so war
-- `credit_coins` am 14.08.2026 ohne Anmeldung aufrufbar.
REVOKE ALL ON FUNCTION public.set_listing_attributes(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_listing_attributes(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_listing_attributes(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_listing_attributes(uuid, text, text, text) TO service_role;

COMMENT ON FUNCTION public.set_listing_attributes(uuid, text, text, text) IS
  'Setzt Marke, Farbe und Material am eigenen offenen Angebot. Eigene Funktion statt '
  'neuer Parameter an create_/update_standing_listing — deren Signaturen sind seit '
  'App-Fassung 1.0.0 eingefroren (PGRST202 / HTTP 300). Siehe 20260921200000.';
