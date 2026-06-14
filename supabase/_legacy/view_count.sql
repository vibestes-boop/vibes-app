-- ================================================
-- VIBES APP – Post View Count
-- Im Supabase SQL Editor ausführen
-- ================================================

-- Spalte hinzufügen (idempotent)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Index für schnelle Sortierung nach Views
CREATE INDEX IF NOT EXISTS idx_posts_view_count ON public.posts(view_count DESC);

-- RPC: View inkrementieren (Security Definer → kein RLS-Konflikt)
-- Jeder authentifizierte User darf aufrufen; duplikate Calls pro Session
-- werden im Frontend verhindert (viewedPosts Set).
CREATE OR REPLACE FUNCTION increment_post_view(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.posts
     SET view_count = view_count + 1
   WHERE id = p_post_id;
END;
$$;
