-- First automated moderation layer for spam/NSFW text signals.
--
-- This does not remove content automatically. It creates canonical
-- content_reports rows and stores the classifier signal for admin review.

CREATE TABLE IF NOT EXISTS public.moderation_auto_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('post')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('auto_spam', 'auto_nsfw', 'auto_scam')),
  confidence NUMERIC NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_auto_flags_target
  ON public.moderation_auto_flags(target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_auto_flags_reason_created
  ON public.moderation_auto_flags(reason, created_at DESC);

ALTER TABLE public.moderation_auto_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderation_auto_flags_admin_select ON public.moderation_auto_flags;
CREATE POLICY moderation_auto_flags_admin_select
  ON public.moderation_auto_flags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION public.classify_post_moderation(
  p_caption TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}'::TEXT[],
  p_media_type TEXT DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_text TEXT := lower(
    COALESCE(p_caption, '') || ' ' ||
    COALESCE(array_to_string(p_tags, ' '), '') || ' ' ||
    COALESCE(p_media_type, '') || ' ' ||
    COALESCE(p_media_url, '')
  );
  v_reasons TEXT[] := ARRAY[]::TEXT[];
  v_confidence NUMERIC := 0;
BEGIN
  IF v_text ~ '(free[[:space:]-]*money|cashapp|whatsapp|telegram|airdrop|crypto[[:space:]-]*(profit|pump|signal)|double[[:space:]-]*your[[:space:]-]*money|work[[:space:]-]*from[[:space:]-]*home|only[[:space:]-]*fans|bit\.ly|t\.me/|wa\.me/)' THEN
    v_reasons := array_append(v_reasons, 'auto_spam');
    v_confidence := greatest(v_confidence, 0.75);
  END IF;

  IF v_text ~ '(nude|nudity|nsfw|porn|xxx|sex[[:space:]-]*(chat|video|cam)|explicit|18\+|adult[[:space:]-]*content)' THEN
    v_reasons := array_append(v_reasons, 'auto_nsfw');
    v_confidence := greatest(v_confidence, 0.8);
  END IF;

  IF v_text ~ '(giveaway|investment|forex|loan|casino|betting|jackpot|guaranteed[[:space:]-]*(profit|return)|send[[:space:]-]*me[[:space:]-]*(money|crypto))' THEN
    v_reasons := array_append(v_reasons, 'auto_scam');
    v_confidence := greatest(v_confidence, 0.7);
  END IF;

  RETURN jsonb_build_object(
    'flagged', cardinality(v_reasons) > 0,
    'reasons', COALESCE(to_jsonb(v_reasons), '[]'::jsonb),
    'confidence', v_confidence,
    'classifier', 'keyword-v1'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_automated_post_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_reason TEXT;
  v_confidence NUMERIC;
BEGIN
  v_result := public.classify_post_moderation(NEW.caption, NEW.tags, NEW.media_type, NEW.media_url);

  IF COALESCE((v_result->>'flagged')::BOOLEAN, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_confidence := COALESCE((v_result->>'confidence')::NUMERIC, 0);

  FOR v_reason IN
    SELECT jsonb_array_elements_text(v_result->'reasons')
  LOOP
    INSERT INTO public.moderation_auto_flags (
      target_type,
      target_id,
      reason,
      confidence,
      signals
    )
    SELECT
      'post',
      NEW.id,
      v_reason,
      v_confidence,
      v_result
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.moderation_auto_flags existing
      WHERE existing.target_type = 'post'
        AND existing.target_id = NEW.id
        AND existing.reason = v_reason
        AND existing.created_at >= NOW() - INTERVAL '30 days'
    );

    INSERT INTO public.content_reports (
      reporter_id,
      target_type,
      target_id,
      reason,
      admin_note
    )
    SELECT
      NULL,
      'post',
      NEW.id,
      v_reason,
      'Automated moderation signal: ' || (v_result->>'classifier') || ', confidence=' || v_confidence::TEXT
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.content_reports existing
      WHERE existing.reporter_id IS NULL
        AND existing.target_type = 'post'
        AND existing.target_id = NEW.id
        AND existing.reason = v_reason
        AND existing.status IN ('pending', 'reviewed', 'actioned')
        AND existing.created_at >= NOW() - INTERVAL '30 days'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_posts_automated_moderation ON public.posts;
CREATE TRIGGER trg_posts_automated_moderation
  AFTER INSERT OR UPDATE OF caption, tags, media_type, media_url ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_automated_post_moderation();

REVOKE ALL ON FUNCTION public.classify_post_moderation(TEXT, TEXT[], TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.classify_post_moderation(TEXT, TEXT[], TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.moderation_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_oldest_pending_age_seconds NUMERIC;
  v_legacy_post_unqueued BIGINT := 0;
  v_legacy_user_unqueued BIGINT := 0;
  v_legacy_live_unqueued BIGINT := 0;
BEGIN
  SELECT EXTRACT(EPOCH FROM (v_generated_at - MIN(created_at)))
    INTO v_oldest_pending_age_seconds
    FROM public.content_reports
   WHERE status = 'pending';

  IF to_regclass('public.post_reports') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.post_reports pr
      WHERE pr.reason = 'report'
        AND NOT EXISTS (
          SELECT 1
          FROM public.content_reports cr
          WHERE cr.reporter_id = pr.reporter_id
            AND cr.target_type = 'post'
            AND cr.target_id = pr.post_id
            AND cr.created_at >= pr.created_at - INTERVAL '1 minute'
        )
    $sql$ INTO v_legacy_post_unqueued;
  END IF;

  IF to_regclass('public.user_reports') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.user_reports ur
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.content_reports cr
        WHERE cr.reporter_id = ur.reporter_id
          AND cr.target_type = 'profile'
          AND cr.target_id = ur.reported_id
          AND cr.created_at >= ur.created_at - INTERVAL '1 minute'
      )
    $sql$ INTO v_legacy_user_unqueued;
  END IF;

  IF to_regclass('public.live_reports') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.live_reports lr
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.content_reports cr
        WHERE cr.reporter_id = lr.reporter_id
          AND cr.target_type = 'live'
          AND cr.target_id = lr.session_id
          AND cr.created_at >= lr.created_at - INTERVAL '1 minute'
      )
    $sql$ INTO v_legacy_live_unqueued;
  END IF;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'sla_hours', 24,
    'content_reports', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.content_reports),
      'pending', (SELECT COUNT(*) FROM public.content_reports WHERE status = 'pending'),
      'reviewed_7d', (
        SELECT COUNT(*)
        FROM public.content_reports
        WHERE reviewed_at >= v_generated_at - INTERVAL '7 days'
      ),
      'pending_over_sla', (
        SELECT COUNT(*)
        FROM public.content_reports
        WHERE status = 'pending'
          AND created_at < v_generated_at - INTERVAL '24 hours'
      ),
      'oldest_pending_age_seconds', v_oldest_pending_age_seconds,
      'by_target_type', COALESCE((
        SELECT jsonb_object_agg(target_type, count)
        FROM (
          SELECT target_type, COUNT(*) AS count
          FROM public.content_reports
          WHERE status = 'pending'
          GROUP BY target_type
          ORDER BY target_type
        ) grouped
      ), '{}'::jsonb)
    ),
    'legacy_unqueued', jsonb_build_object(
      'post_reports', COALESCE(v_legacy_post_unqueued, 0),
      'user_reports', COALESCE(v_legacy_user_unqueued, 0),
      'live_reports', COALESCE(v_legacy_live_unqueued, 0),
      'total',
        COALESCE(v_legacy_post_unqueued, 0) +
        COALESCE(v_legacy_user_unqueued, 0) +
        COALESCE(v_legacy_live_unqueued, 0)
    ),
    'admin_audit', jsonb_build_object(
      'events_7d', (
        SELECT COUNT(*)
        FROM public.admin_audit_log
        WHERE created_at >= v_generated_at - INTERVAL '7 days'
      ),
      'moderation_events_7d', (
        SELECT COUNT(*)
        FROM public.admin_audit_log
        WHERE action LIKE 'moderation.%'
          AND created_at >= v_generated_at - INTERVAL '7 days'
      )
    ),
    'enforcement', jsonb_build_object(
      'rpc_available', to_regprocedure('public.admin_enforce_content_report(uuid,text,text)') IS NOT NULL,
      'profile_ban_column', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_banned'
      ),
      'profile_restrict_columns', (
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_restricted'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'restricted_until'
        )
      ),
      'profile_shadowban_column', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_shadow_banned'
      ),
      'live_mute_table', to_regclass('public.live_chat_timeouts') IS NOT NULL,
      'audit_log_table', to_regclass('public.admin_audit_log') IS NOT NULL
    ),
    'auto_moderation', jsonb_build_object(
      'classifier_available', to_regprocedure('public.classify_post_moderation(text,text[],text,text)') IS NOT NULL,
      'trigger_available', EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'posts'
          AND t.tgname = 'trg_posts_automated_moderation'
          AND NOT t.tgisinternal
      ),
      'signal_table', to_regclass('public.moderation_auto_flags') IS NOT NULL,
      'flags_7d', (
        SELECT COUNT(*)
        FROM public.moderation_auto_flags
        WHERE created_at >= v_generated_at - INTERVAL '7 days'
      ),
      'pending_auto_reports', (
        SELECT COUNT(*)
        FROM public.content_reports
        WHERE status = 'pending'
          AND reason IN ('auto_spam', 'auto_nsfw', 'auto_scam')
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_health_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.moderation_health_snapshot() TO anon, authenticated;
