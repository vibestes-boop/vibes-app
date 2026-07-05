-- ============================================================================
-- Support-Antwort-Schleife: der Nutzer bekommt eine Benachrichtigung (+ Push),
-- wenn das Team auf seine Support-Anfrage antwortet — schließt "keine
-- Rückmeldung". Plus eine user-facing RPC für Follow-up-Nachrichten.
-- ============================================================================

-- 1) Notification-Typ 'support_reply' erlauben (dynamisch, bestehende nie verlieren).
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
      'order_review','order_dispute','product_saved',
      -- NEU
      'support_reply'
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

-- 2) admin_reply_support_thread: identisch wie bisher, plus Nutzer-Benachrichtigung.
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

  INSERT INTO public.admin_support_messages (thread_id, sender_type, sender_id, body, read_at)
  VALUES (p_thread_id, 'admin', v_actor, trim(p_body), NOW());

  UPDATE public.admin_support_threads
     SET last_message_at = NOW(),
         status = CASE WHEN status = 'resolved' THEN 'pending' ELSE status END
   WHERE id = p_thread_id;

  -- Nutzer benachrichtigen (defensiv — die Antwort darf nie an einer fehlenden
  -- Notification scheitern). Push feuert automatisch via trg_push_notification.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    SELECT t.user_id, v_actor, 'support_reply', left(trim(p_body), 140)
      FROM public.admin_support_threads t
     WHERE t.id = p_thread_id
       AND t.user_id IS NOT NULL
       AND t.user_id <> v_actor;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (v_actor, 'support.reply', 'support_thread', p_thread_id,
          jsonb_build_object('body_length', length(trim(p_body))));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reply_support_thread(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reply_support_thread(UUID, TEXT) TO authenticated;

-- 3) Nutzer-Follow-up in einem eigenen Thread (RLS erlaubt Lesen, RPC bündelt
--    Insert + Thread-Bump + Reopen sauber).
CREATE OR REPLACE FUNCTION public.add_user_support_message(
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
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 OR length(p_body) > 4000 THEN
    RETURN jsonb_build_object('error', 'invalid_body');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_support_threads
     WHERE id = p_thread_id AND user_id = v_actor
  ) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  INSERT INTO public.admin_support_messages (thread_id, sender_type, sender_id, body)
  VALUES (p_thread_id, 'user', v_actor, trim(p_body));

  UPDATE public.admin_support_threads
     SET last_message_at = NOW(),
         status = CASE WHEN status IN ('resolved', 'closed') THEN 'pending' ELSE status END
   WHERE id = p_thread_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.add_user_support_message(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_user_support_message(UUID, TEXT) TO authenticated;
