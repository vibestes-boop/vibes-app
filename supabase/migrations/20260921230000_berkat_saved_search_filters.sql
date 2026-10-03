-- ═══════════════════════════════════════════════════════════════════════════
-- Gespeicherte Suchen merken sich die Filter — und stellen wieder dieselbe
-- Frage wie der Client
-- 21.09.2026 · Berkat
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ZWEI DINGE IN EINER DATEI, weil sie dieselbe Funktion anfassen.
--
-- ── 1 · DIE REPARATUR (dringender als der Wunsch) ───────────────────────────
--
-- `20260821120000` schreibt an der entscheidenden Stelle:
--
--     **Server und Client müssen dieselbe Frage stellen.**
--
-- Genau das ist am 21.09.2026 zweimal gebrochen worden, beide Male von mir,
-- beide Male ausgeliefert:
--
--   Abschnitt 121  Der Client durchsucht seither SECHS Spalten (Titel,
--                  Beschreibung, Marke, Farbe, Groesse, Ort). Dieser Trigger
--                  kannte weiter nur drei.
--   Abschnitt 123  Der Client zerlegt den Begriff in WOERTER und verknuepft
--                  sie mit UND. Dieser Trigger suchte die ganze Zeichenfolge
--                  am Stueck.
--
-- Die Folge war kein Fehler, den jemand sieht, sondern **Stille**: Eine
-- gespeicherte Suche „wolle berlin" konnte nicht mehr ausloesen, weil kein
-- Titel diese Zeichenfolge am Stueck traegt. Und eine Suche „nike" loeste
-- nicht aus, wenn die Marke im Markenfeld steht statt im Titel — obwohl der
-- Client sie dort findet. Die Funktion versprach Bescheid und schwieg.
--
-- ⚠️ Die Lehre ist nicht „an den Trigger denken", sondern: **Wer die Frage
-- aendert, muss alle Stellen suchen, die dieselbe Frage stellen.** Ein Grep
-- nach `title` haette es gefunden; ein Grep nach `imatch` nicht, weil der
-- Trigger `LIKE` benutzt. Dieselbe Frage, zwei Sprachen.
--
-- ── 2 · DER WUNSCH ─────────────────────────────────────────────────────────
--
-- Zaur: „bau das auch ein, filter in gespeicherten suchen".
--
-- ⚠️ `20260821120000` schliesst Filter AUSDRUECKLICH aus, mit dieser
-- Begruendung:
--
--     „Filter würden das Treffer-Prädikat vervielfachen, und ein Treffer, den
--      der Nutzer nicht nachvollziehen kann, ist schlimmer als keiner."
--
-- Die Sorge war richtig und ist jetzt beantwortbar, statt weiter vermieden zu
-- werden: Der Client zeigt die gespeicherten Filter als Chips an der Zeile,
-- und der Sprung aus der Merkliste stellt sie wieder her. Ein Treffer ist
-- damit nachvollziehbar — man sieht, wonach man gefragt hat. Filter
-- VERENGEN das Praedikat ausserdem; sie erzeugen keine zusaetzlichen Treffer,
-- sondern weniger. Die Vervielfachung, vor der die Notiz warnt, betrifft die
-- Zahl der PRUEFUNGEN, nicht die Zahl der Meldungen.
--
-- ⚠️ NICHT GESPEICHERT werden „In einer Show" und die Sortierung.
--   * Die Sortierung ordnet, sie waehlt nicht aus — sie kann keinen Treffer
--     erzeugen oder verhindern.
--   * „In einer Show" waere schlimmer als nutzlos: Dieser Trigger feuert
--     ausschliesslich auf REGAL-Ware (`status = 'listed'`, `session_id IS
--     NULL`). Eine gespeicherte Suche mit diesem Haken koennte nie ausloesen.
--     Ein Filter, der eine Benachrichtigung garantiert verstummen laesst,
--     gehoert nicht in eine Benachrichtigungs-Funktion.

