-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Auto-Score Trigger für Posts
-- Datum: 2026-04-14
--
-- Problem: score_explore und score_brain werden beim Post-Insert nie gesetzt.
-- Alle Posts haben 0.5 default → Slider hat keinen Effekt.
--
-- Lösung: DB-Trigger der beim INSERT automatisch aus den Tags ableitet:
--   score_explore → 1.0 = sehr visual/viral (Reels, Fashion, Art, Food, Travel)
--                   0.0 = ruhig/nischig (Coding, Architecture, Fitness)
--   score_brain   → 1.0 = informativ/tief (Tech, AI, Coding, Architecture)
--                   0.0 = emotional/entertainment (Music, Meme, Fashion)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_score_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tags       TEXT[];
  v_explore    FLOAT := 0.5;   -- Default: mittig
  v_brain      FLOAT := 0.5;   -- Default: mittig
  v_tag        TEXT;
  v_e_sum      FLOAT := 0.0;
  v_b_sum      FLOAT := 0.0;
  v_count      INT   := 0;
BEGIN
  -- Tags normalisiert
  v_tags := COALESCE(NEW.tags, '{}');

  -- Score nur berechnen wenn Tags vorhanden
  IF array_length(v_tags, 1) IS NULL OR array_length(v_tags, 1) = 0 THEN
    NEW.score_explore := 0.5;
    NEW.score_brain   := 0.5;
    RETURN NEW;
  END IF;

  -- Tag-Mapping: (explore_score, brain_score)
  -- explore: 1.0 = viral/visual, 0.0 = nischig/ruhig
  -- brain:   1.0 = informativ, 0.0 = entertainment
  FOREACH v_tag IN ARRAY v_tags LOOP
    v_tag := LOWER(v_tag);
    CASE v_tag
      WHEN 'vibes'        THEN v_e_sum := v_e_sum + 0.8; v_b_sum := v_b_sum + 0.2;
      WHEN 'music'        THEN v_e_sum := v_e_sum + 0.85; v_b_sum := v_b_sum + 0.25;
      WHEN 'fashion'      THEN v_e_sum := v_e_sum + 0.95; v_b_sum := v_b_sum + 0.1;
      WHEN 'art'          THEN v_e_sum := v_e_sum + 0.7;  v_b_sum := v_b_sum + 0.45;
      WHEN 'food'         THEN v_e_sum := v_e_sum + 0.8;  v_b_sum := v_b_sum + 0.3;
      WHEN 'travel'       THEN v_e_sum := v_e_sum + 0.9;  v_b_sum := v_b_sum + 0.35;
      WHEN 'life'         THEN v_e_sum := v_e_sum + 0.7;  v_b_sum := v_b_sum + 0.3;
      WHEN 'meme'         THEN v_e_sum := v_e_sum + 0.9;  v_b_sum := v_b_sum + 0.1;
      WHEN 'fitness'      THEN v_e_sum := v_e_sum + 0.65; v_b_sum := v_b_sum + 0.55;
      WHEN 'photography'  THEN v_e_sum := v_e_sum + 0.85; v_b_sum := v_b_sum + 0.4;
      WHEN 'coding'       THEN v_e_sum := v_e_sum + 0.3;  v_b_sum := v_b_sum + 0.95;
      WHEN 'tech'         THEN v_e_sum := v_e_sum + 0.4;  v_b_sum := v_b_sum + 0.9;
      WHEN 'ai'           THEN v_e_sum := v_e_sum + 0.45; v_b_sum := v_b_sum + 0.95;
      WHEN 'design'       THEN v_e_sum := v_e_sum + 0.65; v_b_sum := v_b_sum + 0.7;
      WHEN 'architecture' THEN v_e_sum := v_e_sum + 0.55; v_b_sum := v_b_sum + 0.8;
      WHEN 'gaming'       THEN v_e_sum := v_e_sum + 0.7;  v_b_sum := v_b_sum + 0.4;
      WHEN 'lifestyle'    THEN v_e_sum := v_e_sum + 0.75; v_b_sum := v_b_sum + 0.3;
      WHEN 'nature'       THEN v_e_sum := v_e_sum + 0.75; v_b_sum := v_b_sum + 0.4;
      ELSE
        -- Unbekannte Tags: mittig
        v_e_sum := v_e_sum + 0.5;
        v_b_sum := v_b_sum + 0.5;
    END CASE;
    v_count := v_count + 1;
  END LOOP;

  -- Durchschnitt der Tags
  IF v_count > 0 THEN
    v_explore := v_e_sum / v_count;
    v_brain   := v_b_sum / v_count;
  END IF;

  -- ONLY set if not already set by caller
  NEW.score_explore := COALESCE(NEW.score_explore, v_explore);
  NEW.score_brain   := COALESCE(NEW.score_brain,   v_brain);

  RETURN NEW;
END;
$$;

-- Trigger bei INSERT und UPDATE (falls Tags geändert werden)
DROP TRIGGER IF EXISTS trg_auto_score_post ON public.posts;
CREATE TRIGGER trg_auto_score_post
  BEFORE INSERT OR UPDATE OF tags ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_score_post();

-- Bestehende Posts ohne Scores nachfüllen (einmalig)
UPDATE public.posts
SET
  score_explore = CASE
    WHEN tags IS NULL OR array_length(tags, 1) = 0 THEN 0.5
    -- Fashion/Meme/Travel/Vibes = explore
    WHEN tags && ARRAY['fashion','meme','travel','reels','vibes','food'] THEN 0.82
    -- Tech/Coding/AI = brain
    WHEN tags && ARRAY['tech','coding','ai','architecture','design'] THEN 0.38
    ELSE 0.5
  END,
  score_brain = CASE
    WHEN tags IS NULL OR array_length(tags, 1) = 0 THEN 0.5
    WHEN tags && ARRAY['tech','coding','ai','architecture','design'] THEN 0.85
    WHEN tags && ARRAY['fashion','meme','vibes'] THEN 0.18
    ELSE 0.5
  END
WHERE score_explore = 0.5 AND score_brain = 0.5;

DO $$
BEGIN
  RAISE NOTICE '✅ auto_score_post Trigger + Backfill abgeschlossen';
END $$;
