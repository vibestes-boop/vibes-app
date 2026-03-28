-- ================================================
-- VIBES APP - Vibe Feed RPC (USP 1)
-- Ausführen im Supabase SQL Editor
-- ================================================

-- 1. Genome-Columns zu posts hinzufügen
alter table public.posts
  add column if not exists score_explore float default 0.5 check (score_explore >= 0 and score_explore <= 1),
  add column if not exists score_brain   float default 0.5 check (score_brain   >= 0 and score_brain   <= 1);

-- 2. Personalisierte Feed-Funktion
-- final_score = dwell_time (50%) + explore_match (25%) + brain_match (25%)
-- explore_weight / brain_weight kommen vom UI-Slider (0.0 = links, 1.0 = rechts)

create or replace function get_vibe_feed(
  explore_weight float default 0.5,
  brain_weight   float default 0.5,
  result_limit   int   default 20
)
returns table (
  id              uuid,
  author_id       uuid,
  caption         text,
  media_url       text,
  media_type      text,
  dwell_time_score float,
  score_explore   float,
  score_brain     float,
  tags            text[],
  guild_id        uuid,
  is_guild_post   boolean,
  created_at      timestamptz,
  username        text,
  avatar_url      text,
  final_score     float
) as $$
begin
  return query
  select
    p.id,
    p.author_id,
    p.caption,
    p.media_url,
    p.media_type,
    p.dwell_time_score,
    p.score_explore,
    p.score_brain,
    p.tags,
    p.guild_id,
    p.is_guild_post,
    p.created_at,
    pr.username,
    pr.avatar_url,
    -- Algorithmus: Dwell (50%) + Explore-Match (25%) + Brain-Match (25%)
    (
      p.dwell_time_score * 0.5 +
      (1.0 - abs(p.score_explore - explore_weight)) * 0.25 +
      (1.0 - abs(p.score_brain   - brain_weight))   * 0.25
    ) as final_score
  from public.posts p
  left join public.profiles pr on pr.id = p.author_id
  where p.is_guild_post = false
  order by final_score desc, p.created_at desc
  limit result_limit;
end;
$$ language plpgsql security definer;
