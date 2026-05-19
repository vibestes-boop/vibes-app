-- Enrich voluntary regional snapshots with author-derived activity.
-- Region is still explicit profile input only; posts are attributed by the
-- author's voluntarily stored country, not by IP/GPS inference.

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

  -- This source is a current profile snapshot, not a historical daily import.
  -- Keep only the latest generated row per country to avoid summing the same
  -- total profile/post counts repeatedly across the 30-day dashboard window.
  DELETE FROM public.admin_region_daily_metrics
  WHERE source = 'voluntary_profiles';

  WITH grouped AS (
    SELECT
      UPPER(p.country_code) AS country_code,
      MAX(p.country_name) AS country_name,
      COUNT(DISTINCT p.id)::BIGINT AS total_profiles,
      COUNT(DISTINCT p.id) FILTER (
        WHERE p.created_at >= p_metric_date::TIMESTAMPTZ
          AND p.created_at < (p_metric_date + 1)::TIMESTAMPTZ
      )::BIGINT AS new_registrations,
      COUNT(DISTINCT p.id) FILTER (WHERE post_counts.post_count > 0)::BIGINT AS active_users,
      COALESCE(SUM(post_counts.post_count), 0)::BIGINT AS posts
    FROM public.profiles p
    LEFT JOIN (
      SELECT
        author_id,
        COUNT(*)::BIGINT AS post_count
      FROM public.posts
      GROUP BY author_id
    ) post_counts ON post_counts.author_id = p.id
    WHERE p.country_code IS NOT NULL
      AND trim(p.country_code) <> ''
      AND p.location_consent_at IS NOT NULL
    GROUP BY UPPER(p.country_code)
  ),
  inserted AS (
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
      active_users,
      new_registrations,
      posts,
      0,
      0,
      'voluntary_profiles'
    FROM grouped
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_upserted FROM inserted;

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
