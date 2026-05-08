-- Fast shell badge counters for Web.
--
-- The global header, desktop sidebar, and mobile tab bar only need tiny unread
-- counts. Loading full conversations for the DM badge made every logged-in page
-- poll an expensive RPC. This function returns both counts in one cheap call.

CREATE INDEX IF NOT EXISTS idx_messages_unread_by_conversation
  ON public.messages (conversation_id, sender_id)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id, read)
  WHERE read = false;

CREATE OR REPLACE FUNCTION public.get_unread_shell_counts()
RETURNS TABLE (
  unread_dms bigint,
  unread_notifications bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT auth.uid() AS id
  )
  SELECT
    COALESCE((
      SELECT COUNT(*)
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      JOIN viewer v ON v.id IS NOT NULL
      WHERE m.read = false
        AND m.sender_id <> v.id
        AND (c.participant_1 = v.id OR c.participant_2 = v.id)
    ), 0)::bigint AS unread_dms,
    COALESCE((
      SELECT COUNT(*)
      FROM public.notifications n
      JOIN viewer v ON v.id IS NOT NULL
      WHERE n.recipient_id = v.id
        AND n.read = false
    ), 0)::bigint AS unread_notifications;
$$;

REVOKE ALL ON FUNCTION public.get_unread_shell_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_shell_counts() TO authenticated;
