-- ================================================
-- VIBES APP - Guild Setup (USP 2)
-- Ausführen im Supabase SQL Editor
-- ================================================

-- 1. Die 5 MVP-Micro-Guilds einfügen
insert into public.guilds (id, name, description, vibe_tags) values
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Pod Alpha',  'Tech & Design Nerds',       array['Tech','Design','AI']),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Pod Beta',   'Art & Music Collective',     array['Art','Music','Photography']),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'Pod Gamma',  'Explorers & Nature Lovers',  array['Travel','Nature','Fitness']),
  ('a1b2c3d4-0004-0004-0004-000000000004', 'Pod Delta',  'Gaming & Entertainment',     array['Gaming','Movies','Humor']),
  ('a1b2c3d4-0005-0005-0005-000000000005', 'Pod Omega',  'Food & Lifestyle',           array['Food','Fashion','Lifestyle'])
on conflict (id) do nothing;

-- 2. Bestehende User ohne Guild zufällig einem Pod zuweisen
update public.profiles
set guild_id = (
  array[
    'a1b2c3d4-0001-0001-0001-000000000001',
    'a1b2c3d4-0002-0002-0002-000000000002',
    'a1b2c3d4-0003-0003-0003-000000000003',
    'a1b2c3d4-0004-0004-0004-000000000004',
    'a1b2c3d4-0005-0005-0005-000000000005'
  ])[floor(random() * 5 + 1)::int]::uuid
where guild_id is null;

-- 3. Trigger: Neue User automatisch einem zufälligen Pod zuweisen
create or replace function public.handle_new_user()
returns trigger as $$
declare
  guild_ids uuid[] := array[
    'a1b2c3d4-0001-0001-0001-000000000001'::uuid,
    'a1b2c3d4-0002-0002-0002-000000000002'::uuid,
    'a1b2c3d4-0003-0003-0003-000000000003'::uuid,
    'a1b2c3d4-0004-0004-0004-000000000004'::uuid,
    'a1b2c3d4-0005-0005-0005-000000000005'::uuid
  ];
  assigned_guild uuid;
begin
  assigned_guild := guild_ids[floor(random() * 5 + 1)::int];
  insert into public.profiles (id, username, guild_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    assigned_guild
  );
  return new;
end;
$$ language plpgsql security definer;

-- 4. Guild Feed RPC: Chronologisch, kein Algorithmus (das ist der USP!)
-- Zeigt ALLE Posts aller Mitglieder der eigenen Guild — inkl. thumbnail_url
create or replace function get_guild_feed(result_limit int default 50)
returns table (
  id              uuid,
  author_id       uuid,
  caption         text,
  media_url       text,
  media_type      text,
  thumbnail_url   text,
  tags            text[],
  created_at      timestamptz,
  username        text,
  avatar_url      text,
  author_guild_id uuid
) as $$
declare
  my_guild_id uuid;
begin
  -- Eigene Guild holen (NULL guard)
  select guild_id into my_guild_id
  from public.profiles
  where id = auth.uid();

  if my_guild_id is null then
    return;
  end if;

  return query
  select
    p.id,
    p.author_id,
    p.caption,
    p.media_url,
    p.media_type,
    p.thumbnail_url,
    p.tags,
    p.created_at,
    pr.username,
    pr.avatar_url,
    pr.guild_id as author_guild_id
  from public.posts p
  inner join public.profiles pr on pr.id = p.author_id
  where pr.guild_id = my_guild_id
  order by p.created_at desc
  limit result_limit;
end;
$$ language plpgsql security definer;
