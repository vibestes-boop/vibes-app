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

create policy "comments_insert_policy"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and (
          coalesce(p.allow_comments, true) = true
          or p.author_id = auth.uid()
        )
    )
  );

create policy "User können eigene Kommentare löschen"
  on public.comments for delete
  using (auth.uid() = user_id);
