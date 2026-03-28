-- ============================================================
-- Live Studio – Datenbankschema
-- In Supabase SQL-Editor ausführen
-- ============================================================

-- Live-Sessions
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'ended')),
  viewer_count  INT NOT NULL DEFAULT 0,
  peak_viewers  INT NOT NULL DEFAULT 0,
  room_name     TEXT UNIQUE,              -- LiveKit Room Name (spätere Phase)
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_host   ON public.live_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);

-- RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_sessions_select" ON public.live_sessions
  FOR SELECT USING (true);

CREATE POLICY "live_sessions_insert" ON public.live_sessions
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "live_sessions_update" ON public.live_sessions
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "live_sessions_delete" ON public.live_sessions
  FOR DELETE USING (auth.uid() = host_id);

-- ──────────────────────────────────────────────────────────────────
-- Live-Kommentare (Supabase Realtime enabled)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text        TEXT NOT NULL CHECK (char_length(text) <= 300),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_comments_session ON public.live_comments(session_id, created_at DESC);

ALTER TABLE public.live_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_comments_select" ON public.live_comments
  FOR SELECT USING (true);

CREATE POLICY "live_comments_insert" ON public.live_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "live_comments_delete" ON public.live_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Realtime aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_comments;

-- ──────────────────────────────────────────────────────────────────
-- Live-Reaktionen (floatende Emojis)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL CHECK (emoji IN ('❤️','🔥','👏','😱','💜')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_reactions_session ON public.live_reactions(session_id, created_at DESC);

ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_reactions_select" ON public.live_reactions
  FOR SELECT USING (true);

CREATE POLICY "live_reactions_insert" ON public.live_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Realtime aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;

-- ──────────────────────────────────────────────────────────────────
-- Zuschauer-Zähler RPC
-- ──────────────────────────────────────────────────────────────────
-- join/leave: kein Auth-Check nötig (nur Zähler), SECURITY INVOKER reicht
CREATE OR REPLACE FUNCTION public.join_live_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public AS $$
BEGIN
  UPDATE public.live_sessions
  SET
    viewer_count = viewer_count + 1,
    peak_viewers = GREATEST(peak_viewers, viewer_count + 1)
  WHERE id = p_session_id AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_live_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public AS $$
BEGIN
  UPDATE public.live_sessions
  SET viewer_count = GREATEST(0, viewer_count - 1)
  WHERE id = p_session_id AND status = 'active';
END;
$$;

-- end: SECURITY DEFINER + search_path damit auth.uid() zuverlässig funktioniert
CREATE OR REPLACE FUNCTION public.end_live_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth AS $$
BEGIN
  UPDATE public.live_sessions
  SET status = 'ended', ended_at = NOW(), viewer_count = 0
  WHERE id = p_session_id AND host_id = auth.uid();
END;
$$;
