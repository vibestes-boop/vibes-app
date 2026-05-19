-- Voluntary profile regions for admin regional activity.
-- This stores only explicit user input. No IP geolocation, GPS, or inferred
-- location is collected here.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT NULL CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS country_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS city TEXT NULL,
  ADD COLUMN IF NOT EXISTS region_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS location_consent_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_country_code
  ON public.profiles (country_code)
  WHERE country_code IS NOT NULL;

ALTER TABLE public.admin_region_daily_metrics
  ADD COLUMN IF NOT EXISTS total_profiles BIGINT NOT NULL DEFAULT 0 CHECK (total_profiles >= 0);

CREATE INDEX IF NOT EXISTS idx_admin_region_daily_metrics_total_profiles
  ON public.admin_region_daily_metrics(metric_date DESC, total_profiles DESC);

CREATE OR REPLACE FUNCTION public.refresh_admin_region_metrics_from_profiles(
  p_metric_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_upserted BIGINT := 0;
BEGIN
  IF NOT (public.can_operate() OR auth.role() = 'service_role') THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  WITH grouped AS (
    SELECT
      UPPER(country_code) AS country_code,
      MAX(country_name) AS country_name,
      COUNT(*)::BIGINT AS total_profiles,
      COUNT(*) FILTER (
        WHERE created_at >= p_metric_date::TIMESTAMPTZ
          AND created_at < (p_metric_date + 1)::TIMESTAMPTZ
      )::BIGINT AS new_registrations
    FROM public.profiles
    WHERE country_code IS NOT NULL
      AND trim(country_code) <> ''
      AND location_consent_at IS NOT NULL
    GROUP BY UPPER(country_code)
  ),
  upserted AS (
    INSERT INTO public.admin_region_daily_metrics (
      country_code,
      country_name,
      metric_date,
      total_profiles,
      active_users,
      new_registrations,
      posts,
      views,
      reports,
      source
    )
    SELECT
      country_code,
      COALESCE(NULLIF(country_name, ''), country_code),
      p_metric_date,
      total_profiles,
      0,
      new_registrations,
      0,
      0,
      0,
      'voluntary_profiles'
    FROM grouped
    ON CONFLICT (country_code, metric_date, source)
    DO UPDATE SET
      country_name = EXCLUDED.country_name,
      total_profiles = EXCLUDED.total_profiles,
      active_users = EXCLUDED.active_users,
      new_registrations = EXCLUDED.new_registrations,
      updated_at = NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_upserted FROM upserted;

  RETURN jsonb_build_object(
    'ok', true,
    'metric_date', p_metric_date,
    'source', 'voluntary_profiles',
    'countries_upserted', COALESCE(v_upserted, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_admin_region_metrics_from_profiles(DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_admin_region_metrics_from_profiles(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_admin_region_metrics_from_profiles(DATE) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_region_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generated_at TIMESTAMPTZ := NOW();
  v_total_profiles BIGINT := 0;
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
      MAX(total_profiles) AS total_profiles,
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
    COALESCE(SUM(total_profiles), 0),
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
          'total_profiles', total_profiles,
          'active_users_30d', active_users_30d,
          'new_registrations_30d', new_registrations_30d,
          'posts_30d', posts_30d,
          'views_30d', views_30d,
          'reports_30d', reports_30d,
          'latest_metric_date', latest_metric_date
        )
        ORDER BY GREATEST(total_profiles, active_users_30d) DESC, views_30d DESC
      ),
      '[]'::JSONB
    )
  INTO v_total_profiles, v_total_active, v_total_new, v_total_posts, v_total_views, v_total_reports, v_regions
  FROM by_country;

  RETURN jsonb_build_object(
    'generated_at', v_generated_at,
    'summary', jsonb_build_object(
      'total_profiles', v_total_profiles,
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
