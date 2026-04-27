-- -----------------------------------------------------------------------------
-- v1.w.UI.90 — aspect_ratio für scheduled_posts + schedule_post RPC
--
-- Der Web-CreateEditor erkennt seit v1.w.UI.82 das Seitenverhältnis beim
-- Upload automatisch und übergibt p_aspect_ratio an schedule_post. Der RPC
-- kannte den Parameter aber noch nicht → Fehler bei geplanten Posts.
--
-- Fix:
--   1. scheduled_posts.aspect_ratio Spalte (analog posts.aspect_ratio).
--   2. schedule_post RPC neu erstellt mit p_aspect_ratio Parameter.
--   3. publish_due_scheduled_posts übergibt aspect_ratio an posts-Insert.
-- -----------------------------------------------------------------------------

-- 1. Spalte auf scheduled_posts
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT NOT NULL DEFAULT 'portrait'
    CHECK (aspect_ratio IN ('portrait', 'landscape', 'square'));

-- 2. schedule_post RPC — neu mit p_aspect_ratio
CREATE OR REPLACE FUNCTION public.schedule_post(
  p_publish_at      TIMESTAMPTZ,
  p_caption         TEXT DEFAULT NULL,
  p_media_url       TEXT DEFAULT NULL,
  p_media_type      TEXT DEFAULT NULL,
  p_thumbnail_url   TEXT DEFAULT NULL,
  p_tags            TEXT[] DEFAULT '{}',
  p_is_guild_post   BOOLEAN DEFAULT false,
  p_guild_id        UUID DEFAULT NULL,
  p_audio_url       TEXT DEFAULT NULL,
  p_audio_volume    NUMERIC DEFAULT NULL,
  p_privacy         TEXT DEFAULT 'public',
  p_allow_comments  BOOLEAN DEFAULT true,
  p_allow_download  BOOLEAN DEFAULT false,
  p_allow_duet      BOOLEAN DEFAULT true,
  p_women_only      BOOLEAN DEFAULT false,
  p_cover_time_ms   INTEGER DEFAULT NULL,
  p_aspect_ratio    TEXT DEFAULT 'portrait'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_publish_at <= NOW() + INTERVAL '1 minute' THEN
    RAISE EXCEPTION 'publish_at muss mind. 1 Minute in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_publish_at > NOW() + INTERVAL '60 days' THEN
    RAISE EXCEPTION 'publish_at darf max. 60 Tage in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  IF p_media_url IS NULL AND (p_caption IS NULL OR char_length(trim(p_caption)) = 0) THEN
    RAISE EXCEPTION 'Entweder Media oder Caption erforderlich' USING ERRCODE = '22023';
  END IF;
  IF p_aspect_ratio NOT IN ('portrait', 'landscape', 'square') THEN
    p_aspect_ratio := 'portrait';
  END IF;

  INSERT INTO public.scheduled_posts (
    author_id, caption, media_url, media_type, thumbnail_url, tags,
    is_guild_post, guild_id, audio_url, audio_volume,
    privacy, allow_comments, allow_download, allow_duet, women_only,
    cover_time_ms, publish_at, aspect_ratio
  ) VALUES (
    v_caller, NULLIF(trim(p_caption), ''), p_media_url, p_media_type, p_thumbnail_url, p_tags,
    p_is_guild_post, p_guild_id, p_audio_url, p_audio_volume,
    p_privacy, p_allow_comments, p_allow_download, p_allow_duet, p_women_only,
    p_cover_time_ms, p_publish_at, p_aspect_ratio
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3. publish_due_scheduled_posts — aspect_ratio an posts-Insert weitergeben
--    (DROP + CREATE wegen geänderter INSERT-Liste)
CREATE OR REPLACE FUNCTION public.publish_due_scheduled_posts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   public.scheduled_posts%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM public.scheduled_posts
    WHERE status = 'pending'
      AND publish_at <= NOW()
    ORDER BY publish_at
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      INSERT INTO public.posts (
        author_id, caption, media_url, media_type, thumbnail_url, tags,
        is_guild_post, guild_id, audio_url, audio_volume,
        privacy, allow_comments, allow_download, allow_duet, women_only,
        cover_time_ms, aspect_ratio
      ) VALUES (
        v_row.author_id, v_row.caption, v_row.media_url, v_row.media_type,
        v_row.thumbnail_url, v_row.tags,
        v_row.is_guild_post, v_row.guild_id, v_row.audio_url, v_row.audio_volume,
        v_row.privacy, v_row.allow_comments, v_row.allow_download, v_row.allow_duet,
        v_row.women_only, v_row.cover_time_ms,
        COALESCE(v_row.aspect_ratio, 'portrait')
      );

      UPDATE public.scheduled_posts
        SET status = 'published', published_at = NOW()
      WHERE id = v_row.id;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.scheduled_posts
        SET retries = retries + 1,
            status  = CASE WHEN retries + 1 >= 3 THEN 'failed' ELSE 'pending' END,
            last_error = SQLERRM
      WHERE id = v_row.id;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;
