-- 20260625120000_notify_preorder_buyers.sql
-- "Alle benachrichtigen" fürs Vorbestell-Dashboard: der Verkäufer schreibt mit
-- EINEM Klick allen Interessenten eine DM (z.B. "Dein Parfüm ist da, zahlbar bei
-- Lieferung — meld dich"). Bisher musste er jeden Käufer einzeln über Nachrichten
-- → Neue Konversation → @username suchen anschreiben.
--
-- Warum eine SECURITY-DEFINER-RPC statt eine Schleife im Frontend:
--   • sendDirectMessage hat 500ms-Cooldown pro User → Blast unmöglich.
--   • product_preorders.status darf nur der Käufer ändern (RLS) — der Verkäufer
--     braucht DEFINER-Rechte, um interested→notified zu flippen.
--   • Atomar: Konversation holen/erstellen + Nachricht + Status in einem Rutsch.
--
-- Idempotent gegen Spam: nur Käufer mit status='interested' werden angeschrieben
-- und sofort auf 'notified' gesetzt → ein zweiter Klick schreibt sie NICHT erneut an.

CREATE OR REPLACE FUNCTION public.notify_preorder_buyers(
  p_product_id uuid,
  p_message    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_seller  uuid;
  v_msg     text := NULLIF(btrim(p_message), '');
  v_count   int  := 0;
  v_conv    uuid;
  v_p1      uuid;
  v_p2      uuid;
  r         record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF v_msg IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'empty_message');
  END IF;
  IF length(v_msg) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'message_too_long');
  END IF;

  SELECT seller_id INTO v_seller FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;
  IF v_seller <> v_uid AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owner');
  END IF;

  FOR r IN
    SELECT user_id
    FROM public.product_preorders
    WHERE product_id = p_product_id AND status = 'interested'
  LOOP
    CONTINUE WHEN r.user_id = v_seller;  -- nie sich selbst anschreiben

    -- Konversation normalisiert (participant_1 < participant_2, wie in der App).
    IF v_seller < r.user_id THEN v_p1 := v_seller; v_p2 := r.user_id;
    ELSE                         v_p1 := r.user_id; v_p2 := v_seller; END IF;

    SELECT id INTO v_conv
      FROM public.conversations
     WHERE participant_1 = v_p1 AND participant_2 = v_p2;
    IF v_conv IS NULL THEN
      INSERT INTO public.conversations (participant_1, participant_2)
        VALUES (v_p1, v_p2)
        RETURNING id INTO v_conv;
    END IF;

    INSERT INTO public.messages (conversation_id, sender_id, content)
      VALUES (v_conv, v_seller, v_msg);

    UPDATE public.product_preorders
       SET status = 'notified', updated_at = now()
     WHERE product_id = p_product_id AND user_id = r.user_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'notified', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_preorder_buyers(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_preorder_buyers(uuid, text) TO authenticated;
