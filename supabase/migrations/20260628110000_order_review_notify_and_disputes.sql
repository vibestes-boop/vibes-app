-- 20260628110000_order_review_notify_and_disputes.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- (A) Bewertungs-Benachrichtigung: submit_order_review pingt den Bewerteten.
-- (B) Dispute-System: Käufer/Verkäufer kann ein Problem an einer Bestellung
--     melden → landet bei der Gegenseite + bei Admins (Zaur) zur Klärung.
--
-- Zwei neue notifications.type: order_review, order_dispute (CHECK dynamisch
-- erweitert). Renderer (App+Web) + Push kennen sie ab demselben Release.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── CHECK erweitern ──────────────────────────────────────────────────────────
DO $$
DECLARE v_types text;
BEGIN
  SELECT string_agg(quote_literal(t), ', ') INTO v_types
  FROM (
    SELECT t FROM unnest(ARRAY[
      'like','comment','follow','dm','live','live_invite','gift',
      'scheduled_live_reminder','new_order','mention','follow_request',
      'follow_request_accepted','comment_like','repost','story_reaction','guild',
      'preorder_interest','order_payment_requested','order_paid','order_shipped',
      'order_cancelled','order_address_updated',
      'order_review','order_dispute'
    ]) AS t
    UNION SELECT DISTINCT type FROM public.notifications WHERE type IS NOT NULL
  ) s;
  EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check';
  EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (%s))', v_types);
END $$;

