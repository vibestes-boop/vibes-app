-- ================================================
-- VIBES APP - Follow System
-- Ausführen im Supabase SQL Editor
-- ================================================

create table if not exists public.follows (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (follower_id, following_id)
);

alter table public.follows enable row level security;

-- Jeder kann Follows sehen
create policy "follows_select" on public.follows
  for select using (true);

-- Nur eingeloggte User können folgen
create policy "follows_insert" on public.follows
  for insert with check (auth.uid() = follower_id);

-- Nur der Follower kann entfolgen
create policy "follows_delete" on public.follows
  for delete using (auth.uid() = follower_id);

-- ── Follower-Zahl eines Users ───────────────────────────
create or replace function get_follow_counts(target_user_id uuid)
returns table (followers bigint, following bigint) as $$
begin
  return query select
    (select count(*) from public.follows where following_id = target_user_id),
    (select count(*) from public.follows where follower_id  = target_user_id);
end;
$$ language plpgsql security definer;
