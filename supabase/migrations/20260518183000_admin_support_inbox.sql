-- Admin Support Inbox: real backend model for support tickets and dashboard stats.
-- Keeps user DMs separate from operational support cases.

CREATE TABLE IF NOT EXISTS public.admin_support_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL DEFAULT 'manual',
  user_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open',
  priority          TEXT NOT NULL DEFAULT 'medium',
  assigned_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_support_threads_source_check
    CHECK (source IN ('dm', 'report', 'payment', 'system', 'manual')),
  CONSTRAINT admin_support_threads_status_check
    CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  CONSTRAINT admin_support_threads_priority_check
    CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE TABLE IF NOT EXISTS public.admin_support_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES public.admin_support_threads(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_support_messages_sender_type_check
    CHECK (sender_type IN ('user', 'admin', 'system')),
  CONSTRAINT admin_support_messages_body_check
    CHECK (length(trim(body)) > 0 AND length(body) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_admin_support_threads_status_priority
  ON public.admin_support_threads(status, priority, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_support_threads_user
  ON public.admin_support_threads(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_support_messages_thread
  ON public.admin_support_messages(thread_id, created_at DESC);

ALTER TABLE public.admin_support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_support_threads_user_select" ON public.admin_support_threads;
CREATE POLICY "admin_support_threads_user_select" ON public.admin_support_threads
  FOR SELECT USING (user_id = auth.uid() OR public.has_admin_console_access());

DROP POLICY IF EXISTS "admin_support_threads_user_insert" ON public.admin_support_threads;
CREATE POLICY "admin_support_threads_user_insert" ON public.admin_support_threads
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.has_admin_console_access());

DROP POLICY IF EXISTS "admin_support_threads_admin_update" ON public.admin_support_threads;
CREATE POLICY "admin_support_threads_admin_update" ON public.admin_support_threads
  FOR UPDATE USING (public.can_moderate() OR public.can_operate());

DROP POLICY IF EXISTS "admin_support_messages_select" ON public.admin_support_messages;
CREATE POLICY "admin_support_messages_select" ON public.admin_support_messages
  FOR SELECT USING (
    public.has_admin_console_access()
    OR EXISTS (
      SELECT 1
      FROM public.admin_support_threads t
      WHERE t.id = thread_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_support_messages_insert" ON public.admin_support_messages;
CREATE POLICY "admin_support_messages_insert" ON public.admin_support_messages
  FOR INSERT WITH CHECK (
    public.has_admin_console_access()
    OR EXISTS (
      SELECT 1
      FROM public.admin_support_threads t
      WHERE t.id = thread_id
        AND t.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.set_admin_support_thread_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_support_threads_updated_at ON public.admin_support_threads;
CREATE TRIGGER trg_admin_support_threads_updated_at
  BEFORE UPDATE ON public.admin_support_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_admin_support_thread_updated_at();

CREATE OR REPLACE FUNCTION public.create_support_thread(
  p_subject  TEXT,
  p_body     TEXT,
  p_source   TEXT DEFAULT 'manual',
  p_priority TEXT DEFAULT 'medium',
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_thread_id UUID;
  v_source TEXT := COALESCE(NULLIF(trim(p_source), ''), 'manual');
  v_priority TEXT := COALESCE(NULLIF(trim(p_priority), ''), 'medium');
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF v_source NOT IN ('dm', 'report', 'payment', 'system', 'manual') THEN
    RETURN jsonb_build_object('error', 'invalid_source');
  END IF;

  IF v_priority NOT IN ('low', 'medium', 'high') THEN
    RETURN jsonb_build_object('error', 'invalid_priority');
  END IF;

  IF p_subject IS NULL OR length(trim(p_subject)) = 0 OR length(p_subject) > 160 THEN
    RETURN jsonb_build_object('error', 'invalid_subject');
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 OR length(p_body) > 4000 THEN
    RETURN jsonb_build_object('error', 'invalid_body');
  END IF;

  INSERT INTO public.admin_support_threads (
    source,
    user_id,
    subject,
    priority,
    metadata
  )
  VALUES (
    v_source,
    v_actor,
    trim(p_subject),
    v_priority,
    COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING id INTO v_thread_id;

  INSERT INTO public.admin_support_messages (
    thread_id,
    sender_type,
    sender_id,
    body
  )
  VALUES (
    v_thread_id,
    'user',
    v_actor,
    trim(p_body)
  );

  RETURN jsonb_build_object('success', true, 'thread_id', v_thread_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reply_support_thread(
  p_thread_id UUID,
  p_body      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.can_moderate() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 OR length(p_body) > 4000 THEN
    RETURN jsonb_build_object('error', 'invalid_body');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_support_threads WHERE id = p_thread_id) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  INSERT INTO public.admin_support_messages (
    thread_id,
    sender_type,
    sender_id,
    body,
    read_at
  )
  VALUES (
    p_thread_id,
    'admin',
    v_actor,
    trim(p_body),
    NOW()
  );

  UPDATE public.admin_support_threads
     SET last_message_at = NOW(),
         status = CASE WHEN status = 'resolved' THEN 'pending' ELSE status END
   WHERE id = p_thread_id;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    v_actor,
    'support.reply',
    'support_thread',
    p_thread_id,
    jsonb_build_object('body_length', length(trim(p_body)))
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_support_thread(
  p_thread_id UUID,
  p_status    TEXT DEFAULT 'resolved'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_status TEXT := COALESCE(NULLIF(trim(p_status), ''), 'resolved');
BEGIN
  IF v_actor IS NULL OR NOT public.can_moderate() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF v_status NOT IN ('resolved', 'closed', 'pending', 'open') THEN
    RETURN jsonb_build_object('error', 'invalid_status');
  END IF;

  UPDATE public.admin_support_threads
     SET status = v_status,
         resolved_at = CASE WHEN v_status IN ('resolved', 'closed') THEN NOW() ELSE NULL END,
         resolved_by = CASE WHEN v_status IN ('resolved', 'closed') THEN v_actor ELSE NULL END
   WHERE id = p_thread_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    v_actor,
    'support.thread.' || v_status,
    'support_thread',
    p_thread_id,
    '{}'::JSONB
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_support_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_oldest_open_age_seconds NUMERIC;
BEGIN
  IF NOT public.has_admin_console_access() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT EXTRACT(EPOCH FROM (v_generated_at - MIN(created_at)))
    INTO v_oldest_open_age_seconds
    FROM public.admin_support_threads
   WHERE status IN ('open', 'pending');

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'sla_hours', 24,
    'threads', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.admin_support_threads),
      'open', (SELECT COUNT(*) FROM public.admin_support_threads WHERE status = 'open'),
      'pending', (SELECT COUNT(*) FROM public.admin_support_threads WHERE status = 'pending'),
      'resolved_7d', (
        SELECT COUNT(*)
        FROM public.admin_support_threads
        WHERE resolved_at >= v_generated_at - INTERVAL '7 days'
      ),
      'over_sla', (
        SELECT COUNT(*)
        FROM public.admin_support_threads
        WHERE status IN ('open', 'pending')
          AND created_at < v_generated_at - INTERVAL '24 hours'
      ),
      'oldest_open_age_seconds', v_oldest_open_age_seconds,
      'by_priority', COALESCE((
        SELECT jsonb_object_agg(priority, count)
        FROM (
          SELECT priority, COUNT(*) AS count
          FROM public.admin_support_threads
          WHERE status IN ('open', 'pending')
          GROUP BY priority
          ORDER BY priority
        ) grouped
      ), '{}'::jsonb)
    ),
    'latest', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'subject', t.subject,
          'status', t.status,
          'priority', t.priority,
          'source', t.source,
          'user_id', t.user_id,
          'username', p.username,
          'last_message_at', t.last_message_at,
          'age_seconds', EXTRACT(EPOCH FROM (v_generated_at - t.created_at))
        )
        ORDER BY t.last_message_at DESC
      )
      FROM (
        SELECT *
        FROM public.admin_support_threads
        WHERE status IN ('open', 'pending')
        ORDER BY last_message_at DESC
        LIMIT 5
      ) t
      LEFT JOIN public.profiles p ON p.id = t.user_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_support_threads(
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  user_id UUID,
  username TEXT,
  subject TEXT,
  status TEXT,
  priority TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.source,
    t.user_id,
    p.username,
    t.subject,
    t.status,
    t.priority,
    t.last_message_at,
    t.created_at
  FROM public.admin_support_threads t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  WHERE public.has_admin_console_access()
    AND (p_status IS NULL OR t.status = p_status)
  ORDER BY t.last_message_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.create_support_thread(TEXT, TEXT, TEXT, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.create_support_thread(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_reply_support_thread(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_reply_support_thread(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_resolve_support_thread(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_resolve_support_thread(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_support_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_support_snapshot() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_support_threads(TEXT, INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_support_threads(TEXT, INTEGER, INTEGER) TO authenticated;
