-- ────────────────────────────────────────────────────────────────────────────
-- Migration: pinned_posts
-- Führe aus in: Supabase Dashboard → SQL Editor
-- ────────────────────────────────────────────────────────────────────────────

-- 1. is_pinned Spalte zu posts hinzufügen
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- 2. Index für schnelle Profil-Abfrage (pinned zuerst)
CREATE INDEX IF NOT EXISTS posts_author_pinned_idx
  ON public.posts(author_id, is_pinned DESC, created_at DESC);

-- 3. Funktion: setzt is_pinned für einen Post, entfernt Pin von allen anderen
--    des gleichen Autors (max 1 pinned Post pro User)
CREATE OR REPLACE FUNCTION public.toggle_pin_post(p_post_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_currently_pinned boolean;
BEGIN
  -- Aktuellen Status ermitteln
  SELECT is_pinned INTO v_currently_pinned
  FROM public.posts
  WHERE id = p_post_id AND author_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post nicht gefunden oder kein Zugriff';
  END IF;

  -- Alle Pins dieses Users entfernen
  UPDATE public.posts
  SET is_pinned = false
  WHERE author_id = p_user_id AND is_pinned = true;

  -- Wenn vorher nicht gepinnt → jetzt pinnen
  IF NOT v_currently_pinned THEN
    UPDATE public.posts
    SET is_pinned = true
    WHERE id = p_post_id AND author_id = p_user_id;
  END IF;
END;
$$;
