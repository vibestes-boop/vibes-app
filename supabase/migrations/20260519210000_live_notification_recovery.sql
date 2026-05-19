-- Push/Feed recovery for Live notification backlogs.
--
-- Goals:
-- - Prevent inactive accounts from accumulating unlimited live-notification
--   unread backlog.
-- - Keep fan-out behavior for active users.
-- - Provide an admin/operator dry-run recovery RPC for old live notifications.
--
-- No recipient ids, tokens, or notification contents are exposed by public
-- health snapshots. The recovery RPC requires service_role/admin/operator.

CREATE INDEX IF NOT EXISTS idx_notifications_live_unread_recipient_sender
  ON public.notifications (recipient_id, sender_id, created_at DESC)
  WHERE read = false
    AND type IN ('live', 'scheduled_live_reminder');

CREATE INDEX IF NOT EXISTS idx_notifications_live_unread_age
  ON public.notifications (created_at)
  WHERE read = false
    AND type IN ('live', 'scheduled_live_reminder');

CREATE OR REPLACE FUNCTION public.notify_followers_on_go_live()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count int;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Anti-spam: host has pushed recently. Covers reconnects/restarts.
  SELECT COUNT(*) INTO v_recent_count
    FROM public.notifications
   WHERE sender_id = NEW.host_id
     AND type = 'live'
     AND created_at > NOW() - INTERVAL '30 minutes';

  IF v_recent_count > 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    sender_id,
    type,
    session_id,
    comment_text,
    created_at
  )
  SELECT
    f.follower_id,
    NEW.host_id,
    'live',
    NEW.id,
    NEW.title,
    NOW()
  FROM public.follows f
  WHERE f.following_id = NEW.host_id
    AND f.follower_id <> NEW.host_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.muted_live_hosts m
      WHERE m.user_id = f.follower_id
        AND m.host_id = NEW.host_id
    )
    -- If the same recipient has not opened a recent live notification from
    -- this host, a new one adds badge pressure without adding value.
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.recipient_id = f.follower_id
        AND n.sender_id = NEW.host_id
        AND n.type = 'live'
        AND n.read = false
        AND n.created_at > NOW() - INTERVAL '7 days'
    )
    -- Backlog cap: users with a large unread live queue do not receive more
    -- live pings until they return and clear/open notifications.
    AND (
      SELECT COUNT(*)
      FROM public.notifications n
      WHERE n.recipient_id = f.follower_id
        AND n.type IN ('live', 'scheduled_live_reminder')
        AND n.read = false
        AND n.created_at > NOW() - INTERVAL '30 days'
    ) < 100;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followers_on_go_live ON public.live_sessions;
CREATE TRIGGER trg_notify_followers_on_go_live
  AFTER INSERT ON public.live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followers_on_go_live();

CREATE OR REPLACE FUNCTION public.mark_due_scheduled_lives_reminded(
  p_batch_size INT DEFAULT 50
)
RETURNS TABLE(
  scheduled_live_id UUID,
  host_id           UUID,
  notified_count    INT,
  success           BOOLEAN,
  error             TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       public.scheduled_lives%ROWTYPE;
  v_count     INT;
BEGIN
  FOR v_row IN
    SELECT *
      FROM public.scheduled_lives
     WHERE status = 'scheduled'
       AND scheduled_at <= NOW() + INTERVAL '15 minutes'
       AND scheduled_at > NOW() - INTERVAL '1 hour'
     ORDER BY scheduled_at ASC
     LIMIT p_batch_size
     FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.scheduled_lives
         SET status      = 'reminded',
             reminded_at = NOW()
       WHERE id = v_row.id;

      WITH inserted AS (
        INSERT INTO public.notifications (
          recipient_id,
          sender_id,
          type,
          session_id,
          comment_text
        )
        SELECT
          f.follower_id,
          v_row.host_id,
          'scheduled_live_reminder',
          NULL,
          v_row.title
        FROM public.follows f
        WHERE f.following_id = v_row.host_id
          AND f.follower_id <> v_row.host_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.muted_live_hosts m
            WHERE m.user_id = f.follower_id
              AND m.host_id = v_row.host_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.notifications n
            WHERE n.recipient_id = f.follower_id
              AND n.sender_id = v_row.host_id
              AND n.type IN ('live', 'scheduled_live_reminder')
              AND n.read = false
              AND n.created_at > NOW() - INTERVAL '7 days'
          )
          AND (
            SELECT COUNT(*)
            FROM public.notifications n
            WHERE n.recipient_id = f.follower_id
              AND n.type IN ('live', 'scheduled_live_reminder')
              AND n.read = false
              AND n.created_at > NOW() - INTERVAL '30 days'
          ) < 100
        RETURNING 1
      )
      SELECT COUNT(*)::INT INTO v_count FROM inserted;

      scheduled_live_id := v_row.id;
      host_id           := v_row.host_id;
      notified_count    := v_count;
      success           := true;
      error             := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      scheduled_live_id := v_row.id;
      host_id           := v_row.host_id;
      notified_count    := 0;
      success           := false;
      error             := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.live_notification_backlog_recovery(
  p_older_than_days INT DEFAULT 30,
  p_limit INT DEFAULT 500,
  p_execute BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INT := GREATEST(1, LEAST(COALESCE(p_older_than_days, 30), 365));
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000));
  v_matched INT := 0;
  v_updated INT := 0;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin() OR public.can_operate()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH candidates AS (
    SELECT id
    FROM public.notifications
    WHERE read = false
      AND type IN ('live', 'scheduled_live_reminder')
      AND created_at < NOW() - make_interval(days => v_days)
    ORDER BY created_at ASC
    LIMIT v_limit
  )
  SELECT COUNT(*)::INT INTO v_matched FROM candidates;

  IF p_execute THEN
    WITH candidates AS (
      SELECT id
      FROM public.notifications
      WHERE read = false
        AND type IN ('live', 'scheduled_live_reminder')
        AND created_at < NOW() - make_interval(days => v_days)
      ORDER BY created_at ASC
      LIMIT v_limit
    ),
    updated AS (
      UPDATE public.notifications n
         SET read = true
        FROM candidates c
       WHERE n.id = c.id
       RETURNING n.id
    )
    SELECT COUNT(*)::INT INTO v_updated FROM updated;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'executed', p_execute,
    'older_than_days', v_days,
    'limit', v_limit,
    'matched', v_matched,
    'updated', v_updated,
    'types', jsonb_build_array('live', 'scheduled_live_reminder')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.live_notification_backlog_recovery(INT, INT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.live_notification_backlog_recovery(INT, INT, BOOLEAN) TO authenticated, service_role;
