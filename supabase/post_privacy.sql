-- ================================================================
-- POST VISIBILITY / PRIVACY MIGRATION
-- Ausführen im Supabase SQL Editor
-- ================================================================

-- 1. Spalten zu posts hinzufügen
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS privacy        text NOT NULL DEFAULT 'public'
    CHECK (privacy IN ('public', 'friends', 'private')),
  ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_duet     boolean NOT NULL DEFAULT true;

-- 2. Index für schnelle Privacy-Filterung im Feed
CREATE INDEX IF NOT EXISTS idx_posts_privacy ON public.posts(privacy) WHERE NOT is_guild_post;

-- 3. RLS Policy: Posts sichtbar je nach Privacy
--    - 'public'  → alle sehen
--    - 'friends' → nur der Autor selbst und Follower des Autors
--    - 'private' → nur der Autor selbst

-- Bestehende Policy entfernen und neu erstellen
DROP POLICY IF EXISTS "Posts sind öffentlich lesbar" ON public.posts;

CREATE POLICY "posts_visibility_policy"
  ON public.posts
  FOR SELECT
  USING (
    -- Eigene Posts immer sehen
    auth.uid() = author_id
    OR
    -- Public Posts: jeder
    privacy = 'public'
    OR
    -- Friends Posts: nur Follower des Autors
    (
      privacy = 'friends'
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = auth.uid()
          AND following_id = posts.author_id
      )
    )
    -- private: nur Autor (bereits oben abgedeckt)
  );

-- 4. get_vibe_feed RPC updaten — filtert 'friends' und 'private' Posts korrekt
CREATE OR REPLACE FUNCTION get_vibe_feed(
  explore_weight  float   DEFAULT 0.5,
  brain_weight    float   DEFAULT 0.5,
  result_limit    int     DEFAULT 20,
  filter_tag      text    DEFAULT NULL,
  include_seen    boolean DEFAULT true,
  exclude_ids     uuid[]  DEFAULT '{}'
)
RETURNS TABLE (
  id               uuid,
  author_id        uuid,
  caption          text,
  media_url        text,
  media_type       text,
  thumbnail_url    text,
  dwell_time_score float,
  score_explore    float,
  score_brain      float,
  tags             text[],
  guild_id         uuid,
  is_guild_post    boolean,
  created_at       timestamptz,
  username         text,
  avatar_url       text,
  final_score      float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    p.caption,
    p.media_url,
    p.media_type,
    p.thumbnail_url,
    p.dwell_time_score,
    p.score_explore,
    p.score_brain,
    p.tags,
    p.guild_id,
    p.is_guild_post,
    p.created_at,
    pr.username,
    pr.avatar_url,
    (
      p.dwell_time_score * 0.5 +
      (1.0 - abs(p.score_explore - explore_weight)) * 0.25 +
      (1.0 - abs(p.score_brain   - brain_weight))   * 0.25
    ) AS final_score
  FROM public.posts p
  LEFT JOIN public.profiles pr ON pr.id = p.author_id
  WHERE
    p.is_guild_post = false
    -- ── Privacy-Filter ──────────────────────────────────────────────────
    AND (
      -- Eigene Posts immer sehen
      p.author_id = auth.uid()
      OR p.privacy = 'public'
      OR (
        p.privacy = 'friends'
        AND EXISTS (
          SELECT 1 FROM public.follows
          WHERE follower_id = auth.uid()
            AND following_id = p.author_id
        )
      )
    )
    -- ── Tag-Filter (optional) ────────────────────────────────────────────
    AND (filter_tag IS NULL OR p.tags @> ARRAY[filter_tag])
    -- ── ID-Exclusion Cursor ──────────────────────────────────────────────
    AND (array_length(exclude_ids, 1) IS NULL OR p.id != ALL(exclude_ids))
  ORDER BY final_score DESC, p.created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Kommentare-RLS: allow_comments berücksichtigen
--    Wenn allow_comments = false → niemand außer dem Autor kann kommentieren
DROP POLICY IF EXISTS "comments_insert_policy" ON public.comments;

CREATE POLICY "comments_insert_policy"
  ON public.comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Autor kann immer kommentieren
      EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid())
      OR
      -- Kommentare erlaubt?
      EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND allow_comments = true)
    )
  );
