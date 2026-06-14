-- ── Vibe Score Auto-Calculation ───────────────────────────────────────────
-- Berechnet score_brain und score_explore automatisch aus Tags.
-- Wird als TRIGGER nach jedem INSERT/UPDATE auf posts ausgeführt.
--
-- score_brain:   Wie lehrreich/intellektuell ist der Content? (0 = Entertainment, 1 = Deep Learning)
-- score_explore: Wie neu/explorativ ist der Content? (0 = Vertraut/Safe, 1 = Unbekannt/Mutig)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_vibe_scores()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_brain   FLOAT := 0;
  v_explore FLOAT := 0;
  v_count   INT   := 0;
  v_tag     TEXT;

  -- Tag → Score Mapping (brain, explore)
  -- Jeder Tag definiert einen eindeutigen Charakter im Slider-Universum
  tag_brain   FLOAT;
  tag_explore FLOAT;
BEGIN
  -- Keine Tags → neutrale Werte (Slider reagiert kaum)
  IF NEW.tags IS NULL OR array_length(NEW.tags, 1) IS NULL THEN
    NEW.score_brain   := 0.50;
    NEW.score_explore := 0.50;
    RETURN NEW;
  END IF;

  -- Für jeden Tag den Score summieren
  FOREACH v_tag IN ARRAY NEW.tags LOOP
    -- Normalisiere: lowercase, trim
    v_tag := lower(trim(v_tag));

    CASE v_tag
      -- 🧠 Sehr lehrreich, bekannte Kategorien
      WHEN 'tech'         THEN tag_brain := 0.92; tag_explore := 0.22;
      WHEN 'science'      THEN tag_brain := 0.90; tag_explore := 0.30;
      WHEN 'architecture' THEN tag_brain := 0.72; tag_explore := 0.55;
      WHEN 'design'       THEN tag_brain := 0.68; tag_explore := 0.62;

      -- 🎨 Kreativ, explorativ
      WHEN 'art'          THEN tag_brain := 0.42; tag_explore := 0.88;
      WHEN 'photography'  THEN tag_brain := 0.38; tag_explore := 0.78;
      WHEN 'film'         THEN tag_brain := 0.45; tag_explore := 0.72;

      -- ✈️ Entdecken, Neues erleben
      WHEN 'travel'       THEN tag_brain := 0.32; tag_explore := 0.92;
      WHEN 'nature'       THEN tag_brain := 0.30; tag_explore := 0.82;
      WHEN 'adventure'    THEN tag_brain := 0.28; tag_explore := 0.90;

      -- 🎵 Unterhaltung, mittig
      WHEN 'music'        THEN tag_brain := 0.35; tag_explore := 0.65;
      WHEN 'dance'        THEN tag_brain := 0.25; tag_explore := 0.68;
      WHEN 'comedy'       THEN tag_brain := 0.18; tag_explore := 0.58;

      -- 🍜 Lifestyle, entspannt
      WHEN 'food'         THEN tag_brain := 0.22; tag_explore := 0.48;
      WHEN 'fashion'      THEN tag_brain := 0.20; tag_explore := 0.52;
      WHEN 'beauty'       THEN tag_brain := 0.18; tag_explore := 0.50;

      -- ⚡ Sport, Energie
      WHEN 'sport'        THEN tag_brain := 0.28; tag_explore := 0.42;
      WHEN 'fitness'      THEN tag_brain := 0.32; tag_explore := 0.38;
      WHEN 'gaming'       THEN tag_brain := 0.40; tag_explore := 0.55;

      -- 🌍 Gesellschaft, Reflexion
      WHEN 'mindfulness'  THEN tag_brain := 0.62; tag_explore := 0.70;
      WHEN 'motivation'   THEN tag_brain := 0.55; tag_explore := 0.60;
      WHEN 'business'     THEN tag_brain := 0.80; tag_explore := 0.35;

      -- Default: neutral
      ELSE tag_brain := 0.50; tag_explore := 0.50;
    END CASE;

    v_brain   := v_brain   + tag_brain;
    v_explore := v_explore + tag_explore;
    v_count   := v_count   + 1;
  END LOOP;

  -- Durchschnitt über alle Tags, auf 2 Dezimalstellen runden
  IF v_count > 0 THEN
    NEW.score_brain   := ROUND((v_brain   / v_count)::numeric, 2);
    NEW.score_explore := ROUND((v_explore / v_count)::numeric, 2);
  ELSE
    NEW.score_brain   := 0.50;
    NEW.score_explore := 0.50;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Trigger registrieren ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS auto_vibe_scores ON public.posts;
CREATE TRIGGER auto_vibe_scores
  BEFORE INSERT OR UPDATE OF tags
  ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vibe_scores();

-- ── Backfill: Alle bestehenden Posts aktualisieren ─────────────────────────
-- Setzt score_brain und score_explore für alle Posts die noch 0.5/0.5 haben
-- oder Tags gesetzt haben die nie berechnet wurden.
UPDATE public.posts
SET tags = tags  -- Trigger wird durch UPDATE ausgelöst
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

-- Verifizierung: Zeige Verteilung nach Update
SELECT
  tags[1] as first_tag,
  COUNT(*) as post_count,
  ROUND(AVG(score_brain)::numeric, 2) as avg_brain,
  ROUND(AVG(score_explore)::numeric, 2) as avg_explore
FROM public.posts
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
GROUP BY tags[1]
ORDER BY post_count DESC;
