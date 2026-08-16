-- Berkat: Kategorien bekommen eine zweite Ebene
--
-- WARUM
-- `20260816120000` legte elf flache Kategorien an, mit der Begründung „elf
-- wirken bei fünf Verkäufern schon leer". Das war die falsche Sorge. Am
-- 16.08.2026 im Vergleich mit Whatnots Kategorien-Reiter nachgesehen: Die haben
-- nicht dreißig Kacheln, sondern rund dreißig ELTERN mit je fünf bis zehn
-- Kindern. „Männermode" klappt auf zu Streetwear, Parfüm, Uhren, Vintage,
-- Sportbekleidung. Erst dadurch skaliert die Seite über eine Handvoll hinaus,
-- ohne zur Wand zu werden.
--
-- Eine flache Liste zwingt in eine Entscheidung, die es nicht gibt: entweder
-- wenige grobe Kacheln (dann findet niemand etwas) oder viele feine (dann
-- scrollt man an achtzig Kacheln vorbei). Zwei Ebenen lösen beides.
--
-- ⚠️ WAS BEWUSST NICHT ÜBERNOMMEN WIRD: WHATNOTS LISTE
-- Deren Kategorien sind ein amerikanischer Sammlermarkt — Sportkarten, Trading
-- Card Games, Comics, NASCAR-Pins, Nachlassverkäufe, Münzen. Für die
-- tschetschenische Diaspora im deutschsprachigen Raum ist das fast durchweg
-- Rauschen. Der Baum hier kommt aus dem, was diese Community tatsächlich
-- handelt: Abaya und Hijab, Oud und Bakhoor, Gold, Gebetsteppiche,
-- Kinderkleidung, Haustextilien.
--
-- Weiterhin ausgeschlossen, unverändert aus `20260816120000` und Analyse A8:
-- Elektro/Batterien (WEEE- und Batteriegesetz-Registrierung je Verkäufer),
-- Lebensmittel (LMIV, Kühlkette), Alkohol. Nicht, weil sie sich nicht
-- verkaufen würden, sondern weil Berkat die Haftung nicht tragen kann.
--
-- GENAU ZWEI EBENEN
-- Der Zähl-Aufruf unten rollt Kinder auf ihr Elternteil auf — und zwar genau
-- eine Stufe. Eine dritte Ebene wäre in den Zahlen unsichtbar, ohne dass es
-- jemand merkt. Deshalb verbietet der Trigger sie, statt sich auf Disziplin zu
-- verlassen.

BEGIN;

-- ─── 1. Die Kante zum Elternteil ─────────────────────────────────────────────
ALTER TABLE public.berkat_categories
  ADD COLUMN IF NOT EXISTS parent_slug text
  REFERENCES public.berkat_categories(slug) ON DELETE SET NULL;

ALTER TABLE public.berkat_categories DROP CONSTRAINT IF EXISTS berkat_categories_no_self_parent;
ALTER TABLE public.berkat_categories ADD CONSTRAINT berkat_categories_no_self_parent
  CHECK (parent_slug IS NULL OR parent_slug <> slug);

CREATE INDEX IF NOT EXISTS berkat_categories_by_parent
  ON public.berkat_categories (parent_slug, sort_index)
  WHERE parent_slug IS NOT NULL;

-- Der Wächter gegen eine dritte Ebene. Ohne ihn würde ein Enkel in keiner
-- Zahl auftauchen und in keiner Kachel — lautlos, wie so vieles hier.
CREATE OR REPLACE FUNCTION public.berkat_categories_two_levels()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Mein Elternteil darf selbst kein Kind sein.
  IF NEW.parent_slug IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.berkat_categories
     WHERE slug = NEW.parent_slug AND parent_slug IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'category_depth_exceeded: % ist bereits eine Unterkategorie', NEW.parent_slug
      USING ERRCODE = '22023';
  END IF;

  -- Und ich darf nicht zum Kind werden, wenn ich selbst Kinder habe.
  IF NEW.parent_slug IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.berkat_categories WHERE parent_slug = NEW.slug
  ) THEN
    RAISE EXCEPTION 'category_depth_exceeded: % hat selbst Unterkategorien', NEW.slug
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_berkat_categories_two_levels ON public.berkat_categories;
CREATE TRIGGER trg_berkat_categories_two_levels
  BEFORE INSERT OR UPDATE OF parent_slug, slug ON public.berkat_categories
  FOR EACH ROW EXECUTE FUNCTION public.berkat_categories_two_levels();

