-- Stale notification backlog recovery.
--
-- This complements live_notification_backlog_recovery. It handles old,
-- low-risk activity badges such as follows, likes, comments, live reminders,
-- and live pings. It does not delete rows and does not expose recipient ids,
-- notification text, tokens, or endpoints. Mutating execution requires
-- service_role/admin/operator.

CREATE INDEX IF NOT EXISTS idx_notifications_unread_type_age
  ON public.notifications (type, created_at)
  WHERE read = false;

CREATE OR REPLACE FUNCTION public.stale_notification_backlog_recovery(
  p_older_than_days INT DEFAULT 60,
  p_limit INT DEFAULT 500,
  p_execute BOOLEAN DEFAULT FALSE,
  p_types TEXT[] DEFAULT ARRAY['follow', 'like', 'comment', 'live', 'scheduled_live_reminder']::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INT := GREATEST(1, LEAST(COALESCE(p_older_than_days, 60), 365));
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000));
  v_allowed_types CONSTANT TEXT[] := ARRAY['follow', 'like', 'comment', 'live', 'scheduled_live_reminder'];
  v_types TEXT[] := ARRAY[]::TEXT[];
  v_matched INT := 0;
  v_updated INT := 0;
  v_by_type JSONB := '{}'::JSONB;
  v_updated_by_type JSONB := '{}'::JSONB;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin() OR public.can_operate()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT normalized_type ORDER BY normalized_type), ARRAY[]::TEXT[])
    INTO v_types
    FROM (
      SELECT lower(trim(item)) AS normalized_type
      FROM unnest(COALESCE(p_types, v_allowed_types)) AS item
    ) input
   WHERE normalized_type = ANY(v_allowed_types);

  IF array_length(v_types, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'no_allowed_types',
      'allowed_types', to_jsonb(v_allowed_types)
    );
  END IF;

  WITH candidates AS (
    SELECT id, type
    FROM public.notifications
    WHERE read = false
      AND type = ANY(v_types)
      AND created_at < NOW() - make_interval(days => v_days)
    ORDER BY created_at ASC
    LIMIT v_limit
  ),
  counts AS (
    SELECT type, COUNT(*)::INT AS count
    FROM candidates
    GROUP BY type
  )
  SELECT
    COALESCE(SUM(count), 0)::INT,
    COALESCE(jsonb_object_agg(type, count), '{}'::JSONB)
    INTO v_matched, v_by_type
    FROM counts;

  IF p_execute THEN
    WITH candidates AS (
      SELECT id, type
      FROM public.notifications
      WHERE read = false
        AND type = ANY(v_types)
        AND created_at < NOW() - make_interval(days => v_days)
      ORDER BY created_at ASC
      LIMIT v_limit
    ),
    updated AS (
      UPDATE public.notifications n
         SET read = true
        FROM candidates c
       WHERE n.id = c.id
       RETURNING n.type
    ),
    counts AS (
      SELECT type, COUNT(*)::INT AS count
      FROM updated
      GROUP BY type
    )
    SELECT
      COALESCE(SUM(count), 0)::INT,
      COALESCE(jsonb_object_agg(type, count), '{}'::JSONB)
      INTO v_updated, v_updated_by_type
      FROM counts;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'executed', p_execute,
    'older_than_days', v_days,
    'limit', v_limit,
    'matched', v_matched,
    'updated', v_updated,
    'types', to_jsonb(v_types),
    'by_type', v_by_type,
    'updated_by_type', v_updated_by_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.stale_notification_backlog_recovery(INT, INT, BOOLEAN, TEXT[]) FROM public;
GRANT EXECUTE ON FUNCTION public.stale_notification_backlog_recovery(INT, INT, BOOLEAN, TEXT[]) TO authenticated, service_role;
