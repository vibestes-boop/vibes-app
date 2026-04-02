-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Advanced Signals v1
--
-- Implementiert 4 Insights aus dem Video-Analyse:
--   Insight 2: Like-Count als Feed-Signal (max +0.05)
--   Insight 3: Bookmark-Count als Feed-Signal (max +0.05)
--   Insight 4: Creator-Consistency-Score (max +0.03)
--   Insight 5: Caption-Keyword-Scoring (Posts ohne Tags korrekt einordnen)
--
-- Ausführungsreihenfolge:
--   1. algorithm_production.sql
--   2. user_learning_profile.sql
--   3. comment_signal.sql
--   4. DIESE DATEI (advanced_signals.sql)
--
-- Finale Scoring-Formel nach dieser Datei (max 1.28):
--   Dwell        × 0.45   (dominantes Signal)
--   Explore      × 0.25   (mit Lernprofil)
--   Brain        × 0.25   (mit Lernprofil)
--   Freshness    ≤ 0.10   (48h Cold-Start-Boost)
--   Comments     ≤ 0.10   (log, 50 Comments = max)
--   Likes        ≤ 0.05   (log, 100 Likes = max)
--   Bookmarks    ≤ 0.05   (log, 20 Bookmarks = max)
--   Consistency  ≤ 0.03   (Creator bleibt in seiner Nische)
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  INSIGHT 2 — Like Count als Feed-Signal                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Likes sind ein leichtes Signal — schwächer als Comments (Menschen liken
-- eher impulsiv, kommentieren nur wenn wirklich bewegt).
-- Log-Normalisierung: 100 Likes = voller Wert (0.05)
--
--   0 Likes   → +0.000
--   1 Like    → +0.010  (LOG(2)/LOG(101) × 0.05)
--   10 Likes  → +0.033
--   50 Likes  → +0.045
--   100 Likes → +0.050  (Maximum)

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_like_count
  ON public.posts (like_count DESC)
  WHERE like_count > 0;

-- ── Trigger: likes → posts.like_count ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._sync_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_like_count ON public.likes;
CREATE TRIGGER trg_sync_like_count
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_like_count();

