-- -----------------------------------------------------------------------------
-- v1.w.UI.80 — aspect_ratio für Posts
--
-- Speichert das Seitenverhältnis eines Posts für format-aware Layouts.
-- 'portrait'  = 9:16  (TikTok/Reels — Hochformat, Default)
-- 'landscape' = 16:9  (YouTube/OBS — Querformat)
-- 'square'    = 1:1   (Instagram — Quadrat)
--
-- Default 'portrait' damit alle bestehenden Posts weiterhin korrekt rendern.
-- -----------------------------------------------------------------------------

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT NOT NULL DEFAULT 'portrait'
    CHECK (aspect_ratio IN ('portrait', 'landscape', 'square'));

-- Index hilft wenn wir nach Landscape-Posts filtern (optional, defensiv)
CREATE INDEX IF NOT EXISTS idx_posts_aspect_ratio
  ON public.posts (aspect_ratio)
  WHERE aspect_ratio <> 'portrait'; -- Nur Nicht-Standard-Werte indexieren (partial index)