REVOKE ALL ON FUNCTION public.berkat_categories_two_levels() FROM PUBLIC, anon, authenticated;

-- ─── 2. Die elf bestehenden einordnen ────────────────────────────────────────
-- Alle elf Slugs aus `20260816120000` bleiben erhalten — nichts wird gelöscht,
-- damit ein bereits eingestellter Artikel seine Kategorie behält.
--
-- Zwei ändern ihre Rolle:
--   • `sneaker` war eigenständig und wird Kind von `schuhe` (neu). Sneaker
--     sind eine Schuhsorte, keine Warengruppe neben Schmuck.
--   • `buecher` hieß „Bücher & Islamica". Islamica bekommt ein eigenes
--     Elternteil — in dieser Community ist das kein Unterpunkt von Büchern,
--     sondern eine Warengruppe mit Gebetsteppichen, Kleidung und Zubehör.
UPDATE public.berkat_categories SET name = 'Mode',                sort_index =  10 WHERE slug = 'mode';
UPDATE public.berkat_categories SET name = 'Schmuck',             sort_index =  40 WHERE slug = 'schmuck';
UPDATE public.berkat_categories SET name = 'Beauty & Duft',       sort_index =  50 WHERE slug = 'beauty';
UPDATE public.berkat_categories SET name = 'Uhren',               sort_index =  60 WHERE slug = 'uhren';
UPDATE public.berkat_categories SET name = 'Taschen & Accessoires', sort_index = 30 WHERE slug = 'taschen';
UPDATE public.berkat_categories SET name = 'Haus & Deko',         sort_index =  70 WHERE slug = 'haus';
UPDATE public.berkat_categories SET name = 'Bücher & Medien',     sort_index =  90 WHERE slug = 'buecher';
UPDATE public.berkat_categories SET name = 'Kinder',              sort_index = 100 WHERE slug = 'kinder';
UPDATE public.berkat_categories SET name = 'Sammeln',             sort_index = 110 WHERE slug = 'sammeln';
UPDATE public.berkat_categories SET name = 'Sonstiges',           sort_index = 999 WHERE slug = 'sonstiges';

-- ─── 3. Die beiden neuen Eltern ──────────────────────────────────────────────
INSERT INTO public.berkat_categories (slug, name, sort_index) VALUES
  ('schuhe',   'Schuhe',   20),
  ('islamica', 'Islamica', 80)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_index = EXCLUDED.sort_index;

