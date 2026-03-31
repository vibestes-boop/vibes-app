-- ================================================
-- VIBES APP - Storage Bucket Setup
-- Ausführen im Supabase SQL Editor
-- ================================================

-- Storage Bucket für Post-Medien erstellen
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posts',
  'posts',
  true,
  52428800, -- 50MB Limit
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- Storage Bucket für Profilbilder (getrennt von Posts: eigene Policies, kein Video)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB Limit (Profilbilder brauchen kein 50MB)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Policies für avatars-Bucket
drop policy if exists "Eingeloggte User können Avatare hochladen" on storage.objects;
drop policy if exists "Avatare sind öffentlich lesbar" on storage.objects;
drop policy if exists "User können eigene Avatare überschreiben" on storage.objects;

create policy "Eingeloggte User können Avatare hochladen"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Avatare sind öffentlich lesbar"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "User können eigene Avatare überschreiben"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Alte Policies entfernen falls sie schon existieren
drop policy if exists "Eingeloggte User können Medien hochladen" on storage.objects;
drop policy if exists "Medien sind öffentlich lesbar" on storage.objects;
drop policy if exists "User können eigene Medien löschen" on storage.objects;

-- Policy: Eingeloggte User können hochladen
create policy "Eingeloggte User können Medien hochladen"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'posts');

-- Policy: Alle können Medien sehen (public bucket)
create policy "Medien sind öffentlich lesbar"
  on storage.objects for select
  to public
  using (bucket_id = 'posts');

-- Policy: User können nur eigene Medien löschen
create policy "User können eigene Medien löschen"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── Stories Bucket ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stories',
  'stories',
  true,
  52428800, -- 50MB
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'image/heic']
)
on conflict (id) do nothing;

drop policy if exists "Stories öffentlich lesbar" on storage.objects;
drop policy if exists "Eingeloggte User können Stories hochladen" on storage.objects;
drop policy if exists "User können eigene Stories löschen" on storage.objects;

create policy "Stories öffentlich lesbar"
  on storage.objects for select
  to public
  using (bucket_id = 'stories');

create policy "Eingeloggte User können Stories hochladen"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'stories' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "User können eigene Stories löschen"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'stories' and auth.uid()::text = (storage.foldername(name))[1]);

