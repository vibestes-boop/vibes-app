-- Admin campaigns: internal campaign model and command-center snapshot.
-- This stores only real campaign records and metrics. Empty tables render as
-- empty states in the admin UI instead of demo values.

CREATE TABLE IF NOT EXISTS public.admin_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  channel TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'active', 'paused', 'completed', 'failed', 'archived')
  ),
  target_metric TEXT,
  budget_cents BIGINT NOT NULL DEFAULT 0 CHECK (budget_cents >= 0),
  spend_cents BIGINT NOT NULL DEFAULT 0 CHECK (spend_cents >= 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_campaign_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.admin_campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  conversions BIGINT NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  revenue_cents BIGINT NOT NULL DEFAULT 0 CHECK (revenue_cents >= 0),
  spend_cents BIGINT NOT NULL DEFAULT 0 CHECK (spend_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_admin_campaigns_status_updated
  ON public.admin_campaigns(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_campaign_daily_metrics_campaign_date
  ON public.admin_campaign_daily_metrics(campaign_id, metric_date DESC);

ALTER TABLE public.admin_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_campaign_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_campaigns_console_select" ON public.admin_campaigns;
CREATE POLICY "admin_campaigns_console_select" ON public.admin_campaigns
  FOR SELECT USING (public.can_operate());

DROP POLICY IF EXISTS "admin_campaigns_admin_mutate" ON public.admin_campaigns;
CREATE POLICY "admin_campaigns_admin_mutate" ON public.admin_campaigns
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_campaign_metrics_console_select" ON public.admin_campaign_daily_metrics;
CREATE POLICY "admin_campaign_metrics_console_select" ON public.admin_campaign_daily_metrics
  FOR SELECT USING (public.can_operate());

DROP POLICY IF EXISTS "admin_campaign_metrics_admin_mutate" ON public.admin_campaign_daily_metrics;
CREATE POLICY "admin_campaign_metrics_admin_mutate" ON public.admin_campaign_daily_metrics
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.set_admin_campaign_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_admin_campaigns_updated_at ON public.admin_campaigns;
CREATE TRIGGER set_admin_campaigns_updated_at
  BEFORE UPDATE ON public.admin_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_admin_campaign_updated_at();

DROP TRIGGER IF EXISTS set_admin_campaign_daily_metrics_updated_at ON public.admin_campaign_daily_metrics;
CREATE TRIGGER set_admin_campaign_daily_metrics_updated_at
  BEFORE UPDATE ON public.admin_campaign_daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_admin_campaign_updated_at();

CREATE OR REPLACE FUNCTION public.admin_campaign_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_total BIGINT := 0;
  v_active BIGINT := 0;
  v_paused BIGINT := 0;
  v_failed BIGINT := 0;
  v_budget BIGINT := 0;
  v_spend BIGINT := 0;
  v_revenue BIGINT := 0;
  v_impressions BIGINT := 0;
  v_clicks BIGINT := 0;
  v_conversions BIGINT := 0;
  v_items JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.can_operate() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'paused'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COALESCE(SUM(budget_cents), 0),
    COALESCE(SUM(spend_cents), 0)
  INTO v_total, v_active, v_paused, v_failed, v_budget, v_spend
  FROM public.admin_campaigns;

  SELECT
    COALESCE(SUM(revenue_cents), 0),
    COALESCE(SUM(impressions), 0),
    COALESCE(SUM(clicks), 0),
    COALESCE(SUM(conversions), 0),
    COALESCE(SUM(spend_cents), 0)
  INTO v_revenue, v_impressions, v_clicks, v_conversions, v_spend
  FROM public.admin_campaign_daily_metrics
  WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days';

  IF v_spend = 0 THEN
    SELECT COALESCE(SUM(spend_cents), 0)
      INTO v_spend
      FROM public.admin_campaigns;
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_updated_at DESC), '[]'::JSONB)
    INTO v_items
    FROM (
      SELECT
        c.updated_at AS sort_updated_at,
        jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'channel', c.channel,
          'status', c.status,
          'target_metric', c.target_metric,
          'budget_cents', c.budget_cents,
          'spend_cents', COALESCE(m.spend_cents_30d, c.spend_cents),
          'impressions_30d', COALESCE(m.impressions_30d, 0),
          'clicks_30d', COALESCE(m.clicks_30d, 0),
          'conversions_30d', COALESCE(m.conversions_30d, 0),
          'revenue_cents_30d', COALESCE(m.revenue_cents_30d, 0),
          'updated_at', c.updated_at
        ) AS row_data
      FROM public.admin_campaigns c
      LEFT JOIN LATERAL (
        SELECT
          SUM(impressions) AS impressions_30d,
          SUM(clicks) AS clicks_30d,
          SUM(conversions) AS conversions_30d,
          SUM(revenue_cents) AS revenue_cents_30d,
          SUM(spend_cents) AS spend_cents_30d
        FROM public.admin_campaign_daily_metrics m
        WHERE m.campaign_id = c.id
          AND m.metric_date >= CURRENT_DATE - INTERVAL '30 days'
      ) m ON TRUE
      ORDER BY
        CASE c.status
          WHEN 'active' THEN 1
          WHEN 'paused' THEN 2
          WHEN 'failed' THEN 3
          WHEN 'draft' THEN 4
          ELSE 5
        END,
        c.updated_at DESC
      LIMIT 5
    ) ranked;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'summary', jsonb_build_object(
      'total', v_total,
      'active', v_active,
      'paused', v_paused,
      'failed', v_failed,
      'budget_cents', v_budget,
      'spend_cents_30d', v_spend,
      'revenue_cents_30d', v_revenue,
      'impressions_30d', v_impressions,
      'clicks_30d', v_clicks,
      'conversions_30d', v_conversions,
      'roas', CASE WHEN v_spend > 0 THEN ROUND((v_revenue::NUMERIC / v_spend::NUMERIC), 2) ELSE NULL END
    ),
    'campaigns', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_campaign_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_campaign_snapshot() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_sidebar_badges_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_pending_reports BIGINT := 0;
  v_reports_over_sla BIGINT := 0;
  v_open_support BIGINT := 0;
  v_support_over_sla BIGINT := 0;
  v_campaigns_active BIGINT := 0;
  v_campaigns_failed BIGINT := 0;
  v_r2_errors BIGINT := 0;
  v_public_video_missing_thumb BIGINT := 0;
