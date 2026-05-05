-- Harden comment inserts so the web server action can rely on RLS instead of
-- doing a separate posts.check roundtrip before every comment insert.

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Older setup scripts created this permissive policy. RLS policies are ORed, so
-- it must be removed or it would still allow comments on disabled posts.
DROP POLICY IF EXISTS "Eingeloggte User können kommentieren" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_policy" ON public.comments;

CREATE POLICY "comments_insert_policy"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND (
          COALESCE(p.allow_comments, true) = true
          OR p.author_id = auth.uid()
        )
    )
  );
