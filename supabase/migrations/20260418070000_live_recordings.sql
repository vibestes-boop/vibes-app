-- ============================================================================
-- 20260418070000_live_recordings.sql
--
-- v1.18.0 — Live-Replay / VOD (Recording + Playback)
--
-- Speichert Aufnahmen abgeschlossener Live-Sessions:
--   • Trigger via LiveKit Egress (Edge Function `livekit-egress`)
--   • Datei landet in Supabase-Storage Bucket `live-recordings`
--   • Webhook von LiveKit → Edge Function aktualisiert `status` + `file_url`
--   • Viewer können das Replay öffnen (`app/live/replay/[id].tsx`)
--   • Creator-Studio zeigt Replay-Buttons in Live-History
-- ============================================================================

-- ── Storage-Bucket ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'live-recordings',
  'live-recordings',
  TRUE,
  -- 2 GB Hardlimit pro Datei (~ 4-5h Stream bei mittlerer Bitrate)
  2147483648,
  ARRAY['video/mp4', 'video/webm', 'application/octet-stream', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Public Read (Replays sind öffentlich abspielbar)
DROP POLICY IF EXISTS "live_recordings_public_read" ON storage.objects;
CREATE POLICY "live_recordings_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'live-recordings');

-- Service-Role kann uploaden (Egress über Service-Role-Key)
-- Auth User können keine Replays direkt uploaden — nur via Edge Function.
DROP POLICY IF EXISTS "live_recordings_authenticated_upload" ON storage.objects;
CREATE POLICY "live_recordings_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'live-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── live_recordings Tabelle ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_recordings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- LiveKit Egress Identifikator (für Status-Updates via Webhook)
  egress_id       TEXT,

  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'recording', 'processing', 'ready', 'failed')),
  error_message   TEXT,

  -- Resultierende Datei
  file_url        TEXT,                   -- Public URL im live-recordings Bucket
  file_path       TEXT,                   -- Pfad innerhalb des Buckets (zum Löschen)
  file_size_bytes BIGINT,
  duration_secs   INT,
  thumbnail_url   TEXT,                   -- Auto-Thumb (optional, später)

  -- Sichtbarkeit
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Stats
  view_count      INT NOT NULL DEFAULT 0,

  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eine Session hat höchstens eine Recording-Reihe (Egress endet mit Stream)
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_recordings_session
  ON public.live_recordings(session_id);

CREATE INDEX IF NOT EXISTS idx_live_recordings_host
  ON public.live_recordings(host_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_recordings_status
  ON public.live_recordings(status)
  WHERE status IN ('ready', 'recording');

-- ── live_sessions: Recording-Spalten ────────────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES public.live_recordings(id)
    ON DELETE SET NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;

-- Public Lese-Zugriff für ready + is_public
DROP POLICY IF EXISTS "live_recordings_select_public" ON public.live_recordings;
CREATE POLICY "live_recordings_select_public"
  ON public.live_recordings FOR SELECT
  USING (status = 'ready' AND is_public = TRUE);

-- Host darf eigene Recordings IMMER sehen (auch processing/failed)
DROP POLICY IF EXISTS "live_recordings_select_own" ON public.live_recordings;
CREATE POLICY "live_recordings_select_own"
  ON public.live_recordings FOR SELECT
  USING (auth.uid() = host_id);

-- Host darf eigene Recordings updaten (z.B. is_public toggeln, löschen-Marker)
DROP POLICY IF EXISTS "live_recordings_update_own" ON public.live_recordings;
CREATE POLICY "live_recordings_update_own"
  ON public.live_recordings FOR UPDATE
  USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "live_recordings_delete_own" ON public.live_recordings;
CREATE POLICY "live_recordings_delete_own"
  ON public.live_recordings FOR DELETE
  USING (auth.uid() = host_id);

-- Inserts erfolgen ausschließlich via Service-Role (Edge Function)
-- → keine INSERT-Policy für authenticated.

-- ── View-Count RPC (atomar) ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_live_recording_views(p_recording_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_recordings
  SET view_count = view_count + 1
  WHERE id = p_recording_id
    AND status = 'ready'
    AND is_public = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_live_recording_views(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_live_recording_views(UUID) TO authenticated, anon;

-- ── Trigger: wenn Recording ready → live_sessions.replay_url aktualisieren ──
-- Das bestehende Replay-System (app/live/replays.tsx, watch/[id].tsx?isReplay=1)
-- liest `live_sessions.replay_url` + `is_replayable`. Wir spiegeln unsere
-- live_recordings-Zeile dorthin, damit beide Systeme nahtlos zusammenspielen.
CREATE OR REPLACE FUNCTION public._sync_recording_to_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ready' AND NEW.file_url IS NOT NULL AND NEW.is_public THEN
    UPDATE public.live_sessions
    SET replay_url    = NEW.file_url,
        thumbnail_url = COALESCE(NEW.thumbnail_url, thumbnail_url),
        is_replayable = TRUE
    WHERE id = NEW.session_id;
  ELSIF NEW.status IN ('failed') OR NEW.is_public = FALSE THEN
    -- Recording wurde privat gemacht oder ist fehlgeschlagen → replay_url entfernen
    UPDATE public.live_sessions
    SET is_replayable = FALSE
    WHERE id = NEW.session_id
      AND (replay_url = NEW.file_url OR replay_url IS NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_recording_to_session ON public.live_recordings;
CREATE TRIGGER trg_sync_recording_to_session
  AFTER INSERT OR UPDATE ON public.live_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_recording_to_session();

-- Auch Delete: replay_url zurücksetzen
CREATE OR REPLACE FUNCTION public._clear_replay_on_recording_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_sessions
  SET replay_url = NULL, is_replayable = FALSE
  WHERE id = OLD.session_id
    AND replay_url = OLD.file_url;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_replay_on_recording_delete ON public.live_recordings;
CREATE TRIGGER trg_clear_replay_on_recording_delete
  AFTER DELETE ON public.live_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public._clear_replay_on_recording_delete();

-- ── Realtime ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_recordings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_recordings;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
