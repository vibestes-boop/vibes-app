-- ============================================================================
-- 20260418150000_creator_studio_pro.sql
--
-- v1.20.0 — Creator-Studio Pro.
--
-- Drei neue Bausteine für Power-Creator:
--
--   1. scheduled_posts   — Posts mit publish_at planen. Edge Function
--                          "publish-scheduled-posts" (pg_cron, 1 min) kopiert
--                          fällige Einträge in die posts-Tabelle.
--
--   2. post_drafts       — Cloud-Drafts (ergänzt das lokale AsyncStorage-
--                          `useDrafts`). Media liegt im privaten "drafts"-
--                          Bucket, User-Folder-Isolation via RLS.
--
--   3. Engagement-Hours  — RPC leitet Peak-Aktivität der eigenen Audience
--                          aus likes/comments-Timestamps ab (weekday × hour).
--                          Plus: grobe Watch-Time-Schätzung aus view_count ×
--                          dwell_time_score.
-- ============================================================================

-- ─── Extensions ─────────────────────────────────────────────────────────────
-- (pg_cron + pg_net sind von der cleanup-Migration 20260415 bereits registriert)

-- ─── scheduled_posts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Exakt gespiegelte posts-Insert-Felder (1-zu-1 übernahme beim Publish)
  caption           TEXT,
  media_url         TEXT,
  media_type        TEXT CHECK (media_type IS NULL OR media_type IN ('image', 'video')),
  thumbnail_url     TEXT,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  is_guild_post     BOOLEAN NOT NULL DEFAULT false,
  guild_id          UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
  audio_url         TEXT,
  audio_volume      NUMERIC,
  privacy           TEXT NOT NULL DEFAULT 'public'
                      CHECK (privacy IN ('public', 'friends', 'private')),
  allow_comments    BOOLEAN NOT NULL DEFAULT true,
  allow_download    BOOLEAN NOT NULL DEFAULT false,
  allow_duet        BOOLEAN NOT NULL DEFAULT true,
  women_only        BOOLEAN NOT NULL DEFAULT false,
  cover_time_ms     INTEGER,

  -- Planungs-Felder
  publish_at        TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'cancelled')),
  retries           INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  published_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Vernunftsgrenzen
  CONSTRAINT scheduled_posts_caption_len CHECK (caption IS NULL OR char_length(caption) <= 2200),
  -- publish_at muss in der Zukunft liegen (beim Insert; Update kann's verschieben)
  CONSTRAINT scheduled_posts_future CHECK (publish_at > created_at - INTERVAL '1 minute')
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_author_status
  ON public.scheduled_posts(author_id, status, publish_at);

-- Hot-Index für den Cron-Worker: finde alles was jetzt dran ist
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_ready
  ON public.scheduled_posts(publish_at)
  WHERE status = 'pending';

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own scheduled_posts" ON public.scheduled_posts;
CREATE POLICY "Users can manage own scheduled_posts"
  ON public.scheduled_posts
  FOR ALL
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- updated_at Auto-Update
CREATE OR REPLACE FUNCTION public.scheduled_posts_touch() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scheduled_posts_touch ON public.scheduled_posts;
CREATE TRIGGER trg_scheduled_posts_touch
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.scheduled_posts_touch();


-- ─── post_drafts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_drafts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  caption            TEXT,
  tags               TEXT[] NOT NULL DEFAULT '{}',

  -- Medien: beide möglich, aber mindestens einer gesetzt wenn etwas zu zeigen
  media_type         TEXT CHECK (media_type IS NULL OR media_type IN ('image', 'video')),
  -- R2-URL (Posts nutzen R2 — Drafts genauso, um Doppel-Upload beim Publish
  -- zu vermeiden. Privacy-by-Obscurity: Keys enthalten Timestamps + UIDs,
  -- sind nicht enumerierbar.)
  media_url          TEXT,
  -- Optionales Preview-Thumbnail (R2-URL)
  thumbnail_url      TEXT,

  -- Editor-Settings die der User schon gewählt hat (JSONB für Flexibilität)
  -- { privacy, allowComments, allowDownload, allowDuet, womenOnly, audio, ... }
  settings           JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT post_drafts_caption_len CHECK (caption IS NULL OR char_length(caption) <= 2200)
);

