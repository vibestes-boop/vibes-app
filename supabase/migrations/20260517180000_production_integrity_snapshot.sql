-- Production integrity snapshot for scheduled monitors.
-- Returns aggregates only; no secrets or user content are exposed.

CREATE OR REPLACE FUNCTION public.production_integrity_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_oldest_pending_at TIMESTAMPTZ := NULL;
  v_latest_error TEXT := NULL;
  v_empty_posts_count INTEGER := 0;
  v_media_reference_count INTEGER := 0;
  v_cron_jobs JSONB := '[]'::JSONB;
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'error')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'deleted')::INTEGER,
    MIN(created_at) FILTER (WHERE status = 'pending'),
    (
      ARRAY_AGG(last_error ORDER BY processed_at DESC NULLS LAST, created_at DESC)
        FILTER (WHERE status = 'error' AND last_error IS NOT NULL)
    )[1]
  INTO
    v_total_count,
    v_pending_count,
    v_error_count,
    v_deleted_count,
    v_oldest_pending_at,
    v_latest_error
  FROM public.r2_delete_queue;

  SELECT COUNT(*)::INTEGER
  INTO v_empty_posts_count
  FROM public.posts
  WHERE media_url IS NULL
    AND NULLIF(BTRIM(COALESCE(caption, '')), '') IS NULL;

  SELECT COUNT(*)::INTEGER
  INTO v_media_reference_count
  FROM public.posts
  WHERE media_url IS NOT NULL
     OR thumbnail_url IS NOT NULL;

  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $cron$
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'jobname', jobname,
            'schedule', schedule,
            'active', active
          )
          ORDER BY jobname
        ),
        '[]'::JSONB
      )
      FROM cron.job
      WHERE jobname IN (
        'r2-delete-queue',
        'publish-scheduled-posts',
        'scheduled-lives-cron',
        'scheduled-lives-cron-sql',
        'cleanup-stale-live-sessions',
        'cleanup-stale-lives-sql',
        'ai-image-daily-report',
        'ai-image-retention-weekly'
      )
    $cron$
    INTO v_cron_jobs;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'generated_at', NOW(),
    'r2_delete_queue', JSONB_BUILD_OBJECT(
      'total', COALESCE(v_total_count, 0),
      'pending', COALESCE(v_pending_count, 0),
      'error', COALESCE(v_error_count, 0),
      'deleted', COALESCE(v_deleted_count, 0),
      'oldest_pending_at', v_oldest_pending_at,
      'oldest_pending_age_seconds',
        CASE
          WHEN v_oldest_pending_at IS NULL THEN NULL
          ELSE EXTRACT(EPOCH FROM (NOW() - v_oldest_pending_at))::INTEGER
        END,
      'latest_error', v_latest_error
    ),
    'posts', JSONB_BUILD_OBJECT(
      'empty_content', COALESCE(v_empty_posts_count, 0),
      'media_references', COALESCE(v_media_reference_count, 0)
    ),
    'cron', JSONB_BUILD_OBJECT(
      'available', to_regclass('cron.job') IS NOT NULL,
      'jobs', v_cron_jobs
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.production_integrity_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.production_integrity_snapshot() TO anon, authenticated;
