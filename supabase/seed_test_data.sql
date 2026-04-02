-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Test Data Seed
--
-- Generiert 20 realistische Test-Posts mit verschiedenen:
--   - Tags / Vibe-Koordinaten (Tech, Travel, Art, Music, Food, Fitness...)
--   - Altern (0h bis 7 Tage alt → Freshness-Effekt sichtbar)
--   - Dwell-Scores (0.0 bis 0.95 → Algorithm-Ranking sichtbar)
--   - Likes, Comments, Bookmarks (Engagement-Signale sichtbar)
--
-- CLEANUP: Alle Test-Posts haben Caption-Prefix "[TEST]"
-- Löschen: DELETE FROM public.posts WHERE caption LIKE '[TEST]%';
--
-- AUSFÜHREN: Im Supabase SQL Editor (als postgres/service role)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_author_id UUID;
BEGIN

  -- Ersten existierenden User als Autor nehmen
  SELECT id INTO v_author_id FROM public.profiles LIMIT 1;

  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'Kein User gefunden. Bitte erst Account anlegen.';
  END IF;

  -- Alte Test-Posts löschen (idempotent)
  DELETE FROM public.posts WHERE caption LIKE '[TEST]%';

  -- ── 🧠 TECH-POSTS (high brain, low explore) ────────────────────────────────
  -- Erwartetes Ergebnis: score_brain≈0.92, score_explore≈0.22

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] How we built our recommendation engine in 3 days using PostgreSQL and EMA scoring.',
    'image', 'https://picsum.photos/seed/tech1/800/600',
    ARRAY['tech'], 0.88, 45, 12, 8,
    NOW() - INTERVAL '6 hours', FALSE
  );

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Why most junior developers fail at system design (and how to fix it).',
    'image', 'https://picsum.photos/seed/tech2/800/600',
    ARRAY['tech'], 0.72, 23, 7, 4,
    NOW() - INTERVAL '18 hours', FALSE
  );

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] The algorithm nobody talks about. Open source, 200 lines of SQL.',
    'image', 'https://picsum.photos/seed/tech3/800/600',
    ARRAY['tech'], 0.55, 12, 3, 2,
    NOW() - INTERVAL '3 days', FALSE
  );

  -- ── ✈️ TRAVEL-POSTS (low brain, high explore) ─────────────────────────────
  -- Erwartetes Ergebnis: score_brain≈0.32, score_explore≈0.92

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] 3 Wochen Japan mit 800€ — alles was ich gelernt habe.',
    'image', 'https://picsum.photos/seed/travel1/800/600',
    ARRAY['travel'], 0.95, 89, 34, 21,
    NOW() - INTERVAL '2 hours', FALSE
  );

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Nobody told me Iceland in winter is 10x better than summer.',
    'image', 'https://picsum.photos/seed/travel2/800/600',
    ARRAY['travel', 'adventure'], 0.78, 56, 18, 11,
    NOW() - INTERVAL '1 day', FALSE
  );

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Morning in the mountains. Silence as the algorithm.',
    'image', 'https://picsum.photos/seed/travel3/800/600',
    ARRAY['travel', 'nature'], 0.45, 18, 4, 3,
    NOW() - INTERVAL '5 days', FALSE
  );

  -- ── 🎨 ART-POSTS (medium brain, high explore) ─────────────────────────────
  -- Erwartetes Ergebnis: score_brain≈0.42, score_explore≈0.88

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] 6 Monate gebraucht um dieses Gemälde zu verstehen. 30 Sekunden um es zu fühlen.',
    'image', 'https://picsum.photos/seed/art1/800/600',
    ARRAY['art'], 0.91, 103, 41, 29,
    NOW() - INTERVAL '4 hours', FALSE
  );

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Digital art is not art. Change my mind.',
    'image', 'https://picsum.photos/seed/art2/800/600',
    ARRAY['art', 'design'], 0.83, 67, 52, 14,
    NOW() - INTERVAL '2 days', FALSE
  );

  -- ── 🎵 MUSIC-POSTS (medium brain, medium explore) ─────────────────────────

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Das erste Mal Chopin gehört. Ich habs nicht verstanden. 10 Jahre später — jetzt schon.',
    'image', 'https://picsum.photos/seed/music1/800/600',
    ARRAY['music'], 0.62, 34, 9, 7,
    NOW() - INTERVAL '8 hours', FALSE
  );

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Lo-fi beats für 8 Stunden Arbeit. Link in Bio.',
    'image', 'https://picsum.photos/seed/music2/800/600',
    ARRAY['music'], 0.38, 21, 6, 9,
    NOW() - INTERVAL '4 days', FALSE
  );

  -- ── 🍜 FOOD-POSTS (low brain, medium explore) ─────────────────────────────

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Ramen in Tokyo ist nicht was ich erwartet hatte. Es war 10x besser.',
    'image', 'https://picsum.photos/seed/food1/800/600',
    ARRAY['food'], 0.51, 28, 7, 5,
    NOW() - INTERVAL '12 hours', FALSE
  );

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Das einfachste Pasta-Rezept das ich kenne. 4 Zutaten. 12 Minuten.',
    'image', 'https://picsum.photos/seed/food2/800/600',
    ARRAY['food'], 0.27, 11, 3, 4,
    NOW() - INTERVAL '6 days', FALSE
  );

  -- ── ⚡ FITNESS-POSTS (medium brain, low explore) ──────────────────────────

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] 90 Tage kein Zucker. Was mit meinem Körper passiert ist.',
    'image', 'https://picsum.photos/seed/fit1/800/600',
    ARRAY['fitness'], 0.74, 42, 15, 12,
    NOW() - INTERVAL '36 hours', FALSE
  );

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Morgens 5 Minuten kaltes Wasser. Klingt crazy, fühlt sich besser an.',
    'image', 'https://picsum.photos/seed/fit2/800/600',
    ARRAY['fitness', 'mindfulness'], 0.48, 19, 8, 6,
    NOW() - INTERVAL '7 days', FALSE
  );

  -- ── 💼 BUSINESS-POSTS (high brain, low explore) ──────────────────────────

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Mit 0€ Marketing auf 10.000 User. Was wirklich funktioniert hat.',
    'image', 'https://picsum.photos/seed/biz1/800/600',
    ARRAY['business'], 0.81, 74, 28, 17,
    NOW() - INTERVAL '20 hours', FALSE
  );

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Warum 95% der Startups im ersten Jahr scheitern. Die echten Gründe.',
    'image', 'https://picsum.photos/seed/biz2/800/600',
    ARRAY['business', 'motivation'], 0.69, 38, 19, 9,
    NOW() - INTERVAL '3 days', FALSE
  );

  -- ── 😂 COMEDY-POST (low brain, medium explore) ────────────────────────────

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Als der Algorithmus endlich versteht was du willst und dann 3 Posts später alles vergisst.',
    'image', 'https://picsum.photos/seed/comedy1/800/600',
    ARRAY['comedy'], 0.33, 87, 44, 3,
    NOW() - INTERVAL '1 hour', FALSE
  );

  -- ── 📸 PHOTOGRAPHY-POST (medium brain, high explore) ─────────────────────

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Analog photography in 2026 — slower, intentional, worth it.',
    'image', 'https://picsum.photos/seed/photo1/800/600',
    ARRAY['photography'], 0.86, 61, 22, 18,
    NOW() - INTERVAL '14 hours', FALSE
  );

  -- ── 🌿 NATURE-POST (frisch, noch kein Dwell) ─────────────────────────────
  -- Simuliert einen brand-new Post — sollte trotzdem im Feed auftauchen (Freshness-Boost)

  INSERT INTO public.posts (author_id, caption, media_type, media_url, tags, dwell_time_score, like_count, comment_count, bookmark_count, created_at, is_guild_post)
  VALUES (
    v_author_id,
    '[TEST] Heute morgen. Kein Filter. Kein Plan. Nur raus.',
    'image', 'https://picsum.photos/seed/nature1/800/600',
    ARRAY['nature'], 0.0, 0, 0, 0,
    NOW() - INTERVAL '5 minutes', FALSE
  );

  RAISE NOTICE '✅ 20 Test-Posts erstellt für User %', v_author_id;

