-- Activation Support Outreach: turn creator activation findings into real
-- support cases without creating a separate admin workflow.

ALTER TABLE public.admin_support_threads
  DROP CONSTRAINT IF EXISTS admin_support_threads_source_check;

ALTER TABLE public.admin_support_threads
  ADD CONSTRAINT admin_support_threads_source_check
  CHECK (source IN ('dm', 'report', 'payment', 'system', 'manual', 'activation'));

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

  IF v_source NOT IN ('dm', 'report', 'payment', 'system', 'manual', 'activation') THEN
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

CREATE OR REPLACE FUNCTION public.admin_create_activation_support_thread(
  p_user_id UUID,
  p_kind    TEXT DEFAULT 'first_post',
  p_body    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_kind TEXT := COALESCE(NULLIF(trim(p_kind), ''), 'first_post');
  v_subject TEXT;
  v_body TEXT;
  v_thread_id UUID;
  v_existing_thread_id UUID;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin() OR public.can_operate() OR public.can_creator_ops()) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('error', 'invalid_user');
  END IF;

  IF v_kind NOT IN ('first_post', 'engagement') THEN
    RETURN jsonb_build_object('error', 'invalid_kind');
  END IF;

  SELECT id
    INTO v_existing_thread_id
    FROM public.admin_support_threads
   WHERE user_id = p_user_id
     AND source = 'activation'
     AND status IN ('open', 'pending')
     AND metadata->>'activation_kind' = v_kind
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_thread_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'thread_id', v_existing_thread_id,
      'existing', true
    );
  END IF;

  v_subject := CASE
    WHEN v_kind = 'engagement' THEN 'Creator Activation: Engagement anstossen'
    ELSE 'Creator Activation: Ersten Post starten'
  END;

  v_body := COALESCE(NULLIF(trim(p_body), ''), CASE
    WHEN v_kind = 'engagement' THEN
      'Hi! Dein Content ist live. Wir pruefen gerade, wie wir dir schneller zu den ersten sinnvollen Reaktionen helfen koennen. Wenn du magst, antworte kurz: Welches Thema soll als naechstes gepusht werden?'
    ELSE
      'Hi! Willkommen bei Serlo. Wir helfen dir gern beim ersten Post. Ein guter Start ist ein kurzes Bild oder Video mit einer konkreten Frage an die Community.'
  END);

  IF length(v_body) > 4000 THEN
    RETURN jsonb_build_object('error', 'invalid_body');
  END IF;

  INSERT INTO public.admin_support_threads (
    source,
    user_id,
    subject,
    status,
    priority,
    assigned_admin_id,
    metadata
  )
  VALUES (
    'activation',
    p_user_id,
    v_subject,
    'open',
    'medium',
    v_actor,
    jsonb_build_object(
      'activation_kind', v_kind,
      'created_from', 'admin_activation_review'
    )
  )
  RETURNING id INTO v_thread_id;

  INSERT INTO public.admin_support_messages (
    thread_id,
    sender_type,
    sender_id,
    body,
    metadata,
    read_at
  )
  VALUES (
    v_thread_id,
    'admin',
    v_actor,
    v_body,
    jsonb_build_object('activation_kind', v_kind),
    NOW()
  );

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    v_actor,
    'activation.support_thread.create',
    'profile',
    p_user_id,
    jsonb_build_object(
      'support_thread_id', v_thread_id,
      'activation_kind', v_kind
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'thread_id', v_thread_id,
    'existing', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.creator_activation_recovery_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin() OR public.can_operate() OR public.can_creator_ops()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH posts_30d AS (
    SELECT id, author_id, created_at
    FROM public.posts
    WHERE created_at >= NOW() - INTERVAL '30 days'
      AND COALESCE(privacy, 'public') <> 'private'
  ),
  posts_7d AS (
    SELECT id, author_id, created_at
    FROM public.posts
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND COALESCE(privacy, 'public') <> 'private'
  ),
  engagement_30d AS (
    SELECT
      p.id AS post_id,
      p.author_id,
      (
        SELECT COUNT(*)
        FROM public.likes l
        WHERE l.post_id = p.id
          AND l.created_at >= p.created_at
      ) AS likes,
      (
        SELECT COUNT(*)
        FROM public.comments c
        WHERE c.post_id = p.id
          AND c.created_at >= p.created_at
      ) AS comments,
      (
        SELECT COUNT(*)
        FROM public.bookmarks b
        WHERE b.post_id = p.id
          AND b.created_at >= p.created_at
      ) AS bookmarks,
      (
        SELECT COUNT(*)
        FROM public.post_views_log v
        WHERE v.post_id = p.id
          AND v.viewed_at >= p.created_at
      ) AS views,
      (
        SELECT COUNT(*)
        FROM public.follows f
        WHERE f.following_id = p.author_id
          AND f.created_at >= p.created_at
      ) AS follows
    FROM posts_30d p
  ),
  creator_rollup AS (
    SELECT
      p.author_id,
      COUNT(*) AS posts_30d,
      MAX(p.created_at) AS latest_post_at,
      COALESCE(SUM(e.likes), 0) AS likes,
      COALESCE(SUM(e.comments), 0) AS comments,
      COALESCE(SUM(e.bookmarks), 0) AS bookmarks,
      COALESCE(SUM(e.views), 0) AS views,
      COALESCE(SUM(e.follows), 0) AS follows
    FROM posts_30d p
    LEFT JOIN engagement_30d e ON e.post_id = p.id
    GROUP BY p.author_id
  ),
  summary AS (
    SELECT jsonb_build_object(
      'new_users_30d', (
        SELECT COUNT(*)
        FROM public.profiles
        WHERE created_at >= NOW() - INTERVAL '30 days'
      ),
      'users_without_first_post_30d', (
        SELECT COUNT(*)
        FROM public.profiles pr
        WHERE pr.created_at >= NOW() - INTERVAL '30 days'
          AND NOT EXISTS (
            SELECT 1 FROM public.posts po WHERE po.author_id = pr.id
          )
      ),
      'posts_7d', (SELECT COUNT(*) FROM posts_7d),
      'posts_30d', (SELECT COUNT(*) FROM posts_30d),
      'active_creators_7d', (SELECT COUNT(DISTINCT author_id) FROM posts_7d),
      'creators_with_posts_30d', (SELECT COUNT(*) FROM creator_rollup),
      'creators_with_zero_engagement_30d', (
        SELECT COUNT(*)
        FROM creator_rollup
        WHERE likes + comments + bookmarks + follows = 0
      ),
      'posts_with_meaningful_engagement_30d', (
        SELECT COUNT(*)
        FROM engagement_30d
        WHERE likes + comments + bookmarks + follows > 0
      ),
      'views_30d', (SELECT COALESCE(SUM(views), 0) FROM engagement_30d),
      'meaningful_engagement_30d', (
        SELECT COALESCE(SUM(likes + comments + bookmarks + follows), 0)
        FROM engagement_30d
      )
    ) AS data
  ),
  need_first_post AS (
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) AS data
    FROM (
      SELECT jsonb_build_object(
        'profile_id', pr.id,
        'user_id', LEFT(pr.id::TEXT, 8),
        'username', pr.username,
        'display_name', pr.display_name,
        'created_at', pr.created_at,
        'days_since_signup', FLOOR(EXTRACT(EPOCH FROM (NOW() - pr.created_at)) / 86400)
      ) AS row_data
      FROM public.profiles pr
      WHERE pr.created_at >= NOW() - INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM public.posts po WHERE po.author_id = pr.id
        )
      ORDER BY pr.created_at DESC
      LIMIT 12
    ) rows
  ),
  need_engagement AS (
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) AS data
    FROM (
      SELECT jsonb_build_object(
        'profile_id', cr.author_id,
        'user_id', LEFT(cr.author_id::TEXT, 8),
        'username', pr.username,
        'display_name', pr.display_name,
        'posts_30d', cr.posts_30d,
        'latest_post_at', cr.latest_post_at,
        'views', cr.views,
        'likes', cr.likes,
        'comments', cr.comments,
        'bookmarks', cr.bookmarks,
        'follows', cr.follows
      ) AS row_data
      FROM creator_rollup cr
      JOIN public.profiles pr ON pr.id = cr.author_id
      WHERE cr.likes + cr.comments + cr.bookmarks + cr.follows = 0
      ORDER BY cr.latest_post_at DESC
      LIMIT 12
    ) rows
  )
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'summary', summary.data,
    'need_first_post', need_first_post.data,
    'need_engagement', need_engagement.data,
    'next_actions', jsonb_build_array(
      'Guide new users without first post to create one public post',
      'Review creators with posts but no meaningful engagement',
      'Seed engagement loops through comments, follows, saves, or creator prompts',
      'Pause non-activation features while weekly active creators stays at 0'
    )
  )
  INTO v_snapshot
  FROM summary, need_first_post, need_engagement;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_activation_support_thread(UUID, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_activation_support_thread(UUID, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_support_thread(TEXT, TEXT, TEXT, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.create_support_thread(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.creator_activation_recovery_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.creator_activation_recovery_snapshot() TO authenticated, service_role;
