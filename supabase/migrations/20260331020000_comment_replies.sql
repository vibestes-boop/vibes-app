-- ── Comment Replies (Threaded Comments) ──────────────────────────────────────
-- Adds parent_id to comments table to support one level of threading.
-- Only one level deep (replies to replies are shown flat under the parent).

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Index for fast reply lookups
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);

-- View: comments with reply count (helper for UI)
-- Not strictly needed but useful
COMMENT ON COLUMN public.comments.parent_id IS 'If set, this comment is a reply to the comment with this id. Max one level deep.';
