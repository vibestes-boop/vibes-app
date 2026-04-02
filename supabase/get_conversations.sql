-- ============================================================
-- RPC: get_conversations
-- Ersetzt N+2 separate Queries durch einen einzigen DB-Call.
-- Gibt alle Konversationen des eingeloggten Users zurück,
-- inklusive: anderer Teilnehmer, letzte Nachricht, Ungelesen-Zähler.
-- ============================================================

CREATE OR REPLACE FUNCTION get_conversations()
RETURNS TABLE (
  id                uuid,
  other_user_id     uuid,
  other_username    text,
  other_avatar_url  text,
  last_message      text,
  last_message_at   timestamptz,
  unread_count      bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH my_convs AS (
    -- Alle Konversationen des eingeloggten Users
    SELECT
      c.id,
      c.last_message_at,
      CASE WHEN c.participant_1 = auth.uid() THEN c.participant_2
           ELSE c.participant_1
      END AS other_user_id
    FROM conversations c
    WHERE c.participant_1 = auth.uid()
       OR c.participant_2 = auth.uid()
  ),

  last_msgs AS (
    -- Letzte Nachricht pro Konversation (1 Query für alle)
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content AS last_message
    FROM messages m
    WHERE m.conversation_id IN (SELECT id FROM my_convs)
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    -- Ungelesene Nachrichten pro Konversation (1 Query für alle)
    SELECT
      m.conversation_id,
      COUNT(*) AS unread_count
    FROM messages m
    WHERE m.conversation_id IN (SELECT id FROM my_convs)
      AND m.read = false
      AND m.sender_id != auth.uid()
    GROUP BY m.conversation_id
  )
  SELECT
    mc.id,
    mc.other_user_id,
    p.username       AS other_username,
    p.avatar_url     AS other_avatar_url,
    lm.last_message,
    mc.last_message_at,
    COALESCE(uc.unread_count, 0) AS unread_count
  FROM my_convs mc
  LEFT JOIN profiles        p  ON p.id  = mc.other_user_id
  LEFT JOIN last_msgs       lm ON lm.conversation_id = mc.id
  LEFT JOIN unread_counts   uc ON uc.conversation_id = mc.id
  ORDER BY mc.last_message_at DESC NULLS LAST;
$$;

-- Rechte: nur eingeloggte User dürfen aufrufen
REVOKE ALL ON FUNCTION get_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_conversations() TO authenticated;
