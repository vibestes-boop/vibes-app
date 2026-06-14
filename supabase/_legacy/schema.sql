-- ================================================
-- VIBES APP - Supabase Datenbank Schema
-- Ausführen im Supabase SQL Editor
-- ================================================

-- Guilds Tabelle
create table if not exists public.guilds (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  member_count integer default 0,
  vibe_tags text[] default '{}',
  created_at timestamptz default now()
);

-- Profiles Tabelle (erweitert auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text not null unique,
  bio text,
  avatar_url text,
  guild_id uuid references public.guilds(id),
  explore_vibe float default 0.5,
  brain_vibe float default 0.5,
  created_at timestamptz default now()
);

-- Posts Tabelle
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references public.profiles(id) on delete cascade not null,
  caption text,
  media_url text,
  media_type text default 'image' check (media_type in ('image', 'video')),
  dwell_time_score float default 0,
  tags text[] default '{}',
  guild_id uuid references public.guilds(id),
  is_guild_post boolean default false,
  created_at timestamptz default now()
);

-- ================================================
-- Row Level Security (RLS) aktivieren
-- ================================================

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.guilds enable row level security;

-- Profiles: Jeder kann lesen, nur eigenes Profil bearbeiten
create policy "Profiles sind öffentlich lesbar"
  on public.profiles for select using (true);

create policy "User kann eigenes Profil bearbeiten"
  on public.profiles for update using (auth.uid() = id);

create policy "User kann eigenes Profil erstellen"
  on public.profiles for insert with check (auth.uid() = id);

-- Posts: Jeder kann lesen, nur Autor kann erstellen/löschen
create policy "Posts sind öffentlich lesbar"
  on public.posts for select using (true);

create policy "Eingeloggte User können posten"
  on public.posts for insert with check (auth.uid() = author_id);

create policy "Autor kann eigene Posts löschen"
  on public.posts for delete using (auth.uid() = author_id);

-- Guilds: Jeder kann lesen
create policy "Guilds sind öffentlich lesbar"
  on public.guilds for select using (true);

-- ================================================
-- Trigger: Profil automatisch bei Registrierung erstellen
-- ================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