-- ─── 4. Die Kinder ───────────────────────────────────────────────────────────
-- `sort_index` ist innerhalb eines Elternteils gemeint und beginnt jeweils neu.
-- Die Reihenfolge ist nicht alphabetisch, sondern nach erwarteter Menge: Was
-- am häufigsten gehandelt wird, steht oben.
INSERT INTO public.berkat_categories (slug, name, parent_slug, sort_index) VALUES
  -- Mode ─────────────────────────────────────────────────────────────────────
  ('abaya',            'Abaya & Jilbab',      'mode',      10),
  ('hijab',            'Hijab & Tücher',      'mode',      20),
  ('kleider',          'Kleider',             'mode',      30),
  ('oberteile',        'Oberteile',           'mode',      40),
  ('hosen-roecke',     'Hosen & Röcke',       'mode',      50),
  ('abendmode',        'Abendmode',           'mode',      60),
  ('herrenmode',       'Herrenmode',          'mode',      70),
  ('jacken',           'Jacken & Mäntel',     'mode',      80),
  ('traditionell',     'Traditionelle Mode',  'mode',      90),
  ('grosse-groessen',  'Große Größen',        'mode',     100),
  ('vintage-mode',     'Vintage',             'mode',     110),

  -- Schuhe ───────────────────────────────────────────────────────────────────
  ('damenschuhe',      'Damenschuhe',         'schuhe',    20),
  ('herrenschuhe',     'Herrenschuhe',        'schuhe',    30),
  ('kinderschuhe',     'Kinderschuhe',        'schuhe',    40),
  ('hausschuhe',       'Hausschuhe',          'schuhe',    50),

  -- Taschen & Accessoires ────────────────────────────────────────────────────
  ('handtaschen',      'Handtaschen',         'taschen',   10),
  ('geldboersen',      'Geldbörsen',          'taschen',   20),
  ('guertel',          'Gürtel',              'taschen',   30),
  ('sonnenbrillen',    'Sonnenbrillen',       'taschen',   40),
  ('reisegepaeck',     'Reisegepäck',         'taschen',   50),

  -- Schmuck ──────────────────────────────────────────────────────────────────
  ('gold',             'Gold',                'schmuck',   10),
  ('silber',           'Silber',              'schmuck',   20),
  ('ringe',            'Ringe',               'schmuck',   30),
  ('ketten',           'Ketten',              'schmuck',   40),
  ('ohrringe',         'Ohrringe',            'schmuck',   50),
  ('armbaender',       'Armbänder',           'schmuck',   60),
  ('brautschmuck',     'Brautschmuck',        'schmuck',   70),

  -- Uhren ────────────────────────────────────────────────────────────────────
  ('damenuhren',       'Damenuhren',          'uhren',     10),
  ('herrenuhren',      'Herrenuhren',         'uhren',     20),
  ('vintage-uhren',    'Vintage-Uhren',       'uhren',     30),

  -- Beauty & Duft ────────────────────────────────────────────────────────────
  ('parfuem-damen',    'Parfüm Damen',        'beauty',    10),
  ('parfuem-herren',   'Parfüm Herren',       'beauty',    20),
  ('oud',              'Oud & Bakhoor',       'beauty',    30),
  ('pflege',           'Pflege',              'beauty',    40),
  ('makeup',           'Make-up',             'beauty',    50),
  ('haarpflege',       'Haarpflege',          'beauty',    60),
  ('naturkosmetik',    'Naturkosmetik',       'beauty',    70),

  -- Haus & Deko ──────────────────────────────────────────────────────────────
  ('teppiche',         'Teppiche',            'haus',      10),
  ('heimtextilien',    'Heimtextilien',       'haus',      20),
  ('geschirr',         'Geschirr & Gläser',   'haus',      30),
  ('deko',             'Deko',                'haus',      40),
  ('kueche',           'Küche',               'haus',      50),
  ('duefte-haus',      'Raumdüfte',           'haus',      60),

  -- Islamica ─────────────────────────────────────────────────────────────────
  ('gebetsteppiche',   'Gebetsteppiche',      'islamica',  10),
  ('gebetskleidung',   'Gebetskleidung',      'islamica',  20),
  ('quran',            'Quran & Bücher',      'islamica',  30),
  ('tasbih',           'Tasbih & Zubehör',    'islamica',  40),
  ('kalligrafie',      'Kalligrafie',         'islamica',  50),
  ('geschenke-islam',  'Geschenkartikel',     'islamica',  60),

  -- Bücher & Medien ──────────────────────────────────────────────────────────
  ('buecher-deutsch',  'Bücher',              'buecher',   10),
  ('lernen',           'Lernen & Sprache',    'buecher',   20),
  ('kinderbuecher',    'Kinderbücher',        'buecher',   30),

  -- Kinder ───────────────────────────────────────────────────────────────────
  ('baby',             'Baby',                'kinder',    10),
  ('maedchen',         'Mädchen',             'kinder',    20),
  ('jungen',           'Jungen',              'kinder',    30),
  ('spielzeug',        'Spielzeug',           'kinder',    40),
  ('kinderzimmer',     'Kinderzimmer',        'kinder',    50),

  -- Sammeln ──────────────────────────────────────────────────────────────────
  ('muenzen',          'Münzen',              'sammeln',   10),
  ('antiquitaeten',    'Antiquitäten',        'sammeln',   20),
  ('kunst',            'Kunst',               'sammeln',   30)
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      parent_slug = EXCLUDED.parent_slug,
      sort_index  = EXCLUDED.sort_index;

-- `sneaker` existiert schon aus 20260816120000 und wandert nur unter `schuhe`.
-- Getrennt vom Block oben, weil es ein UPDATE ist und kein Einfügen — und weil
-- die Umhängung erklärt gehört.
UPDATE public.berkat_categories
   SET name = 'Sneaker', parent_slug = 'schuhe', sort_index = 10
 WHERE slug = 'sneaker';

