-- Berkat: Kategorien als feste Liste
--
-- WARUM
-- Die Startseite hat seit dem 13.08. eine Kategorie-Leiste, und sie hat noch nie
-- etwas anderes angezeigt als „shopping": `lib/useStudio.ts` schrieb beim
-- Anlegen einer Show `category: 'shopping'` fest ein. Die Leiste war also eine
-- Attrappe — ein Filter über genau einen Wert.
--
-- Ein Kategorien-Reiter (Whatnots zweiter von fünf) braucht das Gegenteil: eine
-- gepflegte, endliche Liste, in der jede Kachel irgendwohin führt. Freier Text
-- ginge auch, macht aber aus „Schmuck" und „schmuck" zwei Kategorien und aus
-- einem Tippfehler eine dauerhafte Kachel.
--
-- WELCHE
-- Die Reihenfolge stammt aus der Ausgangsanalyse (§ Kategorie-Sequenzierung
-- entlang der Emotion): Whatnot wuchs nicht entlang „großer Markt", sondern
-- entlang „es gibt eine Community und ein Preis-Ritual".
--
-- Drei Blöcke der Whatnot-Liste fehlen hier bewusst, und zwar dieselben, die
-- die Analyse unter A8 als 🔴 führt:
--   • Elektro/Batterien — WEEE- und Batteriegesetz-Registrierung je Verkäufer
--   • Lebensmittel — LMIV, Kühlkette, Rückverfolgbarkeit
--   • Alkohol — in dieser Community ohnehin ausgeschlossen
-- Sie fehlen nicht, weil sie sich nicht verkaufen würden, sondern weil Berkat
-- die Haftung dafür nicht tragen kann.
--
-- WAS DIE LISTE NICHT IST
-- Kein Aufzählungstyp (`enum`). Eine Kategorie hinzuzufügen soll eine Zeile
-- sein, kein `ALTER TYPE` mit Sperre auf der Tabelle. `active` blendet eine
-- Kategorie aus, ohne die Artikel zu verlieren, die schon darin liegen.

BEGIN;

