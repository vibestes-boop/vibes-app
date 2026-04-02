-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Negative Signals (Skip-Tracking)
--
-- Was passiert:
--   Wenn ein User einen Post < 2 Sekunden anschaut → "Skip"
--   Das Lernprofil bewegt sich WEG vom Vibe des übersprungenen Posts.
--
-- Negative-EMA Formel (Repulsion):
--   learned = learned × (1 - alpha) + (1 - post_score) × alpha
--
-- Alpha für Skips = 0.02 (sehr konservativ)
--   → 1 Skip bewegt Profil kaum
--   → 10 Skips in einer Nische: klar messbare Bewegung
--   → EMA verhindert extremes Ausschlagen
--
-- Guard: Nur skipping wenn Post echte Vibe-Koordinaten hat
--   (score != 0.5 → Post ist klassifiziert, Skip gibt klares Signal)
--
-- Ausführen nach: advanced_signals.sql
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  record_skip — Kern-Funktion für negatives Signal                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.record_skip(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_explore   FLOAT;
  v_brain     FLOAT;
  v_alpha     FLOAT := 0.02;  -- Konservative Lernrate für negative Signale
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Post-Vibe laden
  SELECT
    COALESCE(score_explore, 0.5),
    COALESCE(score_brain,   0.5)
  INTO v_explore, v_brain
  FROM public.posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Guard: Nur wenn Post klassifiziert ist (nicht neutral 0.5/0.5)
  -- Ein neutraler Post gibt keine richtungsweisende Information
  IF ABS(v_explore - 0.5) < 0.05 AND ABS(v_brain - 0.5) < 0.05 THEN
    RETURN;
  END IF;

  -- Repulsion: UserProfil von Post-Vibe wegbewegen
  -- statt: learned = learned × (1-α) + post_score × α (Attraktion)
  -- jetzt:  learned = learned × (1-α) + (1 - post_score) × α (Repulsion)
  INSERT INTO public.user_vibe_profile (user_id, learned_explore, learned_brain, interaction_count, updated_at)
  VALUES (
    v_user_id,
    ROUND((1.0 - v_explore)::NUMERIC, 4),
    ROUND((1.0 - v_brain)::NUMERIC,   4),
    1,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    learned_explore   = ROUND((
      user_vibe_profile.learned_explore * (1.0 - v_alpha)
      + (1.0 - v_explore) * v_alpha
    )::NUMERIC, 4),
    learned_brain     = ROUND((
      user_vibe_profile.learned_brain * (1.0 - v_alpha)
      + (1.0 - v_brain) * v_alpha
    )::NUMERIC, 4),
    -- interaction_count hier NICHT erhöhen
    -- Skip ist kein positives Engagement, soll Blend-Gewicht nicht beschleunigen
    updated_at        = NOW();

END;
$$;

GRANT EXECUTE ON FUNCTION public.record_skip(UUID) TO authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFIKATION                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT
  'record_skip Funktion'       AS check_name,
  'bereit — alpha=0.02, Guard auf neutrale Posts' AS value
UNION ALL
SELECT
  'Lernprofil-Einträge',
  COUNT(*)::TEXT FROM public.user_vibe_profile;