END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Feed-Check: Simulierter Feed für User mit neutralem Slider (0.5/0.5)   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Sollte zeigen:
--   1. travel/art Posts mit hohem Dwell+Engagement oben
--   2. Frischer nature-Post (0 Dwell) durch Freshness-Bonus sichtbar
--   3. Comedy-Post (hohe Comments aber mittlerer Dwell) im Mittelfeld
--   4. Alte Posts mit niedrigem Engagement unten

SELECT
  SUBSTRING(caption, 1, 50)              AS caption_preview,
  tags[1]                                AS main_tag,
  ROUND(dwell_time_score::NUMERIC, 2)    AS dwell,
  like_count,
  comment_count,
  bookmark_count,
  ROUND(EXTRACT(HOURS FROM (NOW() - created_at))::NUMERIC, 0) AS age_hours,
  ROUND((
    LEAST(COALESCE(dwell_time_score, 0.0), 1.0) * 0.45
    + (1.0 - ABS(COALESCE(score_explore, 0.5) - 0.5)) * 0.25
    + (1.0 - ABS(COALESCE(score_brain,   0.5) - 0.5)) * 0.25
    + GREATEST(0.0, 0.10 - EXTRACT(EPOCH FROM (NOW() - created_at)) / (48.0 * 3600.0) * 0.10)
    + LEAST(LOG(1.0 + COALESCE(comment_count, 0)::FLOAT) / LOG(51.0), 1.0) * 0.10
    + LEAST(LOG(1.0 + COALESCE(like_count, 0)::FLOAT) / LOG(101.0), 1.0) * 0.05
    + LEAST(LOG(1.0 + COALESCE(bookmark_count, 0)::FLOAT) / LOG(21.0), 1.0) * 0.05
  )::NUMERIC, 4)                         AS simulated_score
FROM public.posts
WHERE caption LIKE '[TEST]%'
ORDER BY simulated_score DESC;
