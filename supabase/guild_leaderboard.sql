-- ── Guild Leaderboard RPC ─────────────────────────────────────────────────
-- Gibt Top-Posts und Top-Mitglieder einer Guild zurück,
-- sortiert nach dwell_time_score (NICHT Likes).
-- Zeitfenster: letzte 7 Tage ("Diese Woche")

CREATE OR REPLACE FUNCTION get_guild_leaderboard(p_guild_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_top_posts   JSONB;
  v_top_members JSONB;
BEGIN

  -- ── Top 10 Posts nach Dwell-Time-Score ─────────────────────────────────
  SELECT jsonb_agg(row_to_json(t)) INTO v_top_posts
  FROM (
    SELECT
      p.id,
      p.caption,
      p.media_url,
      p.media_type,
      p.thumbnail_url,                                         -- Statisches Thumbnail für Videos
      COALESCE(p.dwell_time_score, 0)                        AS dwell_time_score,
      -- Verweildauer in Sekunden (EMA * 30s Max-Duration Estimate)
      ROUND((COALESCE(p.dwell_time_score, 0) * 30)::numeric, 1) AS avg_seconds,
      -- Completion Rate als Prozent
      ROUND((COALESCE(p.dwell_time_score, 0) * 100)::numeric, 0) AS completion_pct,
      p.created_at,
      pr.id       AS author_id,
      pr.username AS author_username,
      pr.avatar_url AS author_avatar
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    WHERE pr.guild_id = p_guild_id
      AND p.created_at > NOW() - INTERVAL '30 days'
    ORDER BY p.dwell_time_score DESC NULLS LAST, p.created_at DESC
    LIMIT 10
  ) t;

  -- ── Top 10 Mitglieder nach Durchschnitts-Score ──────────────────────────
  SELECT jsonb_agg(row_to_json(t)) INTO v_top_members
  FROM (
    SELECT
      pr.id,
      pr.username,
      pr.avatar_url,
      COUNT(p.id)                                                AS post_count,
      ROUND(AVG(COALESCE(p.dwell_time_score, 0))::numeric, 3)   AS avg_dwell_score,
      ROUND((AVG(COALESCE(p.dwell_time_score, 0)) * 100)::numeric, 0) AS avg_completion_pct,
      MAX(COALESCE(p.dwell_time_score, 0))                       AS best_score
    FROM public.profiles pr
    JOIN public.posts p ON p.author_id = pr.id
    WHERE pr.guild_id = p_guild_id
      AND p.created_at > NOW() - INTERVAL '30 days'
    GROUP BY pr.id, pr.username, pr.avatar_url
    HAVING COUNT(p.id) > 0
    ORDER BY avg_dwell_score DESC NULLS LAST
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'top_posts',   COALESCE(v_top_posts,   '[]'::jsonb),
    'top_members', COALESCE(v_top_members, '[]'::jsonb)
  );
END;
$$;
