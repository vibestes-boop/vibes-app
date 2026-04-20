-- ================================================================
-- v1.22.0 — Live-Stickers (Host platziert Emojis frei im Stream)
-- ================================================================
-- Host platziert Emoji-Stickers während eines Live-Streams.
-- Sticker werden an (x, y) positioniert, können verschoben oder
-- entfernt werden. Viewer sehen alle Platzierungen live via
-- Realtime (postgres_changes).
--
-- Design:
--   • Nur Host einer Session darf Sticker anlegen/moven/löschen
--   • Alle authentifizierten User dürfen alle Sticker lesen
--   • removed_at = Soft-Delete (für History/Replay)
--   • Realtime für alle drei Events (INSERT/UPDATE/DELETE)
-- ================================================================

-- ─── 1. live_stickers ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_stickers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 32),
  position_x  REAL NOT NULL DEFAULT 40,
  position_y  REAL NOT NULL DEFAULT 180,
  scale       REAL NOT NULL DEFAULT 1.0 CHECK (scale BETWEEN 0.3 AND 3.0),
  rotation    REAL NOT NULL DEFAULT 0.0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_live_stickers_session_active
  ON public.live_stickers (session_id, created_at DESC)
  WHERE removed_at IS NULL;

-- Trigger: updated_at automatisch setzen
CREATE OR REPLACE FUNCTION public._set_live_stickers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_live_stickers_updated_at ON public.live_stickers;
CREATE TRIGGER trg_live_stickers_updated_at
  BEFORE UPDATE ON public.live_stickers
  FOR EACH ROW EXECUTE FUNCTION public._set_live_stickers_updated_at();

ALTER TABLE public.live_stickers ENABLE ROW LEVEL SECURITY;

-- Idempotent: alte Policies droppen, bevor neu angelegt wird
DROP POLICY IF EXISTS "live_stickers_select" ON public.live_stickers;
DROP POLICY IF EXISTS "live_stickers_insert" ON public.live_stickers;
DROP POLICY IF EXISTS "live_stickers_update" ON public.live_stickers;
DROP POLICY IF EXISTS "live_stickers_delete" ON public.live_stickers;

-- Alle authentifizierten User dürfen Sticker lesen (für Viewer-Rendering)
CREATE POLICY "live_stickers_select"
  ON public.live_stickers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Nur der Host der Session darf Sticker anlegen
CREATE POLICY "live_stickers_insert"
  ON public.live_stickers FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1 FROM public.live_sessions s
       WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

-- Nur der Host darf seine eigenen Sticker moven/entfernen
CREATE POLICY "live_stickers_update"
  ON public.live_stickers FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "live_stickers_delete"
  ON public.live_stickers FOR DELETE
  USING (auth.uid() = host_id);

-- Realtime für alle Sticker-Events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_stickers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stickers;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Live-Stickers deployed (v1.22.0)';
END $$;
