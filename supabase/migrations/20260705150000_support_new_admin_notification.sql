-- ============================================================================
-- Admin-Gegen-Loop: sobald ein Nutzer eine NEUE Support-Anfrage erstellt,
-- bekommt jeder Admin eine Benachrichtigung (+ Push via trg_push_notification),
-- damit nichts liegen bleibt. Spiegelbild zu 'support_reply' (Nutzer-Richtung).
-- ============================================================================

-- 1) Notification-Typ 'support_new' erlauben (dynamisch, bestehende nie verlieren).
DO $$
DECLARE
  v_types text;
BEGIN
  SELECT string_agg(quote_literal(t), ', ')
    INTO v_types
  FROM (
    SELECT t FROM unnest(ARRAY[
      'like','comment','follow','dm','live','live_invite','gift',
      'scheduled_live_reminder','new_order','mention','follow_request',
      'follow_request_accepted','comment_like','repost','story_reaction','guild',
      'preorder_interest','preorder_round_open',
      'order_payment_requested','order_payment_reminder','order_paid',
      'order_shipped','order_cancelled','order_address_updated',
      'order_review','order_dispute','product_saved','support_reply',
      -- NEU
      'support_new'
    ]) AS t
    UNION
    SELECT DISTINCT type FROM public.notifications WHERE type IS NOT NULL
  ) s;

  EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check';
  EXECUTE format(
    'ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (%s))',
    v_types
  );
END $$;

-- 2) create_support_thread: identisch zum neuesten Body (20260519215000),
--    plus Benachrichtigung an alle Admins nach dem Insert.
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

  -- Admins benachrichtigen (defensiv — Thread-Erstellung darf nie an einer
  -- fehlenden Notification scheitern). Push feuert automatisch via
  -- trg_push_notification. Nicht sich selbst pingen, falls ein Admin testet.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    SELECT p.id, v_actor, 'support_new', left(trim(p_subject), 140)
      FROM public.profiles p
     WHERE p.is_admin = true
       AND p.id <> v_actor;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'thread_id', v_thread_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_thread(TEXT, TEXT, TEXT, TEXT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_support_thread(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