BEGIN
  IF NOT public.has_admin_console_access() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT COUNT(*)
    INTO v_pending_reports
    FROM public.content_reports
   WHERE status = 'pending';

  SELECT COUNT(*)
    INTO v_reports_over_sla
    FROM public.content_reports
   WHERE status = 'pending'
     AND created_at < v_generated_at - INTERVAL '24 hours';

  IF to_regclass('public.admin_support_threads') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.admin_support_threads
      WHERE status IN ('open', 'pending')
    $sql$ INTO v_open_support;

    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.admin_support_threads
      WHERE status IN ('open', 'pending')
        AND created_at < NOW() - INTERVAL '24 hours'
    $sql$ INTO v_support_over_sla;
  END IF;

  SELECT COUNT(*)
    INTO v_campaigns_active
    FROM public.admin_campaigns
   WHERE status = 'active';

  SELECT COUNT(*)
    INTO v_campaigns_failed
    FROM public.admin_campaigns
   WHERE status = 'failed';

  IF to_regclass('public.r2_delete_queue') IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_r2_errors
      FROM public.r2_delete_queue
     WHERE status = 'error';
  END IF;

  SELECT COUNT(*)
    INTO v_public_video_missing_thumb
    FROM public.posts
   WHERE privacy = 'public'
     AND media_type = 'video'
     AND thumbnail_url IS NULL;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'reports', jsonb_build_object(
      'pending', v_pending_reports,
      'over_sla', v_reports_over_sla
    ),
    'support', jsonb_build_object(
      'open', v_open_support,
      'over_sla', v_support_over_sla
    ),
    'campaigns', jsonb_build_object(
      'active', v_campaigns_active,
      'failed', v_campaigns_failed,
      'status', 'ready'
    ),
    'security', jsonb_build_object(
      'critical', v_reports_over_sla + v_support_over_sla + v_r2_errors + v_public_video_missing_thumb,
      'r2_errors', v_r2_errors,
      'video_missing_thumbnail', v_public_video_missing_thumb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sidebar_badges_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_sidebar_badges_snapshot() TO authenticated;
