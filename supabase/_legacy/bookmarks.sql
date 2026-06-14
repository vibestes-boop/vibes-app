-- ================================================
-- VIBES APP - Bookmarks (Gespeicherte Posts)
-- Ausführen im Supabase SQL Editor
-- ================================================

create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, post_id)
);

alter table public.bookmarks enable row level security;

-- Jeder sieht nur seine eigenen Bookmarks
create policy "bookmarks_select" on public.bookmarks
  for select using (auth.uid() = user_id);

create policy "bookmarks_insert" on public.bookmarks
  for insert with check (auth.uid() = user_id);

create policy "bookmarks_delete" on public.bookmarks
  for delete using (auth.uid() = user_id);
