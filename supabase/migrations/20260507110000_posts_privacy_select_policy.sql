-- Harden post read visibility.
--
-- The original select policy only guarded women_only posts. The app already
-- stores privacy = public/friends/private and most feeds filter public rows,
-- but direct reads by id/profile RPCs must also be protected at RLS level.

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_with_women_only" ON public.posts;

CREATE POLICY "posts_select_public_friends_private"
  ON public.posts FOR SELECT
  USING (
    author_id = auth.uid()
    OR (
      COALESCE(privacy, 'public') = 'public'
      AND (
        COALESCE(women_only, false) = false
        OR public.is_women_only_verified()
      )
    )
    OR (
      COALESCE(privacy, 'public') = 'friends'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.follows f
        WHERE f.follower_id = auth.uid()
          AND f.following_id = posts.author_id
      )
      AND (
        COALESCE(women_only, false) = false
        OR public.is_women_only_verified()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_posts_author_privacy_visible
  ON public.posts (author_id, privacy, created_at DESC, id DESC)
  WHERE women_only = false;