-- ─── 5. Zählen mit Aufrollen ─────────────────────────────────────────────────
-- DROP + CREATE statt REPLACE: Der Rückgabetyp ändert sich (zwei neue Spalten),
-- und Postgres lässt CREATE OR REPLACE dann nicht zu.
--
-- ZWEI ÄNDERUNGEN AM INHALT:
--
-- 1. **Zuschauer statt Shows.** „1901 Zuschauer" liest sich als *hier ist was
--    los*; „2 Shows" liest sich als leer. Whatnot zeigt auf jeder Kachel genau
--    diese Zahl, und das ist richtig — die Kachel soll Betrieb anzeigen, nicht
--    Bestand.
--
-- 2. **Aufrollen auf das Elternteil.** Eine Eltern-Kachel zählt sich selbst UND
--    ihre Kinder. Ohne das stünde auf „Mode" eine Null, während unter „Abaya"
--    drei Shows laufen — und niemand würde die Kachel je antippen.
--
-- Weiterhin `SECURITY INVOKER`: Als DEFINER würde die Funktion RLS umgehen und
-- Frauen-Only-Shows in den Zählern jedes Fremden mitzählen. Schon die Zahl wäre
-- eine Auskunft über einen geschützten Raum.
DROP FUNCTION IF EXISTS public.get_berkat_category_counts();

CREATE FUNCTION public.get_berkat_category_counts()
RETURNS TABLE(
  slug          text,
  name          text,
  parent_slug   text,
  sort_index    integer,
  live_count    bigint,
  viewer_count  bigint,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH scope AS (
    -- Je Kategorie die Menge der Slugs, die auf sie einzahlen: sie selbst plus
    -- ihre direkten Kinder. Bei einem Kind bleibt es bei ihm selbst.
    SELECT c.slug,
           c.name,
           c.parent_slug,
           c.sort_index,
           ARRAY(
             SELECT k.slug FROM public.berkat_categories k WHERE k.parent_slug = c.slug
             UNION ALL SELECT c.slug
           ) AS slugs
      FROM public.berkat_categories c
     WHERE c.active
  )
  SELECT s.slug,
         s.name,
         s.parent_slug,
         s.sort_index,
         (SELECT count(*) FROM public.live_sessions v
           WHERE v.app = 'berkat' AND v.status = 'active' AND v.category = ANY(s.slugs)),
         (SELECT COALESCE(SUM(GREATEST(v.viewer_count, 0)), 0) FROM public.live_sessions v
           WHERE v.app = 'berkat' AND v.status = 'active' AND v.category = ANY(s.slugs)),
         (SELECT count(*) FROM public.live_auctions a
           WHERE a.session_id IS NULL AND a.status = 'listed' AND a.category = ANY(s.slugs))
    FROM scope s
   ORDER BY s.sort_index, s.name;
$$;

REVOKE ALL ON FUNCTION public.get_berkat_category_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_berkat_category_counts() TO anon, authenticated;

COMMENT ON FUNCTION public.get_berkat_category_counts() IS
  'Berkat: Kategorien mit Zählern. Eltern rollen ihre Kinder auf, genau eine Ebene tief.';

COMMIT;

-- ─── Was bewusst NICHT drin ist ──────────────────────────────────────────────
-- • **Keine Bilder je Kategorie.** Whatnot hat je Kachel ein gerendertes
--   3D-Objekt — bei diesem Baum wären das rund siebzig. Ohne Illustrator sind
--   Platzhalter schlimmer als nichts; die App nimmt monochrome Icons, was
--   ohnehin ihrer Icon-Sprache entspricht. Eine Spalte `image_url` lässt sich
--   jederzeit nachrüsten, wenn die Bilder je existieren.
-- • **Kein „Heute im Trend".** Whatnots Streifen darüber zeigt Marken und
--   Themen mit Zuschauerzahlen (Needoh, Coach, Halloween). Das braucht
--   Trend-Daten, die es bei null Verkäufern nicht gibt — der Streifen wäre leer
--   und damit schlechter als kein Streifen.
-- • **Keine Elektronik, keine Lebensmittel, kein Alkohol.** Unverändert, siehe
--   Kopf dieser Datei und Analyse A8.
