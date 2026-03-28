-- RLS: Autoren dürfen eigene Posts updaten und löschen
-- (Falls noch nicht vorhanden – safe to re-run)

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Lesen: alle
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='posts' AND policyname='posts_select'
  ) THEN
    CREATE POLICY "posts_select" ON public.posts FOR SELECT USING (true);
  END IF;
END $$;

-- Erstellen: nur eigene
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='posts' AND policyname='posts_insert'
  ) THEN
    CREATE POLICY "posts_insert" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;

-- Bearbeiten: nur Autor
DROP POLICY IF EXISTS "posts_update" ON public.posts;
CREATE POLICY "posts_update" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Löschen: nur Autor
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);
