-- Public feed/query timing indexes
--
-- Identified from production [supabase:timing] logs:
--   - posts:        privacy=public ORDER BY created_at DESC / view_count DESC
--   - live_sessions status=active ORDER BY viewer_count DESC, started_at ASC
--   - comments:     post_id + parent_id root comments ORDER BY created_at ASC
--
-- These are narrow, query-shaped indexes for the hot public web paths.

CREATE INDEX IF NOT EXISTS idx_posts_public_created_at_id
  ON public.posts (created_at DESC, id DESC)
  WHERE privacy = 'public';

CREATE INDEX IF NOT EXISTS idx_posts_public_view_count_id
  ON public.posts (view_count DESC NULLS LAST, id DESC)
  WHERE privacy = 'public';

CREATE INDEX IF NOT EXISTS idx_posts_author_created_at_id
  ON public.posts (author_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_live_sessions_active_listing
  ON public.live_sessions (viewer_count DESC, started_at ASC, id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_comments_post_root_created_at_id
  ON public.comments (post_id, created_at ASC, id ASC)
  WHERE parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_comments_post_parent_created_at_id
  ON public.comments (post_id, parent_id, created_at ASC, id ASC);
