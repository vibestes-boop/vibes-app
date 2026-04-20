-- ============================================================================
-- 20260418080000_live_clip_markers.sql
--
-- v1.18.0 — Live-Clips: Marker-System.
--
-- Viewer + Host können während des Streams einen Moment markieren
-- („Clip it!"). Die Marker sind nach Stream-Ende im Creator-Studio sichtbar
-- und öffnen das Replay an genau dieser Zeitmarke.
--
-- V2 wird aus den Markern automatisch Clip-Dateien über LiveKit-Egress
-- generieren. In v1.18.0 reichen die Marker als Engagement-Signal und
-- zur zeitpunkt-basierten Replay-Navigation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.live_clip_markers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  -- Sekunden seit Stream-Start (nicht Unix-Timestamp) — direkt für Seek nutzbar.
  ts_secs     INT NOT NULL CHECK (ts_secs >= 0 AND ts_secs <= 86400),
  -- Optionaler Grund (Emoji/Kurznotiz). Freiwillig.
  note        TEXT CHECK (note IS NULL OR char_length(note) <= 140),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate-Limit: ein User kann pro Session + gleicher Sekunde nur einen Marker
CREATE UNIQUE INDEX IF NOT EXISTS uq_clip_marker_session_user_ts
  ON public.live_clip_markers(session_id, user_id, ts_secs);

CREATE INDEX IF NOT EXISTS idx_clip_markers_session
  ON public.live_clip_markers(session_id, ts_secs);

CREATE INDEX IF NOT EXISTS idx_clip_markers_user
  ON public.live_clip_markers(user_id, created_at DESC);

-- RLS
ALTER TABLE public.live_clip_markers ENABLE ROW LEVEL SECURITY;

-- Jeder Authenticated User darf für Sessions markern, die er sehen kann.
DROP POLICY IF EXISTS "clip_markers_insert" ON public.live_clip_markers;
CREATE POLICY "clip_markers_insert"
  ON public.live_clip_markers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Host sieht alle Marker seiner Session, andere nur eigene
DROP POLICY IF EXISTS "clip_markers_select" ON public.live_clip_markers;
CREATE POLICY "clip_markers_select"
  ON public.live_clip_markers FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT host_id FROM public.live_sessions WHERE id = session_id)
  );

DROP POLICY IF EXISTS "clip_markers_delete_own" ON public.live_clip_markers;
CREATE POLICY "clip_markers_delete_own"
  ON public.live_clip_markers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- View: Marker-Aggregation für Creator-Studio
-- (mit Hotness-Score: Anzahl Marker in 15s-Fenster um jeden Marker)
CREATE OR REPLACE VIEW public.live_clip_markers_hot AS
SELECT
  m.session_id,
  m.ts_secs / 15 AS bucket_15s,
  MIN(m.ts_secs) AS window_start,
  MAX(m.ts_secs) AS window_end,
  COUNT(*)::INT  AS marker_count,
  ARRAY_AGG(DISTINCT m.user_id) AS user_ids
FROM public.live_clip_markers m
GROUP BY m.session_id, (m.ts_secs / 15);

GRANT SELECT ON public.live_clip_markers_hot TO authenticated;

NOTIFY pgrst, 'reload schema';
