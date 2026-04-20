-- ================================================================
-- Hotfix: messages.msg_update Policy zu permissiv
-- Audit-Finding 3.3 — Conversation-Teilnehmer konnten Nachrichten
--                     anderer Teilnehmer editieren (read-/content-
--                     Manipulation), da WITH CHECK fehlte.
-- ================================================================
--
-- Vorher: USING = "bist du Teilnehmer der Conversation?"
-- Nachher: nur der Sender darf eigene Nachrichten ändern, UND der
--          neue Row-Zustand muss weiterhin vom Sender sein
--          (verhindert Owner-Switch via UPDATE).
-- ================================================================

DROP POLICY IF EXISTS "msg_update" ON public.messages;

CREATE POLICY "msg_update" ON public.messages
  FOR UPDATE
  USING      (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- ─── Read-Receipt Sonderfall ─────────────────────────────────────
-- Bisher wurde `read = true` vermutlich vom EMPFÄNGER gesetzt. Mit der
-- neuen Policy geht das nicht mehr direkt. Wir stellen eine RPC bereit,
-- die nur die `read`-Spalte und nur vom Empfänger gekippt werden kann.
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Nur Nachrichten in Conversations, wo User Teilnehmer ist,
  -- und nur Nachrichten, die NICHT von ihm selbst stammen.
  UPDATE public.messages m
     SET read = true
    FROM public.conversations c
   WHERE m.conversation_id = c.id
     AND m.conversation_id = p_conversation_id
     AND m.sender_id <> v_user_id
     AND m.read = false
     AND (c.participant_1 = v_user_id OR c.participant_2 = v_user_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;

-- ─── Verifikation ────────────────────────────────────────────────
-- SELECT polname, polcmd,
--        pg_get_expr(polqual,     polrelid) AS using_expr,
--        pg_get_expr(polwithcheck, polrelid) AS check_expr
--   FROM pg_policy
--  WHERE polrelid = 'public.messages'::regclass
--    AND polname  = 'msg_update';
-- → using_expr = "(auth.uid() = sender_id)"
-- → check_expr = "(auth.uid() = sender_id)"
