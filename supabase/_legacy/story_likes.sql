-- ================================================
-- VIBES APP - Story Likes
-- Bereits ausgeführt: 2026-03-29
-- ================================================

create table if not exists public.story_likes (
  id uuid default gen_random_uuid() primary key,
  story_id uuid references public.stories(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(story_id, user_id)
);

alter table public.story_likes enable row level security;

create policy "story_likes public read"
  on public.story_likes for select using (true);

create policy "story_likes insert own"
  on public.story_likes for insert with check (auth.uid() = user_id);

create policy "story_likes delete own"
  on public.story_likes for delete using (auth.uid() = user_id);
