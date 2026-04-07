-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Missing Performance Indexes
-- Datum: 2026-04-05
--
-- Identifiziert durch Proxyman-Analyse und Codebase-Review.
-- Alle Queries die Seq-Scans verursachen wenn Tabellen wachsen.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Notifications ─────────────────────────────────────────────────────────
-- Query: WHERE recipient_id = X ORDER BY created_at DESC (useNotifications.ts)
-- Query: WHERE recipient_id = X AND is_read = false (unread count)
-- Ohne Index: Seq-Scan → langsam ab ~1000 Notifications pro User
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id, "read")
  WHERE "read" = false;

-- ─── 2. Stories ───────────────────────────────────────────────────────────────
-- Query: WHERE user_id = X ORDER BY created_at DESC (useStories.ts)
-- Query: WHERE expires_at > NOW() (aktive Stories)
CREATE INDEX IF NOT EXISTS idx_stories_user_created
  ON public.stories (user_id, created_at DESC);


-- ─── 3. Profiles — Guild-Suche ────────────────────────────────────────────────
-- Query: WHERE guild_id = X (Guild-Member Liste / Leaderboard)
CREATE INDEX IF NOT EXISTS idx_profiles_guild
  ON public.profiles (guild_id)
  WHERE guild_id IS NOT NULL;

-- ─── 4. Profiles — Username-Suche (Explore / @Mention Autocomplete) ──────────
-- Query: WHERE username ILIKE 'xyz%' (useExplore.ts, @Mention)
-- pg_trgm aktivieren (falls noch nicht vorhanden) + GIN-Index für ILIKE-Suche
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_username_gin
  ON public.profiles USING gin (username gin_trgm_ops);

-- ─── 5. Comments — Reply-Chains ───────────────────────────────────────────────
-- Query: WHERE parent_id = X ORDER BY created_at (useCommentReplies)
CREATE INDEX IF NOT EXISTS idx_comments_parent_created
  ON public.comments (parent_id, created_at)
  WHERE parent_id IS NOT NULL;

-- ─── 6. Comment Likes — Batch-Lookup ──────────────────────────────────────────
-- Query: WHERE comment_id = ANY(ids) (useCommentLikesBatch — neu)
-- Query: WHERE comment_id = ANY(ids) AND user_id = X
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment
  ON public.comment_likes (comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_user_comment
  ON public.comment_likes (user_id, comment_id);

-- ─── 7. Follows — Gegenseitige Followship-Check ───────────────────────────────
-- Query: WHERE follower_id = X AND following_id = Y (useFollow.ts isFollowing)
-- Bereits ein Index? Prüfen via: \d follows
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_pair
  ON public.follows (follower_id, following_id);

-- ─── 8. Post Dwell Log — Feed-Algorithmus ────────────────────────────────────
-- Query: WHERE user_id = X AND post_id = ANY(ids) (get_vibe_feed JOIN)
-- Dieser Index ist kritisch: get_vibe_feed macht LEFT JOIN auf post_dwell_log
CREATE INDEX IF NOT EXISTS idx_post_dwell_log_user_post
  ON public.post_dwell_log (user_id, post_id);

-- ─── Verifikation ──────────────────────────────────────────────────────
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
