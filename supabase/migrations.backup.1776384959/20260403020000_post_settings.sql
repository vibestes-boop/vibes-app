-- Post Settings: Privacy, Allow Comments/Download/Duet, Cover Time
-- Migration: 20260403_post_settings

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS privacy        TEXT    NOT NULL DEFAULT 'public'
    CHECK (privacy IN ('public', 'friends', 'private')),
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_download BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_duet     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cover_time_ms  INTEGER DEFAULT 0;

-- thumbnail_url war schon vorhanden via vorherige Migrations, guard:
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;
