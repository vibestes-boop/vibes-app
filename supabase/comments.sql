-- ================================================
-- VIBES APP - Kommentare
-- Ausführen im Supabase SQL Editor
-- ================================================

create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  text text not null check (char_length(text) > 0 and char_length(text) <= 500),
  created_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Kommentare sind öffentlich lesbar"
  on public.comments for select using (true);

create policy "Eingeloggte User können kommentieren"
  on public.comments for insert
  with check (auth.uid() = user_id);

create policy "User können eigene Kommentare löschen"
  on public.comments for delete
  using (auth.uid() = user_id);
