-- ============================================================================
-- Block-Durchsetzung (Apple 1.2 "block abusive users" + echte Sicherheit).
--
-- Bisher schrieb block_user() nur einen Eintrag in user_blocks, ohne dass
-- irgendetwas ihn durchsetzte: geblockte Nutzer konnten weiter folgen, DMs
-- schreiben, kommentieren und Inhalte sehen. Diese Migration setzt Blocks
-- serverseitig auf allen Write-Pfaden durch (Follow/DM/Kommentar) und stellt
-- eine RPC bereit, mit der der Client Feed/Kommentare beidseitig ausblendet.
--
-- Bewusst KEINE Änderung an get_vibe_feed (v5-Algorithmus): der Client filtert
-- die geblockten Autoren via get_blocked_user_ids() heraus — kein Risiko, den
-- komplexen Feed-RPC beim Umschreiben zu beschädigen.
-- ============================================================================

-- 1) Helper: sind zwei User in IRGENDEINE Richtung geblockt?
CREATE OR REPLACE FUNCTION public.users_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
     WHERE (blocker_id = a AND blocked_id = b)
        OR (blocker_id = b AND blocked_id = a)
  );
$$;
REVOKE ALL ON FUNCTION public.users_blocked(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.users_blocked(uuid, uuid) TO authenticated;

-- 2) Alle User-IDs, mit denen der aktuelle User eine Block-Beziehung hat
--    (beide Richtungen). RLS auf user_blocks lässt den Client nur die selbst
--    gesetzten Blocks sehen — diese SECURITY-DEFINER-RPC deckt auch "hat mich
--    geblockt" ab, ohne die Block-Zeilen selbst preiszugeben (nur IDs).
CREATE OR REPLACE FUNCTION public.get_blocked_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT blocked_id FROM user_blocks WHERE blocker_id = auth.uid()
  UNION
  SELECT blocker_id FROM user_blocks WHERE blocked_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_blocked_user_ids() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_blocked_user_ids() TO authenticated;

-- 3) block_user() erweitert: zusätzlich bestehende gegenseitige Follows lösen.
--    (Ein bloßer user_blocks-Eintrag ließ einen bestehenden Follow bestehen.)
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_blocked_id = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT DO NOTHING;

  -- Bestehende Follows in BEIDE Richtungen entfernen.
  DELETE FROM follows
   WHERE (follower_id = auth.uid()   AND following_id = p_blocked_id)
      OR (follower_id = p_blocked_id AND following_id = auth.uid());
END;
$$;

-- 4) Trigger: kein Follow zwischen geblockten Usern.
CREATE OR REPLACE FUNCTION public.enforce_follow_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.users_blocked(NEW.follower_id, NEW.following_id) THEN
    RAISE EXCEPTION 'blocked' USING HINT = 'blocked';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_follow_not_blocked ON public.follows;
CREATE TRIGGER trg_follow_not_blocked
  BEFORE INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.enforce_follow_not_blocked();

-- 5) Trigger: keine neue Konversation zwischen geblockten Usern.
CREATE OR REPLACE FUNCTION public.enforce_conversation_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.users_blocked(NEW.participant_1, NEW.participant_2) THEN
    RAISE EXCEPTION 'blocked' USING HINT = 'blocked';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conversation_not_blocked ON public.conversations;
CREATE TRIGGER trg_conversation_not_blocked
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conversation_not_blocked();

-- 6) Trigger: keine DM in eine Konversation, deren Teilnehmer sich geblockt
--    haben (deckt den Fall "Block NACH bestehender Konversation" ab).
CREATE OR REPLACE FUNCTION public.enforce_message_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p1 uuid;
  p2 uuid;
BEGIN
  SELECT participant_1, participant_2 INTO p1, p2
    FROM conversations WHERE id = NEW.conversation_id;
  IF p1 IS NOT NULL AND public.users_blocked(p1, p2) THEN
    RAISE EXCEPTION 'blocked' USING HINT = 'blocked';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_message_not_blocked ON public.messages;
CREATE TRIGGER trg_message_not_blocked
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_not_blocked();

-- 7) Trigger: geblockter User darf nicht auf Posts des Autors kommentieren
--    (und umgekehrt). Greift egal ob der Kommentar via RPC oder direktem
--    Insert entsteht.
CREATE OR REPLACE FUNCTION public.enforce_comment_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND public.users_blocked(NEW.user_id, v_author) THEN
    RAISE EXCEPTION 'blocked' USING HINT = 'blocked';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_comment_not_blocked ON public.comments;
CREATE TRIGGER trg_comment_not_blocked
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_not_blocked();
