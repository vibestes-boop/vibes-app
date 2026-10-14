-- ─────────────────────────────────────────────────────────────────────────────
-- Berkat: „Handyhüllen & Displayschutz" unter Taschen & Accessoires
--
-- WOHER DAS KOMMT (21.09.2026)
-- Zaur fragte, warum Kleinanzeigen sechzehn Oberkategorien hat und Berkat
-- zwölf. Ich habe daraufhin **Elektronik** vorgeschlagen — und lag falsch.
--
-- ⚠️ ELEKTRONIK IST BEWUSST AUSGESCHLOSSEN, NICHT VERGESSEN.
-- `WHATNOT-ANALYSE.md` führt das als Zeile **A8** mit der höchsten Risikostufe:
--
--     „Elektro (WEEE/EAR), Batterien, Lebensmittel, Alkohol — 🔴
--      Kategorien ausschließen. Whatnot macht Elektronik und Essen —
--      du kannst das nicht tragen."
--
-- Und der Kopf von `20260816150000` sagt dasselbe noch einmal: „Nicht, weil sie
-- sich nicht verkaufen würden, sondern weil Berkat die Haftung nicht tragen
-- kann."
--
-- Der Grund ist keine Geschmacksfrage: Seit 2022 muss ein MARKTPLATZBETREIBER
-- prüfen, ob ein Verkäufer von Elektrogeräten bei der Stiftung EAR registriert
-- ist, bevor das Angebot online geht (ElektroG). Für Batterien gilt dasselbe
-- nach dem BattG — und ein Handy hat beides. Die Pflicht trifft den BETREIBER,
-- nicht den Verkäufer.
--
-- ⚠️ WARUM DIESE KATEGORIE TROTZDEM GEHT
-- Zaurs eigenes Beispiel aus der Kleinanzeigen-App war eine
-- **Displayschutzfolie**. Die enthält weder Elektronik noch eine Batterie und
-- fällt unter keine dieser Pflichten. Dasselbe gilt für Hüllen, Taschen und
-- Halterungen ohne Strom.
--
-- ⚠️ DER NAME MACHT DIE ARBEIT, NICHT EIN CHECK.
-- Die Kategorie heißt ausdrücklich NICHT „Handy & Zubehör" und auch nicht
-- „Handyhüllen & Zubehör". „Zubehör" ist ein offenes Wort — darunter legt
-- jemand ein Ladekabel, ein Netzteil oder eine Powerbank, und genau die drei
-- sind Elektrogeräte bzw. tragen eine Batterie. „Displayschutz" benennt
-- stattdessen die zweite erlaubte Sache und lädt zu nichts Weiterem ein.
--
-- Das ist kein technischer Riegel, und es soll auch keiner sein: SQL kann
-- „hat keine Batterie" nicht prüfen. Was eine Spalte nicht kann, muss die
-- Beschriftung tun — und wenn doch jemand ein Netzteil einstellt, greift der
-- Melde-Weg auf der Artikelseite.
--
-- ⚠️ KEIN BILD NÖTIG. `theme/categoryArt.ts` hält Motive nur für die zwölf
-- OBERkategorien; Unterkategorien sind reine Pillen. Diese Migration braucht
-- deshalb keine App-Änderung — der Baum kommt aus der Datenbank.
-- ─────────────────────────────────────────────────────────────────────────────

-- `sort_index` ist innerhalb des Elternteils gemeint. Die bestehenden Kinder
-- von `taschen` liegen auf 10…50 (Handtaschen, Geldbörsen, Gürtel,
-- Sonnenbrillen, Reisegepäck) — dieses kommt als sechstes dahinter.
--
-- ⚠️ Das Elternteil ist `taschen` und NICHT `sonstiges`. Eine Hülle ist ein
-- Accessoire, und dort sucht man sie auch: neben Geldbörse und Sonnenbrille.
-- In „Sonstiges" wäre sie unauffindbar — dieselbe Überlegung, aus der `schuhe`
-- am 16.08. ein eigenes Elternteil bekam, statt unter „Mode" zu verschwinden.
INSERT INTO public.berkat_categories (slug, name, parent_slug, sort_index) VALUES
  ('handy-huellen', 'Handyhüllen & Displayschutz', 'taschen', 60)
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      parent_slug = EXCLUDED.parent_slug,
      sort_index  = EXCLUDED.sort_index,
      active      = true;

COMMENT ON TABLE public.berkat_categories IS
  'Berkat-Kategorienbaum, genau zwei Ebenen. Ausgeschlossen bleiben Elektro, '
  'Batterien, Lebensmittel und Alkohol (Analyse A8) — der Marktplatzbetreiber '
  'traegt dort Pruefpflichten nach ElektroG und BattG. Stromlose Zubehoerteile '
  '(Huellen, Displayschutz) sind davon nicht beruehrt, siehe 20260921210000.';