-- ── Backfill ─────────────────────────────────────────────────────────────────
UPDATE public.posts p
SET like_count = (
  SELECT COUNT(*)::INT FROM public.likes l WHERE l.post_id = p.id
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  INSIGHT 3 — Bookmark Count als Feed-Signal                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Bookmarks sind das stärkste explizite Signal: "Ich komme zurück zu diesem
-- Content." Das Video nennt saves als Top-Metrik. Geringerer Schwellwert
-- als Likes (20 Bookmarks = max) weil Bookmarks viel seltener sind.
--
--   0 Bookmarks  → +0.000
--   1 Bookmark   → +0.021  (LOG(2)/LOG(21) × 0.05)
--   5 Bookmarks  → +0.038
--   10 Bookmarks → +0.046
--   20 Bookmarks → +0.050  (Maximum)

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS bookmark_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_bookmark_count
  ON public.posts (bookmark_count DESC)
  WHERE bookmark_count > 0;

-- ── Trigger: bookmarks → posts.bookmark_count ─────────────────────────────────
CREATE OR REPLACE FUNCTION public._sync_bookmark_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET bookmark_count = bookmark_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bookmark_count ON public.bookmarks;
CREATE TRIGGER trg_sync_bookmark_count
  AFTER INSERT OR DELETE ON public.bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_bookmark_count();

-- ── Backfill ─────────────────────────────────────────────────────────────────
UPDATE public.posts p
SET bookmark_count = (
  SELECT COUNT(*)::INT FROM public.bookmarks b WHERE b.post_id = p.id
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  INSIGHT 4 — Creator Consistency Score                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Das Video: Creators die immer über dasselbe Thema posten bekommen besser
-- Sample Groups weil der Algorithmus weiß was er erwarten kann.
-- Wir belohnen das: niedrige Varianz in score_brain/score_explore → Boost.
--
-- Formel:
--   stddev_total = STDDEV(score_explore) + STDDEV(score_brain) der letzten 10 Posts
--   consistency  = GREATEST(0, 1 - stddev_total × 2)   → [0, 1]
--   Feed-Boost   = consistency × 0.03
--
--   Alle Posts gleicher Vibe (stddev≈0.0) → consistency=1.0 → +0.030
--   Moderate Varianz           (stddev=0.3) → consistency=0.4 → +0.012
--   Chaos-Creator              (stddev≥0.5) → consistency=0.0 → +0.000

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consistency_score FLOAT NOT NULL DEFAULT 0.5;

-- ── Hilfsfunktion: Consistency eines Creators berechnen ──────────────────────
CREATE OR REPLACE FUNCTION public._compute_creator_consistency(p_author_id UUID)
RETURNS FLOAT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stddev_explore FLOAT;
  v_stddev_brain   FLOAT;
  v_post_count     INT;
BEGIN
  SELECT
    COALESCE(STDDEV(score_explore), 0),
    COALESCE(STDDEV(score_brain),   0),
    COUNT(*)
  INTO v_stddev_explore, v_stddev_brain, v_post_count
  FROM (
    SELECT score_explore, score_brain
    FROM public.posts
    WHERE author_id = p_author_id
      AND score_explore IS NOT NULL
      AND score_brain   IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
  ) last_posts;

  -- Mindestens 3 Posts um aussagekräftig zu sein
  IF v_post_count < 3 THEN
    RETURN 0.5; -- Neutral bis genug Daten vorhanden
  END IF;

  RETURN GREATEST(0.0, 1.0 - (v_stddev_explore + v_stddev_brain) * 2.0);
END;
$$;

-- ── Trigger: Nach jedem neuen Post → Consistency neu berechnen ───────────────
CREATE OR REPLACE FUNCTION public._on_post_update_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET consistency_score = public._compute_creator_consistency(NEW.author_id)
  WHERE id = NEW.author_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_consistency ON public.posts;
CREATE TRIGGER trg_post_consistency
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public._on_post_update_consistency();

-- ── Backfill: Consistency für alle bestehenden Creator berechnen ──────────────
UPDATE public.profiles pr
SET consistency_score = public._compute_creator_consistency(pr.id)
WHERE pr.id IN (SELECT DISTINCT author_id FROM public.posts);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  INSIGHT 5 — Caption Keyword Scoring                                    ║
-- ║  Posts ohne Tags bekommen jetzt echte Vibe-Scores aus Caption-Text      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Problem bisher: Posts ohne Tags → score_brain=0.5, score_explore=0.5 (neutral)
-- Lösung: Caption-Text nach Keywords scannen → Vibe-Scores ableiten
--
-- Blending:
--   Nur Tags      → 100% Tags
--   Tags + Caption → 70% Tags + 30% Caption
--   Nur Caption   → 100% Caption (vorher: 0.5/0.5 neutral — jetzt korrekt!)
--
-- Keyword-Map: erweiterte Version des Tag-Systems, erkennt auch
-- zusammengesetzte Begriffe und Synonyme im Freitext.

CREATE OR REPLACE FUNCTION public._caption_to_scores(p_caption TEXT)
RETURNS TABLE (c_brain FLOAT, c_explore FLOAT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cap       TEXT;
  v_brain   FLOAT := 0;
  v_explore FLOAT := 0;
  v_count   INT   := 0;
BEGIN
  IF p_caption IS NULL OR length(trim(p_caption)) = 0 THEN
    RETURN QUERY SELECT NULL::FLOAT, NULL::FLOAT;
    RETURN;
  END IF;

  cap := lower(p_caption);

  -- ── 🧠 Tech & Wissenschaft ────────────────────────────────────────────────
  IF cap ~ '(tech|technolog|coding|programm|software|developer|github|api|algorithm)' THEN
    v_brain := v_brain + 0.92; v_explore := v_explore + 0.22; v_count := v_count + 1;
  END IF;
  IF cap ~ '(science|research|studie|experiment|physik|biolog|chemie|math)' THEN
    v_brain := v_brain + 0.90; v_explore := v_explore + 0.30; v_count := v_count + 1;
  END IF;
  IF cap ~ '(business|startup|entrepreneur|revenue|profit|marketing|strategy)' THEN
    v_brain := v_brain + 0.80; v_explore := v_explore + 0.35; v_count := v_count + 1;
  END IF;
  IF cap ~ '(mindful|meditation|mental health|achtsamkeit|selbstreflexion)' THEN
    v_brain := v_brain + 0.62; v_explore := v_explore + 0.70; v_count := v_count + 1;
  END IF;
  IF cap ~ '(motivation|inspiration|productivity|wachstum|lernen|tipps)' THEN
    v_brain := v_brain + 0.55; v_explore := v_explore + 0.60; v_count := v_count + 1;
  END IF;

  -- ── 🎨 Kreativität & Kunst ────────────────────────────────────────────────
  IF cap ~ '(design|ui|ux|graphic|visual|branding|kreativ|gestalt)' THEN
    v_brain := v_brain + 0.68; v_explore := v_explore + 0.62; v_count := v_count + 1;
  END IF;
  IF cap ~ '(art|painting|drawing|illustration|canvas|galerie|kunst)' THEN
    v_brain := v_brain + 0.42; v_explore := v_explore + 0.88; v_count := v_count + 1;
  END IF;
  IF cap ~ '(photo|photograph|camera|bild|shot|portrait|landscape|analog)' THEN
    v_brain := v_brain + 0.38; v_explore := v_explore + 0.78; v_count := v_count + 1;
  END IF;
  IF cap ~ '(film|movie|cinema|director|kino|scene|cinemat)' THEN
    v_brain := v_brain + 0.45; v_explore := v_explore + 0.72; v_count := v_count + 1;
  END IF;
  IF cap ~ '(architect|building|structure|design bau|gebäude)' THEN
    v_brain := v_brain + 0.72; v_explore := v_explore + 0.55; v_count := v_count + 1;
  END IF;

  -- ── ✈️ Reise & Abenteuer ──────────────────────────────────────────────────
  IF cap ~ '(travel|reise|trip|journey|explore|wanderlust|urlaub|vacation)' THEN
    v_brain := v_brain + 0.32; v_explore := v_explore + 0.92; v_count := v_count + 1;
  END IF;
  IF cap ~ '(adventure|abenteuer|hiking|wandern|backpack|offroad)' THEN
    v_brain := v_brain + 0.28; v_explore := v_explore + 0.90; v_count := v_count + 1;
  END IF;
  IF cap ~ '(nature|natur|forest|wald|ocean|beach|mountain|berg|wilderness)' THEN
    v_brain := v_brain + 0.30; v_explore := v_explore + 0.82; v_count := v_count + 1;
  END IF;

  -- ── 🎵 Entertainment & Lifestyle ─────────────────────────────────────────
  IF cap ~ '(music|musik|song|beat|artist|producer|playlist|concert|album)' THEN
    v_brain := v_brain + 0.35; v_explore := v_explore + 0.65; v_count := v_count + 1;
  END IF;
  IF cap ~ '(dance|tanz|choreograph|freestyle|routine)' THEN
    v_brain := v_brain + 0.25; v_explore := v_explore + 0.68; v_count := v_count + 1;
  END IF;
  IF cap ~ '(comedy|funny|humor|joke|lol|challenge|meme)' THEN
    v_brain := v_brain + 0.18; v_explore := v_explore + 0.58; v_count := v_count + 1;
  END IF;
  IF cap ~ '(food|recipe|kochen|rezept|restaurant|essen|chef|cuisine)' THEN
    v_brain := v_brain + 0.22; v_explore := v_explore + 0.48; v_count := v_count + 1;
  END IF;
  IF cap ~ '(fashion|mode|outfit|style|ootd|kleidung|look|trend)' THEN
    v_brain := v_brain + 0.20; v_explore := v_explore + 0.52; v_count := v_count + 1;
  END IF;
  IF cap ~ '(beauty|makeup|skincare|cosmetic|pflege|glow)' THEN
    v_brain := v_brain + 0.18; v_explore := v_explore + 0.50; v_count := v_count + 1;
  END IF;

  -- ── ⚡ Sport & Fitness ────────────────────────────────────────────────────
  IF cap ~ '(sport|workout|training|gym|fitness|exercise|run|swim|muscle)' THEN
    v_brain := v_brain + 0.30; v_explore := v_explore + 0.40; v_count := v_count + 1;
  END IF;
  IF cap ~ '(gaming|game|twitch|stream|esport|level|gamer|play)' THEN
    v_brain := v_brain + 0.40; v_explore := v_explore + 0.55; v_count := v_count + 1;
  END IF;

  -- Keine Matches → keine Caption-Scores (Tags allein bestimmen)
  IF v_count = 0 THEN
    RETURN QUERY SELECT NULL::FLOAT, NULL::FLOAT;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_brain / v_count, v_explore / v_count;
END;
$$;

-- ── Erweiterte calculate_vibe_scores: Tags + Caption Blending ─────────────────
CREATE OR REPLACE FUNCTION public.calculate_vibe_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_brain   FLOAT := 0;
  v_explore FLOAT := 0;
  v_count   INT   := 0;
  v_tag     TEXT;
  tag_brain   FLOAT;
  tag_explore FLOAT;

  -- Caption-Signal
  v_cap_brain   FLOAT;
  v_cap_explore FLOAT;
BEGIN

  -- ── SCHRITT 1: Tag-Scores berechnen (wie bisher) ─────────────────────────
  IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
    FOREACH v_tag IN ARRAY NEW.tags LOOP
      v_tag := lower(trim(v_tag));
      CASE v_tag
        WHEN 'tech'         THEN tag_brain := 0.92; tag_explore := 0.22;
        WHEN 'science'      THEN tag_brain := 0.90; tag_explore := 0.30;
        WHEN 'architecture' THEN tag_brain := 0.72; tag_explore := 0.55;
        WHEN 'design'       THEN tag_brain := 0.68; tag_explore := 0.62;
        WHEN 'art'          THEN tag_brain := 0.42; tag_explore := 0.88;
        WHEN 'photography'  THEN tag_brain := 0.38; tag_explore := 0.78;
        WHEN 'film'         THEN tag_brain := 0.45; tag_explore := 0.72;
        WHEN 'travel'       THEN tag_brain := 0.32; tag_explore := 0.92;
        WHEN 'nature'       THEN tag_brain := 0.30; tag_explore := 0.82;
        WHEN 'adventure'    THEN tag_brain := 0.28; tag_explore := 0.90;
        WHEN 'music'        THEN tag_brain := 0.35; tag_explore := 0.65;
        WHEN 'dance'        THEN tag_brain := 0.25; tag_explore := 0.68;
        WHEN 'comedy'       THEN tag_brain := 0.18; tag_explore := 0.58;
        WHEN 'food'         THEN tag_brain := 0.22; tag_explore := 0.48;
        WHEN 'fashion'      THEN tag_brain := 0.20; tag_explore := 0.52;
        WHEN 'beauty'       THEN tag_brain := 0.18; tag_explore := 0.50;
        WHEN 'sport'        THEN tag_brain := 0.28; tag_explore := 0.42;
        WHEN 'fitness'      THEN tag_brain := 0.32; tag_explore := 0.38;
        WHEN 'gaming'       THEN tag_brain := 0.40; tag_explore := 0.55;
        WHEN 'mindfulness'  THEN tag_brain := 0.62; tag_explore := 0.70;
        WHEN 'motivation'   THEN tag_brain := 0.55; tag_explore := 0.60;
        WHEN 'business'     THEN tag_brain := 0.80; tag_explore := 0.35;
        ELSE tag_brain := 0.50; tag_explore := 0.50;
      END CASE;
      v_brain   := v_brain   + tag_brain;
      v_explore := v_explore + tag_explore;
      v_count   := v_count   + 1;
    END LOOP;
  END IF;

  -- ── SCHRITT 2: Caption-Scores berechnen (NEU) ─────────────────────────────
  SELECT c_brain, c_explore
  INTO   v_cap_brain, v_cap_explore
  FROM   public._caption_to_scores(NEW.caption)
  LIMIT  1;

  -- ── SCHRITT 3: Blending ───────────────────────────────────────────────────
  IF v_count > 0 AND v_cap_brain IS NOT NULL THEN
    -- Beide Signale vorhanden: 70% Tags + 30% Caption
    NEW.score_brain   := ROUND(((v_brain   / v_count) * 0.70 + v_cap_brain   * 0.30)::NUMERIC, 2);
    NEW.score_explore := ROUND(((v_explore / v_count) * 0.70 + v_cap_explore * 0.30)::NUMERIC, 2);

  ELSIF v_count > 0 THEN
    -- Nur Tag-Signal
    NEW.score_brain   := ROUND((v_brain   / v_count)::NUMERIC, 2);
    NEW.score_explore := ROUND((v_explore / v_count)::NUMERIC, 2);

  ELSIF v_cap_brain IS NOT NULL THEN
    -- Nur Caption-Signal (bisher: immer 0.5/0.5 — jetzt korrekt!)
    NEW.score_brain   := ROUND(v_cap_brain::NUMERIC,   2);
    NEW.score_explore := ROUND(v_cap_explore::NUMERIC, 2);

  ELSE
    -- Kein Signal → neutral
    NEW.score_brain   := 0.50;
    NEW.score_explore := 0.50;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Trigger aktualisieren: jetzt auch bei Caption-Änderung feuern ─────────────
DROP TRIGGER IF EXISTS auto_vibe_scores ON public.posts;
CREATE TRIGGER auto_vibe_scores
  BEFORE INSERT OR UPDATE OF tags, caption
  ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_vibe_scores();

-- ── Backfill: alle Posts mit Caption neu berechnen ───────────────────────────
UPDATE public.posts SET caption = caption
WHERE caption IS NOT NULL AND length(trim(caption)) > 0;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FINALE get_vibe_feed — alle 8 Signale kombiniert                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_vibe_feed(
  explore_weight FLOAT   DEFAULT 0.5,
  brain_weight   FLOAT   DEFAULT 0.5,
  result_limit   INT     DEFAULT 15,
  result_offset  INT     DEFAULT 0,
  filter_tag     TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  author_id        UUID,
  caption          TEXT,
  media_url        TEXT,
  media_type       TEXT,
  dwell_time_score FLOAT,
  score_explore    FLOAT,
  score_brain      FLOAT,
  tags             TEXT[],
  guild_id         UUID,
  is_guild_post    BOOLEAN,
  created_at       TIMESTAMPTZ,
  username         TEXT,
  avatar_url       TEXT,
  final_score      FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID;
  v_learned_explore FLOAT;
  v_learned_brain   FLOAT;
  v_interactions    INT;
  v_learn_weight    FLOAT;
  v_eff_explore     FLOAT;
  v_eff_brain       FLOAT;
BEGIN
  v_user_id := auth.uid();

  -- ── Lernprofil laden ─────────────────────────────────────────────────────
  SELECT learned_explore, learned_brain, interaction_count
  INTO   v_learned_explore, v_learned_brain, v_interactions
  FROM   public.user_vibe_profile
  WHERE  user_id = v_user_id;

  -- ── Blend: Slider + Lernprofil ───────────────────────────────────────────
  v_learn_weight := LEAST(COALESCE(v_interactions, 0)::FLOAT / 20.0, 0.70);

  v_eff_explore := LEAST(GREATEST(
    explore_weight * (1.0 - v_learn_weight)
    + COALESCE(v_learned_explore, explore_weight) * v_learn_weight,
    0.0), 1.0);

  v_eff_brain := LEAST(GREATEST(
    brain_weight * (1.0 - v_learn_weight)
    + COALESCE(v_learned_brain, brain_weight) * v_learn_weight,
    0.0), 1.0);

  -- ── Feed-Query ───────────────────────────────────────────────────────────
  RETURN QUERY
  WITH

  scored AS (
    SELECT
      p.id,
      p.author_id,
      p.caption,
      p.media_url,
      p.media_type,
      LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0)   AS dwell_capped,
      COALESCE(p.score_explore, 0.5)                   AS score_explore_safe,
      COALESCE(p.score_brain,   0.5)                   AS score_brain_safe,
      p.tags,
      p.guild_id,
      p.is_guild_post,
      p.created_at,
      pr.username,
      pr.avatar_url,
      (
        -- 1. Dwell: 45% — echter Konsum-Beweis (dominantes Signal)
        LEAST(COALESCE(p.dwell_time_score, 0.0), 1.0) * 0.45

        -- 2. Explore-Match: 25% — User-Präferenz (Slider + Lernprofil)
        + (1.0 - ABS(COALESCE(p.score_explore, 0.5) - v_eff_explore)) * 0.25

        -- 3. Brain-Match: 25% — User-Präferenz (Slider + Lernprofil)
        + (1.0 - ABS(COALESCE(p.score_brain, 0.5) - v_eff_brain)) * 0.25

        -- 4. Freshness: bis 10% — Cold-Start-Boost (48h linear)
        + GREATEST(
            0.0,
            0.10 - EXTRACT(EPOCH FROM (NOW() - p.created_at))
                   / (48.0 * 3600.0) * 0.10
          )

        -- 5. Comments: bis 10% — logarithmisch (50 Comments = max)
        + LEAST(
            LOG(1.0 + COALESCE(p.comment_count, 0)::FLOAT) / LOG(51.0),
            1.0
          ) * 0.10

        -- 6. Likes: bis 5% — logarithmisch (100 Likes = max)
        + LEAST(
            LOG(1.0 + COALESCE(p.like_count, 0)::FLOAT) / LOG(101.0),
            1.0
          ) * 0.05

        -- 7. Bookmarks: bis 5% — logarithmisch (20 Bookmarks = max)
        --    Schwellwert niedriger weil Bookmarks seltener aber bedeutsamer
        + LEAST(
            LOG(1.0 + COALESCE(p.bookmark_count, 0)::FLOAT) / LOG(21.0),
            1.0
          ) * 0.05

        -- 8. Creator Consistency: bis 3% — Creator der bei Thema bleibt
        + COALESCE(pr.consistency_score, 0.5) * 0.03

      ) AS final_score
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    WHERE p.is_guild_post IS NOT TRUE
      AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
  ),

  ranked AS (
    SELECT
      *,
      COUNT(DISTINCT author_id) OVER ()  AS total_authors,
      ROW_NUMBER() OVER (
        PARTITION BY author_id
        ORDER BY final_score DESC, created_at DESC
      ) AS author_rank
    FROM scored
  )

  SELECT
    id, author_id, caption, media_url, media_type,
    dwell_capped       AS dwell_time_score,
    score_explore_safe AS score_explore,
    score_brain_safe   AS score_brain,
    tags, guild_id, is_guild_post, created_at,
    username, avatar_url, final_score
  FROM ranked
  WHERE author_rank <= GREATEST(2, CEIL(result_limit::FLOAT / NULLIF(total_authors, 0))::INT)
  ORDER BY final_score DESC NULLS LAST, created_at DESC
  LIMIT  result_limit
  OFFSET result_offset;

END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFIKATION                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT
  '══ ADVANCED SIGNALS STATUS ══'                                   AS check_name, '' AS value
UNION ALL SELECT 'Posts mit like_count > 0',
  COUNT(*)::TEXT FROM public.posts WHERE like_count > 0
UNION ALL SELECT 'Posts mit bookmark_count > 0',
  COUNT(*)::TEXT FROM public.posts WHERE bookmark_count > 0
UNION ALL SELECT 'Creator mit consistency_score > 0.7',
  COUNT(*)::TEXT FROM public.profiles WHERE consistency_score > 0.7
UNION ALL SELECT 'Ø Creator Consistency',
  ROUND(AVG(consistency_score)::NUMERIC, 3)::TEXT FROM public.profiles WHERE consistency_score > 0
UNION ALL SELECT 'Posts mit caption-basierten Scores',
  COUNT(*)::TEXT FROM public.posts
  WHERE (tags IS NULL OR array_length(tags,1) IS NULL)
    AND caption IS NOT NULL
    AND (score_explore != 0.5 OR score_brain != 0.5)
UNION ALL SELECT 'Like-Trigger',    'trg_sync_like_count'     AS value
UNION ALL SELECT 'Bookmark-Trigger','trg_sync_bookmark_count' AS value
UNION ALL SELECT 'Consistency-Trigger','trg_post_consistency' AS value
UNION ALL SELECT 'Caption-Trigger feuert bei','caption + tags Änderung' AS value;
