-- Admin regional activity: internal daily country/region metrics.
-- No inferred user location is stored here. Values are explicit operational
-- metrics imported or entered by admins.

CREATE TABLE IF NOT EXISTS public.admin_region_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  country_name TEXT NOT NULL CHECK (char_length(trim(country_name)) > 0),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active_users BIGINT NOT NULL DEFAULT 0 CHECK (active_users >= 0),
  new_registrations BIGINT NOT NULL DEFAULT 0 CHECK (new_registrations >= 0),
  posts BIGINT NOT NULL DEFAULT 0 CHECK (posts >= 0),
  views BIGINT NOT NULL DEFAULT 0 CHECK (views >= 0),
  reports BIGINT NOT NULL DEFAULT 0 CHECK (reports >= 0),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, metric_date, source)
);

CREATE INDEX IF NOT EXISTS idx_admin_region_daily_metrics_date
  ON public.admin_region_daily_metrics(metric_date DESC, active_users DESC);

CREATE INDEX IF NOT EXISTS idx_admin_region_daily_metrics_country
  ON public.admin_region_daily_metrics(country_code, metric_date DESC);

ALTER TABLE public.admin_region_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_region_metrics_console_select" ON public.admin_region_daily_metrics;
CREATE POLICY "admin_region_metrics_console_select" ON public.admin_region_daily_metrics
  FOR SELECT USING (public.can_operate());

DROP POLICY IF EXISTS "admin_region_metrics_admin_mutate" ON public.admin_region_daily_metrics;
CREATE POLICY "admin_region_metrics_admin_mutate" ON public.admin_region_daily_metrics
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.set_admin_region_metric_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.country_code = UPPER(NEW.country_code);
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_admin_region_daily_metrics_updated_at ON public.admin_region_daily_metrics;
CREATE TRIGGER set_admin_region_daily_metrics_updated_at
  BEFORE INSERT OR UPDATE ON public.admin_region_daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_admin_region_metric_updated_at();

CREATE OR REPLACE FUNCTION public.admin_region_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_total_active BIGINT := 0;
  v_total_new BIGINT := 0;
  v_total_posts BIGINT := 0;
  v_total_views BIGINT := 0;
  v_total_reports BIGINT := 0;
  v_regions JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.can_operate() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  WITH recent AS (
    SELECT *
    FROM public.admin_region_daily_metrics
    WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
  ),
  by_country AS (
    SELECT
      country_code,
      MAX(country_name) AS country_name,
      SUM(active_users) AS active_users_30d,
      SUM(new_registrations) AS new_registrations_30d,
      SUM(posts) AS posts_30d,
      SUM(views) AS views_30d,
      SUM(reports) AS reports_30d,
      MAX(metric_date) AS latest_metric_date
    FROM recent
    GROUP BY country_code
  )
  SELECT
    COALESCE(SUM(active_users_30d), 0),
    COALESCE(SUM(new_registrations_30d), 0),
    COALESCE(SUM(posts_30d), 0),
    COALESCE(SUM(views_30d), 0),
    COALESCE(SUM(reports_30d), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'country_code', country_code,
          'country_name', country_name,
          'active_users_30d', active_users_30d,
          'new_registrations_30d', new_registrations_30d,
          'posts_30d', posts_30d,
          'views_30d', views_30d,
          'reports_30d', reports_30d,
          'latest_metric_date', latest_metric_date
        )
        ORDER BY active_users_30d DESC, views_30d DESC
      ),
      '[]'::JSONB
    )
  INTO v_total_active, v_total_new, v_total_posts, v_total_views, v_total_reports, v_regions
  FROM by_country;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'summary', jsonb_build_object(
      'active_users_30d', v_total_active,
      'new_registrations_30d', v_total_new,
      'posts_30d', v_total_posts,
      'views_30d', v_total_views,
      'reports_30d', v_total_reports
    ),
    'regions', COALESCE(v_regions, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_region_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_region_snapshot() TO authenticated;
