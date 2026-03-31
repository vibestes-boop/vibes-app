-- ────────────────────────────────────────────────────────────────────────────
-- Migration: comment_likes
-- Führe aus in: Supabase Dashboard → SQL Editor
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS comment_likes_comment_idx ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_idx    ON public.comment_likes(user_id);

-- RLS
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_likes_select"
  ON public.comment_likes FOR SELECT USING (true);

CREATE POLICY "comment_likes_insert"
  ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comment_likes_delete"
  ON public.comment_likes FOR DELETE
  USING (auth.uid() = user_id);
