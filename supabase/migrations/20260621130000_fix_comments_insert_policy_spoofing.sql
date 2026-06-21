-- 🟠 SECURITY-FIX — doppelte INSERT-Policy auf comments zusammenführen
--
-- Problem: Auf public.comments lagen ZWEI permissive INSERT-Policies. Permissive
-- Policies werden OR-verknüpft → es reicht, wenn EINE zutrifft.
--
--   comments_insert        : WITH CHECK (post existiert AND (kein Guild-Post OR Mitglied))
--                            → KEIN auth.uid() = user_id, KEINE allow_comments-Prüfung,
--                              KEINE TO-Klausel.
--   comments_insert_policy : TO authenticated
--                            WITH CHECK (auth.uid() = user_id AND post existiert
--                                        AND (allow_comments OR Autor))
--
-- Weil die erste Policy weder den Autor-Invariant noch allow_comments prüft, konnte
-- ein Nutzer:
--   (a) Kommentare mit FREMDER user_id einfügen (Impersonation), und
--   (b) auf Posts kommentieren, bei denen der Autor Kommentare deaktiviert hat
--       (allow_comments = false wurde über die OR-Verknüpfung umgangen).
--
-- Fix: beide Policies droppen und durch EINE korrekte ersetzen, die ALLE Invarianten
-- gleichzeitig erzwingt (Author-Identity + allow_comments/Autor + Guild-Mitgliedschaft).

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_policy" ON public.comments;

CREATE POLICY "comments_insert_policy" ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = comments.post_id
        -- Kommentare nur erlaubt, wenn der Post sie zulässt (oder man selbst Autor ist)
        AND (COALESCE(p.allow_comments, true) = true OR p.author_id = auth.uid())
        -- Guild-Posts: nur Mitglieder der Guild dürfen kommentieren
        AND (
          p.is_guild_post = false
          OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.guild_id = p.guild_id
          )
        )
    )
  );

DO $$ BEGIN
  RAISE NOTICE '🔒 comments-INSERT vereinheitlicht: auth.uid()=user_id + allow_comments + Guild-Gate';
END $$;