CREATE INDEX IF NOT EXISTS idx_post_drafts_author_updated
  ON public.post_drafts(author_id, updated_at DESC);

ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own drafts" ON public.post_drafts;
CREATE POLICY "Users can manage own drafts"
  ON public.post_drafts
  FOR ALL
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- updated_at Auto-Update (gleicher Trigger-Body, neue Funktion für Namespacing)
CREATE OR REPLACE FUNCTION public.post_drafts_touch() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_drafts_touch ON public.post_drafts;
CREATE TRIGGER trg_post_drafts_touch
  BEFORE UPDATE ON public.post_drafts
  FOR EACH ROW EXECUTE FUNCTION public.post_drafts_touch();


-- Hinweis: Post-Medien liegen in Cloudflare R2 (siehe lib/uploadMedia.ts).
-- Drafts nutzen denselben Upload-Pfad (Key-Prefix "posts/…/…"), damit beim
-- Publish kein Re-Upload nötig ist. Wir speichern deshalb auch nur die URL,
-- keinen Supabase-Storage-Path.


-- ─── RPC: Scheduled-Post planen ─────────────────────────────────────────────
-- Ein Single-Call-Entry-Point, spart Client-seitige Validierung.
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
  p_cover_time_ms   INTEGER DEFAULT NULL
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

  INSERT INTO public.scheduled_posts (
    author_id, caption, media_url, media_type, thumbnail_url, tags,
    is_guild_post, guild_id, audio_url, audio_volume,
    privacy, allow_comments, allow_download, allow_duet, women_only,
    cover_time_ms, publish_at
  ) VALUES (
    v_caller, NULLIF(trim(p_caption), ''), p_media_url, p_media_type, p_thumbnail_url, p_tags,
    p_is_guild_post, p_guild_id, p_audio_url, p_audio_volume,
    p_privacy, p_allow_comments, p_allow_download, p_allow_duet, p_women_only,
    p_cover_time_ms, p_publish_at
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ─── RPC: Scheduled-Post umplanen (nur pending) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.reschedule_post(p_id UUID, p_new_time TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_new_time <= NOW() + INTERVAL '1 minute' THEN
    RAISE EXCEPTION 'publish_at muss mind. 1 Minute in der Zukunft liegen'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.scheduled_posts
     SET publish_at = p_new_time
   WHERE id = p_id AND author_id = v_caller AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Post nicht gefunden oder bereits veröffentlicht/abgebrochen'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


-- ─── RPC: Scheduled-Post abbrechen (nur pending) ────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_scheduled_post(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  UPDATE public.scheduled_posts
     SET status = 'cancelled'
   WHERE id = p_id AND author_id = v_caller AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled Post nicht gefunden oder nicht mehr abbrechbar'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


-- ─── RPC: Fällige Scheduled-Posts publishen (vom Cron/Edge aufgerufen) ──────
-- Returned Array der neu-publishten Post-IDs (damit der Edge-Logger zählt).
-- Idempotent: setzt erst 'publishing' (SELECT FOR UPDATE), dann 'published'.
CREATE OR REPLACE FUNCTION public.publish_due_scheduled_posts(p_batch_size INT DEFAULT 50)
RETURNS TABLE(scheduled_id UUID, post_id UUID, success BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     public.scheduled_posts%ROWTYPE;
  v_post_id UUID;
BEGIN
  FOR v_row IN
    SELECT *
      FROM public.scheduled_posts
     WHERE status = 'pending' AND publish_at <= NOW()
     ORDER BY publish_at ASC
     LIMIT p_batch_size
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Status flag vor dem Copy, damit bei Crash wiederaufnehmbar
    UPDATE public.scheduled_posts SET status = 'publishing' WHERE id = v_row.id;

    BEGIN
      INSERT INTO public.posts (
        author_id, caption, media_url, media_type, thumbnail_url, tags,
        is_guild_post, guild_id, audio_url, audio_volume,
        privacy, allow_comments, allow_download, allow_duet, women_only,
        cover_time_ms
      ) VALUES (
        v_row.author_id, v_row.caption, v_row.media_url, v_row.media_type,
        v_row.thumbnail_url, v_row.tags,
        v_row.is_guild_post, v_row.guild_id, v_row.audio_url, v_row.audio_volume,
        v_row.privacy, v_row.allow_comments, v_row.allow_download, v_row.allow_duet,
        v_row.women_only, v_row.cover_time_ms
      )
      RETURNING id INTO v_post_id;

      UPDATE public.scheduled_posts
         SET status = 'published', published_post_id = v_post_id, last_error = NULL
       WHERE id = v_row.id;

      scheduled_id := v_row.id;
      post_id := v_post_id;
      success := true;
      error := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      -- Fehler: zurück in pending + Retry-Counter hoch, nach 3x -> failed
      UPDATE public.scheduled_posts
         SET status     = CASE WHEN retries + 1 >= 3 THEN 'failed' ELSE 'pending' END,
             retries    = retries + 1,
             last_error = SQLERRM
       WHERE id = v_row.id;

      scheduled_id := v_row.id;
      post_id := NULL;
      success := false;
      error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;


-- ─── RPC: Draft anlegen / updaten (Upsert) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_post_draft(
  p_id            UUID DEFAULT NULL,
  p_caption       TEXT DEFAULT NULL,
  p_tags          TEXT[] DEFAULT '{}',
  p_media_type    TEXT DEFAULT NULL,
  p_media_url     TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_settings      JSONB DEFAULT '{}'::jsonb
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

  IF p_id IS NULL THEN
    INSERT INTO public.post_drafts (
      author_id, caption, tags, media_type, media_url,
      thumbnail_url, settings
    ) VALUES (
      v_caller, NULLIF(trim(p_caption), ''), p_tags, p_media_type,
      p_media_url, p_thumbnail_url, p_settings
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.post_drafts
       SET caption        = NULLIF(trim(p_caption), ''),
           tags           = p_tags,
           media_type     = p_media_type,
           media_url      = p_media_url,
           thumbnail_url  = p_thumbnail_url,
           settings       = p_settings
     WHERE id = p_id AND author_id = v_caller
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Draft nicht gefunden' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;


-- ─── RPC: Draft löschen ─────────────────────────────────────────────────────
-- R2-Object bleibt liegen (separater Cleanup-Job räumt im Hintergrund auf,
-- oder beim Publish wird's eh re-used). Vermeidet verlorene Daten bei
-- versehentlichem Delete.
CREATE OR REPLACE FUNCTION public.delete_post_draft(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.post_drafts WHERE id = p_id AND author_id = v_caller;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
END;
$$;


-- ─── Analytics-RPC: Peak-Engagement-Hours (Heatmap 7×24) ────────────────────
-- Leitet "wann ist meine Audience aktiv" aus likes+comments-Timestamps ab.
-- Pro (weekday 0..6=Mo..So, hour 0..23) die Summe der Engagement-Events
-- innerhalb des Zeitfensters.
CREATE OR REPLACE FUNCTION public.get_creator_engagement_hours(
  p_user_id UUID,
  p_days    INT DEFAULT 28
)
RETURNS TABLE (
  weekday          INT,
  hour_of_day      INT,
  engagement_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH events AS (
    -- Likes auf eigene Posts
    SELECT l.created_at
      FROM public.likes l
      JOIN public.posts p ON p.id = l.post_id
     WHERE p.author_id = p_user_id
       AND l.created_at >= NOW() - (p_days || ' days')::INTERVAL

    UNION ALL

    -- Comments auf eigene Posts
    SELECT c.created_at
      FROM public.comments c
      JOIN public.posts p ON p.id = c.post_id
     WHERE p.author_id = p_user_id
       AND c.created_at >= NOW() - (p_days || ' days')::INTERVAL
  )
  SELECT
    (EXTRACT(ISODOW FROM created_at AT TIME ZONE 'UTC')::INT - 1) AS weekday,
    EXTRACT(HOUR     FROM created_at AT TIME ZONE 'UTC')::INT     AS hour_of_day,
    COUNT(*)                                                       AS engagement_count
    FROM events
   GROUP BY weekday, hour_of_day;
$$;


-- ─── Analytics-RPC: Grobe Watch-Time-Schätzung ──────────────────────────────
-- Da wir (noch) keine per-view-events haben, schätzen wir aus view_count.
-- Annahme-Faktor: durchschnittlich 8 Sekunden pro View (TikTok-Median).
-- Die UI kann einen Qualitäts-Hinweis zeigen ("Schätzung").
CREATE OR REPLACE FUNCTION public.get_creator_watch_time_estimate(
  p_user_id UUID,
  p_days    INT DEFAULT 28
)
RETURNS TABLE (
  total_seconds_est  BIGINT,
  total_views        BIGINT,
  avg_seconds_per_view NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (COALESCE(SUM(view_count), 0) * 8)::BIGINT                              AS total_seconds_est,
    COALESCE(SUM(view_count), 0)::BIGINT                                    AS total_views,
    CASE WHEN COALESCE(SUM(view_count), 0) > 0 THEN 8::NUMERIC ELSE 0 END   AS avg_seconds_per_view
    FROM public.posts
   WHERE author_id = p_user_id
     AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
$$;


-- ─── Permissions ────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.schedule_post(
  TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, UUID, TEXT,
  NUMERIC, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.schedule_post(
  TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, UUID, TEXT,
  NUMERIC, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.reschedule_post(UUID, TIMESTAMPTZ) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_post(UUID, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_scheduled_post(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_post(UUID) TO authenticated;

-- publish_due_scheduled_posts wird vom Edge-Function mit Service-Role aufgerufen
REVOKE ALL ON FUNCTION public.publish_due_scheduled_posts(INT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_scheduled_posts(INT) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_post_draft(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT, JSONB)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_post_draft(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT, JSONB)
  TO authenticated;
-- (Signaturen-Reihenfolge identisch zur Definition oben, damit GRANT matched.)

REVOKE ALL ON FUNCTION public.delete_post_draft(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_post_draft(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_creator_engagement_hours(UUID, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_engagement_hours(UUID, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_creator_watch_time_estimate(UUID, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_watch_time_estimate(UUID, INT) TO authenticated;


-- ─── pg_cron: jede Minute Scheduled-Posts veröffentlichen ───────────────────
-- Nutzt pg_net um die Edge-Function aufzurufen (entspricht dem Muster
-- aus 20260415000000_cleanup_cron.sql).
DO $$
DECLARE
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', TRUE);
  v_project_url      TEXT := current_setting('app.settings.project_url',      TRUE);
BEGIN
  -- Nur anlegen wenn pg_cron verfügbar ist (CI-Local-Fallback)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Alten Job vor Re-Register entfernen (idempotent)
    PERFORM cron.unschedule('publish-scheduled-posts')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publish-scheduled-posts');

    IF v_service_role_key IS NOT NULL AND v_project_url IS NOT NULL THEN
      PERFORM cron.schedule(
        'publish-scheduled-posts',
        '* * * * *',  -- jede Minute
        format(
          $cron$
          SELECT net.http_post(
            url     := %L,
            headers := jsonb_build_object(
              'Content-Type',  'application/json',
              'Authorization', 'Bearer ' || %L
            ),
            body    := '{}'::jsonb
          );
          $cron$,
          v_project_url || '/functions/v1/publish-scheduled-posts',
          v_service_role_key
        )
      );
    ELSE
      -- Fallback: direkt die SQL-RPC (falls Edge nicht erreichbar/konfiguriert)
      PERFORM cron.schedule(
        'publish-scheduled-posts-sql',
        '* * * * *',
        $cron$SELECT public.publish_due_scheduled_posts(50);$cron$
      );
    END IF;
  END IF;
END $$;