-- ─── 1 · Die Spalten ────────────────────────────────────────────────────────
-- Einzelne Spalten statt einem `jsonb`: Sie sind typisiert, per CHECK
-- begrenzbar und im Trigger ohne Auspacken lesbar. Die Tabelle ist winzig;
-- der Vorteil von JSONB (beliebige Schluessel) ist hier kein Vorteil, sondern
-- die Einladung, morgen einen Schluessel zu schreiben, den niemand liest.
ALTER TABLE public.berkat_saved_searches
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS min_price_cents integer,
  ADD COLUMN IF NOT EXISTS max_price_cents integer;

-- Dieselben Grenzen wie die Spalten auf `live_auctions`, gegen die hier
-- verglichen wird (`20260921200000`, `20260819100000`). Eine Suche nach einer
-- Marke, die laenger ist als jede speicherbare Marke, kann nie treffen.
ALTER TABLE public.berkat_saved_searches
  DROP CONSTRAINT IF EXISTS berkat_saved_searches_filter_lengths;
ALTER TABLE public.berkat_saved_searches
  ADD CONSTRAINT berkat_saved_searches_filter_lengths CHECK (
        (category  IS NULL OR char_length(category)  BETWEEN 1 AND 60)
    AND (condition IS NULL OR char_length(condition) BETWEEN 1 AND 40)
    AND (color     IS NULL OR char_length(color)     BETWEEN 1 AND 24)
    AND (brand     IS NULL OR char_length(brand)     BETWEEN 1 AND 40)
    AND (size      IS NULL OR char_length(size)      BETWEEN 1 AND 24)
    AND (city      IS NULL OR char_length(city)      BETWEEN 1 AND 80)
  );

-- ⚠️ Der Preis in CENT und als `integer`, wie ueberall sonst. Und eine
-- Untergrenze ueber der Obergrenze ist keine Suche, sondern ein Vertipper —
-- der Client warnt davor, die Datenbank laesst ihn gar nicht erst ankommen.
ALTER TABLE public.berkat_saved_searches
  DROP CONSTRAINT IF EXISTS berkat_saved_searches_price_range;
ALTER TABLE public.berkat_saved_searches
  ADD CONSTRAINT berkat_saved_searches_price_range CHECK (
        (min_price_cents IS NULL OR min_price_cents BETWEEN 0 AND 100000000)
    AND (max_price_cents IS NULL OR max_price_cents BETWEEN 0 AND 100000000)
    AND (min_price_cents IS NULL OR max_price_cents IS NULL
         OR min_price_cents <= max_price_cents)
  );

-- ─── 2 · Der eindeutige Index muss die Filter mitzaehlen ────────────────────
--
-- ⚠️ „Abaya" und „Abaya in Groesse 38" sind ZWEI Wuensche. Bliebe der alte
-- Index auf `(user_id, lower(btrim(query)))`, waere der zweite ein Duplikat
-- und schluege mit 23505 fehl — der Nutzer bekaeme „hast du schon", obwohl er
-- etwas anderes speichern wollte.
--
-- ⚠️ `coalesce(...)` um JEDE Spalte, und das ist kein Zierrat: In einem
-- eindeutigen Index sind NULL-Werte standardmaessig VERSCHIEDEN voneinander
-- (`NULLS DISTINCT`). Ohne die Umwandlung waeren zwei Suchen ohne jeden
-- Filter nicht mehr gleich, und die Dublettensperre — der ganze Zweck dieses
-- Index — waere still ausgeschaltet. Postgres 15 kann `NULLS NOT DISTINCT`;
-- darauf zu bauen hiesse, sich auf eine Serverversion zu verlassen, die in
-- dieser Datei nirgends geprueft wird.
DROP INDEX IF EXISTS public.berkat_saved_searches_one_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS berkat_saved_searches_one_per_user
  ON public.berkat_saved_searches (
    user_id,
    lower(btrim(query)),
    coalesce(lower(btrim(category)),  ''),
    coalesce(lower(btrim(condition)), ''),
    coalesce(lower(btrim(color)),     ''),
    coalesce(lower(btrim(brand)),     ''),
    coalesce(lower(btrim(size)),      ''),
    coalesce(lower(btrim(city)),      ''),
    coalesce(min_price_cents, -1),
    coalesce(max_price_cents, -1)
  );