-- ── (A) submit_order_review → Reviewee benachrichtigen (nur bei NEUER Bewertung) ──
CREATE OR REPLACE FUNCTION public.submit_order_review(
  p_order_id uuid, p_rating int, p_comment text default null
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_order    public.product_orders%rowtype;
  v_role     text;
  v_reviewee uuid;
  v_comment  text := nullif(btrim(p_comment), '');
  v_existing boolean;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RETURN jsonb_build_object('error','invalid_rating'); END IF;
  IF v_comment IS NOT NULL AND length(v_comment) > 1000 THEN v_comment := left(v_comment, 1000); END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_caller = v_order.buyer_id THEN v_role := 'buyer'; v_reviewee := v_order.seller_id;
  ELSIF v_caller = v_order.seller_id THEN v_role := 'seller'; v_reviewee := v_order.buyer_id;
  ELSE RETURN jsonb_build_object('error','not_authorized'); END IF;

  IF v_order.status <> 'delivered' THEN RETURN jsonb_build_object('error','not_delivered'); END IF;

  SELECT EXISTS(SELECT 1 FROM public.order_reviews WHERE order_id = p_order_id AND reviewer_id = v_caller)
    INTO v_existing;

  INSERT INTO public.order_reviews (order_id, reviewer_id, reviewee_id, reviewer_role, rating, comment)
  VALUES (p_order_id, v_caller, v_reviewee, v_role, p_rating, v_comment)
  ON CONFLICT (order_id, reviewer_id) DO UPDATE
    SET rating = excluded.rating, comment = excluded.comment, updated_at = now();

  IF NOT v_existing THEN
    BEGIN
      INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
      VALUES (v_reviewee, v_caller, 'order_review', 'Du wurdest mit ' || p_rating || '★ bewertet ⭐');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.submit_order_review(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_order_review(uuid, int, text) TO authenticated;

-- ── (B) order_disputes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_disputes (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.product_orders(id) on delete cascade,
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  against_id    uuid not null references public.profiles(id) on delete cascade,
  reporter_role text not null check (reporter_role in ('buyer','seller')),
  reason        text not null check (reason in ('not_received','damaged','not_as_described','not_paid','fraud','other')),
  detail        text,
  status        text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolution    text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  unique (order_id, reporter_id)
);

ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;

-- Parteien sehen ihre Order-Disputes; Admins sehen alle.
DROP POLICY IF EXISTS order_disputes_read ON public.order_disputes;
CREATE POLICY order_disputes_read ON public.order_disputes
  FOR SELECT USING (
    auth.uid() = reporter_id OR auth.uid() = against_id OR COALESCE(public.is_admin(), false)
  );

GRANT SELECT ON public.order_disputes TO authenticated;
CREATE INDEX IF NOT EXISTS idx_order_disputes_order  ON public.order_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_disputes_status ON public.order_disputes(status) WHERE status = 'open';

-- ── report_order_dispute (Partei meldet) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_order_dispute(
  p_order_id uuid, p_reason text, p_detail text default null
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_order   public.product_orders%rowtype;
  v_role    text;
  v_against uuid;
  v_detail  text := nullif(btrim(p_detail), '');
  r_admin   record;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF p_reason NOT IN ('not_received','damaged','not_as_described','not_paid','fraud','other') THEN
    RETURN jsonb_build_object('error','invalid_reason');
  END IF;
  IF v_detail IS NOT NULL AND length(v_detail) > 2000 THEN v_detail := left(v_detail, 2000); END IF;

  SELECT * INTO v_order FROM public.product_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF v_caller = v_order.buyer_id THEN v_role := 'buyer'; v_against := v_order.seller_id;
  ELSIF v_caller = v_order.seller_id THEN v_role := 'seller'; v_against := v_order.buyer_id;
  ELSE RETURN jsonb_build_object('error','not_authorized'); END IF;

  -- Erst ab Zahlung sinnvoll (vorher gibt's „Doch nicht"/Stornieren).
  IF v_order.status NOT IN ('paid','shipped','delivered') THEN
    RETURN jsonb_build_object('error','not_reportable');
  END IF;

  INSERT INTO public.order_disputes (order_id, reporter_id, against_id, reporter_role, reason, detail)
  VALUES (p_order_id, v_caller, v_against, v_role, p_reason, v_detail)
  ON CONFLICT (order_id, reporter_id) DO UPDATE
    SET reason = excluded.reason, detail = excluded.detail, status = 'open', resolved_at = NULL;

  -- Gegenseite informieren.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    VALUES (v_against, v_caller, 'order_dispute', 'Ein Problem mit einer Bestellung wurde gemeldet ⚠️');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Admins informieren (außer wenn schon als Gegenseite/Melder benachrichtigt).
  FOR r_admin IN SELECT id FROM public.profiles WHERE is_admin = true LOOP
    IF r_admin.id <> v_caller AND r_admin.id <> v_against THEN
      BEGIN
        INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
        VALUES (r_admin.id, v_caller, 'order_dispute', 'Neue Streit-Meldung zu einer Bestellung ⚠️');
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.report_order_dispute(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_order_dispute(uuid, text, text) TO authenticated;

-- ── resolve_order_dispute (Admin klärt) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_order_dispute(
  p_dispute_id uuid, p_resolution text default null, p_dismiss boolean default false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_dispute public.order_disputes%rowtype;
  v_res     text := nullif(btrim(p_resolution), '');
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF NOT COALESCE(public.is_admin(), false) THEN RETURN jsonb_build_object('error','not_authorized'); END IF;

  SELECT * INTO v_dispute FROM public.order_disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','dispute_not_found'); END IF;

  UPDATE public.order_disputes
     SET status = CASE WHEN p_dismiss THEN 'dismissed' ELSE 'resolved' END,
         resolution = v_res,
         resolved_at = now()
   WHERE id = p_dispute_id;

  -- Beide Parteien informieren.
  BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, type, comment_text)
    VALUES
      (v_dispute.reporter_id, v_caller, 'order_dispute', 'Deine Streit-Meldung wurde geklärt ✓'),
      (v_dispute.against_id,  v_caller, 'order_dispute', 'Eine Streit-Meldung zu deiner Bestellung wurde geklärt ✓');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.resolve_order_dispute(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_order_dispute(uuid, text, boolean) TO authenticated;
