-- Live chat UI reads `live_comments.pinned` for pinned/moderated comment state.
-- Older databases only had `live_sessions.pinned_comment`, which makes comment
-- inserts/reads fail with "column live_comments.pinned does not exist".

ALTER TABLE public.live_comments
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_live_comments_session_pinned_created
  ON public.live_comments (session_id, pinned DESC, created_at DESC);