-- ─── 1. Die Liste ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.berkat_categories (
  slug       text PRIMARY KEY CHECK (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 40),
  sort_index integer NOT NULL DEFAULT 0,
  -- Ausblenden statt löschen: Artikel behalten ihre Kategorie, die Kachel
  -- verschwindet nur aus der Auswahl.
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.berkat_categories ENABLE ROW LEVEL SECURITY;

-- Lesen darf jeder, auch ohne Konto: Der Kategorien-Reiter ist die
-- Schaufenster-Ansicht und muss vor der Anmeldung etwas zeigen.
DROP POLICY IF EXISTS berkat_categories_read ON public.berkat_categories;
CREATE POLICY berkat_categories_read ON public.berkat_categories
  FOR SELECT TO anon, authenticated USING (true);

-- Schreiben kann über den Client NIEMAND. Die Liste ist eine Redaktions-
-- entscheidung und gehört in eine Migration, genau wie die Versandsätze
-- (`berkat_shipping_rates`, 20260815180000). Es gibt bewusst keine
-- Schreib-Policy — ohne sie lehnt RLS jedes INSERT/UPDATE ab.

INSERT INTO public.berkat_categories (slug, name, sort_index) VALUES
  ('mode',      'Mode',              10),
  ('schmuck',   'Schmuck',           20),
  ('beauty',    'Beauty & Duft',     30),
  ('uhren',     'Uhren',             40),
  ('sneaker',   'Sneaker',           50),
  ('taschen',   'Taschen',           60),
  ('haus',      'Haus & Deko',       70),
  ('buecher',   'Bücher & Islamica', 80),
  ('kinder',    'Kinder',            90),
  ('sammeln',   'Sammeln',          100),
  ('sonstiges', 'Sonstiges',        110)
ON CONFLICT (slug) DO NOTHING;

-- ─── 2. Kategorie am Artikel ─────────────────────────────────────────────────
-- Bisher trug nur die SHOW eine Kategorie. Ein Dauerangebot hat keine Show
-- (20260815210000) — ohne eigene Spalte wäre es in keiner Kategorie auffindbar,
-- und genau das ist der Zweck des neuen Reiters.
--
-- ON DELETE SET NULL statt RESTRICT: Wird eine Kategorie je entfernt, soll der
-- Artikel weiter verkäuflich sein und nicht die Migration blockieren.
ALTER TABLE public.live_auctions
  ADD COLUMN IF NOT EXISTS category text
  REFERENCES public.berkat_categories(slug) ON DELETE SET NULL;

-- Falle vom 14.08.2026: Ein spaltenweises REVOKE friert die Spaltenliste ein,
-- und jede später hinzugefügte Spalte ist für die Clients unsichtbar — ein
-- Filter darauf scheitert dann mit `42501`, auch wenn die Spalte gar nicht
-- ausgelesen wird. Für `live_auctions` ist kein solches REVOKE bekannt; steht
-- ein Tabellen-Recht, ist die Zeile wirkungslos und schadet nicht.
GRANT SELECT (category) ON public.live_auctions TO anon, authenticated;

CREATE INDEX IF NOT EXISTS live_auctions_category_standing
  ON public.live_auctions (category, created_at DESC)
  WHERE session_id IS NULL AND status = 'listed';

-- ─── 3. Die Attrappe aufräumen ───────────────────────────────────────────────
-- `live_sessions.category` gehört Serlo mit; angefasst werden ausschließlich
-- Berkat-Zeilen. 'shopping' war nie eine Auswahl, sondern eine Konstante im
-- Client — als Kategorie ist sie wertlos und würde im neuen Reiter als Kachel
-- auftauchen, hinter der niemand etwas vermutet.
--
-- NULL statt 'sonstiges': Diese Shows sind alle beendete Testläufe, und eine
-- erfundene Einordnung wäre eine Behauptung. Die Startseite listet ohnehin nur
-- `status='active'`.
UPDATE public.live_sessions
   SET category = NULL
 WHERE app = 'berkat' AND category = 'shopping';

-- ─── 4. Was in welcher Kategorie los ist ─────────────────────────────────────
-- Die Zahlen unter jeder Kachel. Ein Reiter, der nur Namen zeigt, verschweigt
-- genau die Information, wegen der man ihn öffnet.
--
-- ⚠️ BEWUSST `SECURITY INVOKER`, anders als fast jede andere Berkat-Funktion.
-- Ein `SECURITY DEFINER` würde RLS umgehen und damit Frauen-Only-Shows und
-- -Angebote in den Zählern jedes Fremden sichtbar machen. Die Zahl allein
-- verrät zwar keinen Inhalt, aber „in dieser Kategorie läuft gerade eine
-- Frauen-Only-Show" ist bereits eine Auskunft über einen geschützten Raum.
-- Als INVOKER filtert dieselbe RLS wie überall sonst, ohne Zutun.
CREATE OR REPLACE FUNCTION public.get_berkat_category_counts()
RETURNS TABLE(slug text, name text, sort_index integer, live_count bigint, listing_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT c.slug,
         c.name,
         c.sort_index,
         (SELECT count(*) FROM public.live_sessions s
           WHERE s.app = 'berkat' AND s.status = 'active' AND s.category = c.slug),
         (SELECT count(*) FROM public.live_auctions a
           WHERE a.session_id IS NULL AND a.status = 'listed' AND a.category = c.slug)
    FROM public.berkat_categories c
   WHERE c.active
   ORDER BY c.sort_index, c.name;
$$;

REVOKE ALL ON FUNCTION public.get_berkat_category_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_berkat_category_counts() TO anon, authenticated;

-- ─── 5. Dauerangebot mit Kategorie anlegen ───────────────────────────────────
-- ⚠️ DROP + CREATE, NICHT CREATE OR REPLACE mit neuem Vorgabewert.
--
-- Ein defaultierter Parameter erzeugt in Postgres eine ÜBERLADUNG, keine
-- geänderte Funktion — und zwei Überladungen machen PostgREST mehrdeutig
-- (HTTP 300, bei `publish_due_scheduled_posts` gemessen; siehe HANDOFF 13).
--
-- Warum das hier trotzdem gefahrlos ist, anders als bei `schedule_live` und
-- `toggle_pin_post`: Berkat liegt in KEINEM Store. Es gibt keine ausgelieferte
-- Fassung, die die alte Signatur weiter ruft — der einzige Aufrufer ist
-- `lib/useStanding.ts` in diesem Repo, und der wird in derselben Änderung
-- mitgezogen. Sobald Berkat veröffentlicht ist, gilt diese Freiheit nicht mehr.
DROP FUNCTION IF EXISTS public.create_standing_listing(text, integer, text, boolean);

CREATE FUNCTION public.create_standing_listing(
  p_title       text,
  p_price_cents integer,
  p_image_url   text DEFAULT NULL,
  p_women_only  boolean DEFAULT false,
  p_category    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
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
  -- Eine unbekannte Kategorie wird abgelehnt statt still verworfen. Ein
  -- Artikel, der lautlos in keiner Kachel landet, ist für den Verkäufer nicht
  -- von einem Fehler zu unterscheiden.
  IF p_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.berkat_categories WHERE slug = p_category AND active
  ) THEN
    RAISE EXCEPTION 'unknown_category' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.live_auctions (
    session_id, seller_id, title, image_url,
    start_price_cents, buy_now_cents, status, women_only, category
  ) VALUES (
    NULL, v_uid, btrim(p_title), NULLIF(btrim(coalesce(p_image_url, '')), ''),
    -- Bleibt 100: Wandert der Artikel später doch in eine Show, startet er bei
    -- 1 € — das Ritual, das die Analyse „die zentrale Erfindung" nennt.
    100, p_price_cents, 'listed', coalesce(p_women_only, false), p_category
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_standing_listing(text, integer, text, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_standing_listing(text, integer, text, boolean, text)
  TO authenticated;

COMMENT ON FUNCTION public.create_standing_listing(text, integer, text, boolean, text) IS
  'Berkat: legt ein Dauerangebot an (live_auctions ohne Session, Status listed).';

COMMIT;
