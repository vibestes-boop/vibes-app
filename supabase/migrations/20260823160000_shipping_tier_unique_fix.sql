-- Die Versandstufen wurden lautlos verschluckt — von einer Eindeutigkeit,
-- die es seit dem 15.08. gibt
-- ============================================================================
--
-- ⚠️ FEHLER IN `20260823140000`, DERSELBEN STUNDE. Diese Datei ist der Fix
-- nach vorn; die eingespielte Migration wird NICHT nachträglich geändert.
--
-- Was passiert ist: `20260823140000` legt drei neue DE-Sätze an (Stufe 1, 2, 3)
-- und schliesst mit
--
--     ON CONFLICT DO NOTHING;
--
-- Die drei Zeilen sind danach **nicht in der Tabelle**. Gemessen direkt nach
-- dem Einspielen: nur die drei alten Zeilen, alle auf Stufe 4.
--
-- Der Grund liegt in `20260815180000`:
--
--     CREATE UNIQUE INDEX idx_berkat_shipping_platform
--       ON berkat_shipping_rates (country) WHERE seller_id IS NULL;
--     CREATE UNIQUE INDEX idx_berkat_shipping_seller
--       ON berkat_shipping_rates (seller_id, country) WHERE seller_id IS NOT NULL;
--
-- „Je Zone genau ein Plattform-Satz." Das war richtig, solange es eine
-- Pauschale je Land gab — und es ist genau die Annahme, die Stufen aufheben.
-- `20260823140000` legte den neuen Index `berkat_shipping_rates_one_per_tier`
-- DANEBEN, statt die alten abzulösen. Drei Eindeutigkeiten auf derselben
-- Tabelle, und zwei davon sagen „nur eine Zeile je Land".
--
-- ── ⚠️ DIE EIGENTLICHE LEHRE: `ON CONFLICT DO NOTHING` OHNE ZIEL SCHWEIGT ───
--
-- Im Kopf von `20260823140000` steht als Begründung: „`DO NOTHING` ohne Ziel
-- greift bei jedem Konflikt und macht die Migration wiederholbar — darum geht
-- es hier."
--
-- Beides stimmt, und zusammen ergibt es eine Falle: **Ohne Ziel fängt es auch
-- den Konflikt ab, den man gar nicht erwartet hat** — und sagt nicht, welcher
-- es war. Die Migration meldete Erfolg, `supabase migration list` zeigte grün,
-- und die Zeilen fehlten. Mit `ON CONFLICT (…) DO NOTHING` und benannten
-- Spalten wäre der Lauf an der fremden Eindeutigkeit **gescheitert** — also
-- sichtbar geworden.
--
-- > Ein `DO NOTHING` ohne Ziel ist kein Idempotenz-Werkzeug, sondern ein
-- > Schalldämpfer. Wer es benutzt, zählt danach die Zeilen nach.
--
-- Dieselbe Familie wie „Eine Funktion, die sauber anlegt, ist nicht geprüft"
-- (Übergabe 42): Der Widerspruch entsteht erst beim ersten INSERT, und hier
-- war der erste INSERT schon in der Migration selbst.

-- ── 1 · Die alten Eindeutigkeiten ablösen ───────────────────────────────────
--
-- Ersetzt, nicht ergänzt. Die Absicht bleibt („nicht zweimal derselbe Satz"),
-- nur trägt sie jetzt die Stufe mit. Ohne das Löschen bliebe die Tabelle bei
-- einer Zeile je Land — und `20260823140000` wäre ein Feature, das die
-- Datenbank nicht zulässt.

DROP INDEX IF EXISTS public.idx_berkat_shipping_platform;
DROP INDEX IF EXISTS public.idx_berkat_shipping_seller;

-- Zwei Teil-Indizes statt eines Ausdruck-Index über `COALESCE`: Sie lesen sich
-- als das, was sie sind („je Zone und Stufe ein Plattform-Satz, je Verkäufer
-- ebenso"), und `ON CONFLICT` kann sie mit ihren echten Spalten benennen.
CREATE UNIQUE INDEX IF NOT EXISTS idx_berkat_shipping_platform_tier
  ON public.berkat_shipping_rates (country, tier) WHERE seller_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_berkat_shipping_seller_tier
  ON public.berkat_shipping_rates (seller_id, country, tier) WHERE seller_id IS NOT NULL;

-- Der Ausdruck-Index aus `20260823140000` wird damit überflüssig — er sagt
-- dasselbe, nur unleserlicher, und er war der Grund, warum dort kein
-- ON-CONFLICT-Ziel benannt werden konnte.
DROP INDEX IF EXISTS public.berkat_shipping_rates_one_per_tier;

-- ── 2 · Die Sätze, diesmal MIT Ziel ─────────────────────────────────────────
--
-- ⚠️ `ON CONFLICT (country, tier) WHERE seller_id IS NULL` benennt genau den
-- Index von oben. Trifft ein ANDERER Konflikt, scheitert der Lauf — und das
-- ist hier das gewünschte Verhalten: Er soll laut sein, nicht wiederholbar.

INSERT INTO public.berkat_shipping_rates (seller_id, country, tier, label, cents, sort_index)
VALUES
  (NULL, 'DE', 1, 'Brief · Kopftuch, Schmuck, Kleinteil',      119, 1),
  (NULL, 'DE', 2, 'Grossbrief · Tuch, Shirt, dünne Kleidung',  225, 1),
  (NULL, 'DE', 3, 'Paket · Schuhe, Buch, Parfüm',              410, 1)
ON CONFLICT (country, tier) WHERE seller_id IS NULL DO NOTHING;

-- ── 3 · Und diesmal wird nachgezählt ────────────────────────────────────────
--
-- Der Teil, der beim ersten Mal fehlte. Ein Lauf, der schweigend nichts tut,
-- ist schlimmer als einer, der scheitert.

DO $$
DECLARE
  v_de int;
BEGIN
  SELECT count(*) INTO v_de
    FROM public.berkat_shipping_rates
   WHERE seller_id IS NULL AND country = 'DE';

  IF v_de <> 4 THEN
    RAISE EXCEPTION
      'Versandstufen unvollstaendig: % DE-Saetze statt 4. Die Eindeutigkeiten pruefen.', v_de;
  END IF;

  RAISE NOTICE '✅ Versandstufen: 4 DE-Saetze (Brief, Grossbrief, Paket, Paket gross)';
END $$;

-- ── Gegenproben ─────────────────────────────────────────────────────────────
--
-- 1) Vier DE-Stufen, AT und CH je eine. Erwartet: 4 / 1 / 1.
--
--      SELECT country, count(*) FROM public.berkat_shipping_rates
--       WHERE seller_id IS NULL GROUP BY country ORDER BY country;
--
-- 2) Und die Eindeutigkeit greift weiter — ein zweiter Satz derselben Stufe
--    muss scheitern (`23505`):
--
--      INSERT INTO public.berkat_shipping_rates (seller_id, country, tier, label, cents)
--      VALUES (NULL, 'DE', 1, 'Doppelt', 999);
--
-- 3) ⚠️ Die Probe, die beim ersten Mal gefehlt hat: **nach dem Einspielen die
--    Zeilen zählen.** Der Block oben macht das jetzt selbst und bricht ab —
--    aber wer eine ähnliche Migration schreibt, baut ihn mit ein.