COMMENT ON COLUMN public.berkat_saved_searches.category IS
  'Oberkategorie-Slug. Der Trigger rollt Unterkategorien selbst auf.';
COMMENT ON COLUMN public.berkat_saved_searches.brand IS
  'Freitext, Teiltreffer — wie im Client: "nike" trifft "Nike Air".';
COMMENT ON COLUMN public.berkat_saved_searches.color IS
  'Aus LISTING_COLORS. Ganzer Wert, kein Teiltreffer — "Rot" darf nicht "Rotbraun" holen.';

-- ─── 3 · Ein Helfer fuer die LIKE-Maskierung ────────────────────────────────
--
-- Die alte Fassung baute die dreifache `replace`-Kette einmal und wiederholte
-- sie nirgends. Jetzt braucht sie der Trigger bis zu acht Mal (einmal je Wort)
-- — ausgeschrieben waeren das acht Gelegenheiten, eine der drei Ersetzungen zu
-- vergessen. Ein `%` im Suchbegriff wuerde dann zum Platzhalter und die Suche
-- „100%" traefe alles.
CREATE OR REPLACE FUNCTION public.berkat_like_escape(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT replace(replace(replace(coalesce(p_value, ''), '\', '\\'), '%', '\%'), '_', '\_');
$fn$;

REVOKE ALL ON FUNCTION public.berkat_like_escape(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.berkat_like_escape(text) TO authenticated, service_role;

-- ─── 4 · Der Trigger stellt wieder dieselbe Frage wie der Client ────────────
CREATE OR REPLACE FUNCTION public.notify_saved_searches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  s record;
BEGIN
  -- Unveraendert: nur Regal-Angebote. Ein Show-Artikel ist nicht dauerhaft
  -- kaufbar, ein vorbereiteter gehoert noch keinem Regal an.
  IF NEW.status <> 'listed' OR NEW.session_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR s IN
    -- `DISTINCT ON (ss.user_id)`: hoechstens EINE Meldung je Mensch und
    -- Angebot (Begruendung in `20260821120000`).
    SELECT DISTINCT ON (ss.user_id) ss.id, ss.user_id, ss.query
      FROM public.berkat_saved_searches ss
     WHERE ss.user_id <> NEW.seller_id
       -- Drossel 1, je Suche.
       AND (ss.last_notified_at IS NULL
            OR ss.last_notified_at < now() - interval '20 hours')
       -- Drossel 2, je Mensch.
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
          WHERE n.recipient_id = ss.user_id
            AND n.type = 'saved_search_hit'
            AND n.app = 'berkat'
            AND n.created_at > now() - interval '20 hours'
       )

       -- ⚠️ WORTWEISE UND UEBER SECHS SPALTEN — die Reparatur.
       --
       -- Gelesen als: „es gibt KEIN Wort, das nirgends vorkommt". Das ist
       -- dasselbe wie „jedes Wort kommt irgendwo vor", nur in der Form, die
       -- SQL ohne Aggregat ausdruecken kann.
       --
       -- Die sechs Spalten und ihre Reihenfolge sind dieselben wie in
       -- `fetchBrowsePage` (`lib/useBrowseListingPages.ts`). Wer dort eine
       -- Spalte hinzufuegt, muss sie hier hinzufuegen — sonst verspricht die
       -- Suche etwas, das die Meldung nicht einloest, und der Fehler ist
       -- wieder still.
       --
       -- ⚠️ Acht Woerter, wie im Client (`QUERY_WORDS_MAX`). Der Begriff darf
       -- hier ohnehin nur 60 Zeichen lang sein; der Deckel steht trotzdem,
       -- damit beide Seiten bei einem langen Begriff dasselbe tun.
       AND NOT EXISTS (
         SELECT 1
           FROM regexp_split_to_table(lower(btrim(ss.query)), '\s+')
                WITH ORDINALITY AS w(word, pos)
          WHERE w.word <> ''
            AND w.pos <= 8
            AND lower(NEW.title)                    NOT LIKE '%' || public.berkat_like_escape(w.word) || '%' ESCAPE '\'
            AND lower(coalesce(NEW.brand, ''))      NOT LIKE '%' || public.berkat_like_escape(w.word) || '%' ESCAPE '\'
            AND lower(coalesce(NEW.color, ''))      NOT LIKE '%' || public.berkat_like_escape(w.word) || '%' ESCAPE '\'
            AND lower(coalesce(NEW.description, '')) NOT LIKE '%' || public.berkat_like_escape(w.word) || '%' ESCAPE '\'
            AND lower(coalesce(NEW.size, ''))       NOT LIKE '%' || public.berkat_like_escape(w.word) || '%' ESCAPE '\'
            AND lower(coalesce(NEW.city, ''))       NOT LIKE '%' || public.berkat_like_escape(w.word) || '%' ESCAPE '\'
       )

       -- ⚠️ DIE FILTER. Jeder einzeln abschaltbar (`IS NULL` = nicht gesetzt),
       -- und jeder mit DERSELBEN Strenge wie im Client:
       --   Kategorie  Oberkategorie rollt ihre Kinder auf (`useCategorySlugs`)
       --   Zustand    ganzer Wert
       --   Farbe      ganzer Wert, aus geschlossener Liste
       --   Marke      Teiltreffer
       --   Groesse    Teiltreffer
       --   Ort        Teiltreffer
       AND (ss.category IS NULL
            OR NEW.category = ss.category
            OR EXISTS (
              SELECT 1 FROM public.berkat_categories c
               WHERE c.slug = NEW.category AND c.parent_slug = ss.category
            ))
       AND (ss.condition IS NULL OR NEW.condition = ss.condition)
       AND (ss.color IS NULL
            OR lower(coalesce(NEW.color, '')) = lower(btrim(ss.color)))
       AND (ss.brand IS NULL
            OR lower(coalesce(NEW.brand, '')) LIKE
               '%' || public.berkat_like_escape(lower(btrim(ss.brand))) || '%' ESCAPE '\')
       AND (ss.size IS NULL
            OR lower(coalesce(NEW.size, '')) LIKE
               '%' || public.berkat_like_escape(lower(btrim(ss.size))) || '%' ESCAPE '\')
       AND (ss.city IS NULL
            OR lower(coalesce(NEW.city, '')) LIKE
               '%' || public.berkat_like_escape(lower(btrim(ss.city))) || '%' ESCAPE '\')

       -- ⚠️ Preis gegen `buy_now_cents`, weil dieser Trigger ausschliesslich
       -- auf Regal-Ware feuert — dort ist das der Preis, den der Kaeufer
       -- zahlt, und derselbe, gegen den `fetchBrowsePage` bei `listed` prueft.
       --
       -- Ist `buy_now_cents` NULL, wird der Vergleich NULL und die Zeile faellt
       -- heraus. Das ist richtig so: Ein Angebot ohne Preis kann keine
       -- Preisgrenze erfuellen, und es ist im Stoebern ohnehin unsichtbar.
       AND (ss.min_price_cents IS NULL OR NEW.buy_now_cents >= ss.min_price_cents)
       AND (ss.max_price_cents IS NULL OR NEW.buy_now_cents <= ss.max_price_cents)

       -- Frauen-Only, unveraendert und weiterhin BEIDE Haelften — Begruendung
       -- vollstaendig in `20260821120000`.
       AND (
         NEW.women_only = false
         OR EXISTS (
           SELECT 1 FROM public.profiles pr
            WHERE pr.id = ss.user_id
              AND pr.gender = 'female'
              AND pr.women_only_verified = true
         )
       )
     ORDER BY ss.user_id, ss.created_at DESC
  LOOP
    INSERT INTO public.notifications
      (recipient_id, sender_id, type, product_name, comment_text, app)
    VALUES (
      s.user_id,
      NEW.seller_id,
      'saved_search_hit',
      -- Weiterhin der SUCHBEGRIFF, nicht der Artikelname: Der Client baut
      -- daraus `/shop?q=…`.
      --
      -- ⚠️ Die gespeicherten FILTER reisen hier NICHT mit. Das Sprungziel
      -- stellt die Woerter wieder her, nicht die Verengung — der Empfaenger
      -- landet also auf einer etwas breiteren Liste, in der sein Treffer
      -- enthalten ist. Breiter, nicht falsch. Es sauber zu machen hiesse, die
      -- Nutzlast von `fn_send_push_on_notification` zu erweitern; an genau
      -- dieser Funktion sind schon zweimal spaetere Aenderungen verloren-
      -- gegangen, und sie gehoert Serlo mit. Bewusst spaeter.
      btrim(s.query),
      format('%s · passend zu „%s"', NEW.title, btrim(s.query)),
      'berkat'
    );

    -- ALLE Suchen dieses Menschen stempeln, sonst waere die Drossel wirkungslos.
    UPDATE public.berkat_saved_searches
       SET last_notified_at = now()
     WHERE user_id = s.user_id;
  END LOOP;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_saved_searches() FROM PUBLIC, anon, authenticated;

-- Der Trigger selbst haengt seit `20260821120000` und bleibt unveraendert
-- (AFTER INSERT ON live_auctions) — `CREATE OR REPLACE FUNCTION` oben
-- ersetzt nur den Rumpf.

-- ═══════════════════════════════════════════════════════════════════════════
-- GEGENPROBEN nach dem Einspielen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Die acht Spalten sind da:
--      SELECT count(*) FROM information_schema.columns
--       WHERE table_name = 'berkat_saved_searches'
--         AND column_name IN ('category','condition','color','brand','size',
--                             'city','min_price_cents','max_price_cents');
--      -- muss 8 sein
--
-- 2. Der Index zaehlt die Filter mit (muss `coalesce` enthalten):
--      SELECT indexdef FROM pg_indexes
--       WHERE indexname = 'berkat_saved_searches_one_per_user';
--
-- 3. Zwei Suchen mit gleichem Text und verschiedenem Filter gehen BEIDE rein,
--    zweimal derselbe Filter nicht (23505).
--
-- 4. Der Trigger fragt wortweise (muss `regexp_split_to_table` enthalten):
--      SELECT prosrc LIKE '%regexp_split_to_table%'
--        FROM pg_proc WHERE proname = 'notify_saved_searches';
--
-- 5. Neue Spalten sind fuer den Client lesbar — Regel 11 gegengeprueft:
--      SELECT relacl FROM pg_class
--       WHERE oid = 'public.berkat_saved_searches'::regclass;
--      -- enthaelt `authenticated=arwd/…`? Dann deckt das Tabellenrecht die
--      -- neuen Spalten ab und es braucht KEIN Spalten-GRANT.
--
-- 6. Der eigentliche Beweis, von Hand: Eine Suche „wolle berlin" speichern,
--    dann einen Artikel „Wintermantel Wolle" in Berlin einstellen (mit einem
--    ZWEITEN Konto — `ss.user_id <> NEW.seller_id`). Vor dieser Migration kam
--    nichts an.
