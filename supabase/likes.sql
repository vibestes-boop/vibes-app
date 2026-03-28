-- ================================================
-- VIBES APP - Likes System
-- Ausführen im Supabase SQL Editor
-- ================================================

create table if not exists public.likes (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table public.likes enable row level security;

create policy "Likes sind öffentlich lesbar"
  on public.likes for select using (true);

create policy "Eingeloggte User können liken"
  on public.likes for insert
  with check (auth.uid() = user_id);

create policy "User können eigene Likes entfernen"
  on public.likes for delete
  using (auth.uid() = user_id);
