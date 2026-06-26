-- 20260626120000_shop_banners.sql
-- Vermietbare Werbe-Banner-Fläche im Shop (Karussell unter den Menü-Shortcuts).
--
-- Designziel: Die Fläche ist ab Tag 1 datengetrieben, damit Zaur eigene Banner
-- schalten UND Werbeplätze vermieten kann, ohne dass dafür Code geändert werden
-- muss. Der volle Buchungs-/Abrechnungs-Flow (Ad-Server) kommt erst wenn jemand
-- wirklich mietet — die Spalten dafür (advertiser_label, starts_at/ends_at,
-- impression_count/click_count) sind aber schon angelegt.

create table if not exists public.shop_banners (
  id               uuid primary key default gen_random_uuid(),

  -- Inhalt
  tag              text,                       -- kleine Eyebrow-Zeile, z.B. „VORBESTELLUNG"
  title            text not null,
  subtitle         text,
  image_url        text,                       -- optionales Hintergrundbild (R2). Leer = bg_color
  bg_color         text not null default '#3a2a1a',  -- Fallback-Fläche wenn kein Bild
  link             text,                       -- Ziel: '/shop/<id>', '/coin-shop' oder 'tab:sale'

  -- Reihenfolge / Sichtbarkeit
  sort_order       int     not null default 0,
  active           boolean not null default true,

  -- Vermietung / Terminierung (für später — wird schon respektiert)
  advertiser_label text,                       -- wem der Platz gehört (Anzeige/Admin)
  starts_at        timestamptz,                -- null = sofort sichtbar
  ends_at          timestamptz,                -- null = kein Ablauf

  -- Analytics-Ready (Inkrement folgt in einer späteren Phase)
  impression_count bigint not null default 0,
  click_count      bigint not null default 0,

  created_at       timestamptz not null default now(),

  constraint shop_banners_title_len check (char_length(title) between 1 and 80),
  constraint shop_banners_window    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Aktive Banner schnell + sortiert holen
create index if not exists idx_shop_banners_active
  on public.shop_banners (sort_order)
  where active = true;

alter table public.shop_banners enable row level security;

-- Lesen: jeder darf aktive, im Zeitfenster liegende Banner sehen (auch via PostgREST).
drop policy if exists shop_banners_read on public.shop_banners;
create policy shop_banners_read on public.shop_banners
  for select
  using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >  now())
  );

-- Verwalten: nur Admins (Zaur). Vermietete Banner legt vorerst der Admin an.
drop policy if exists shop_banners_admin_all on public.shop_banners;
create policy shop_banners_admin_all on public.shop_banners
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- RPC: liefert die aktuell sichtbaren Banner in Reihenfolge.
-- SECURITY DEFINER, damit das Zeitfenster serverseitig autoritativ gefiltert wird.
create or replace function public.get_active_shop_banners()
returns setof public.shop_banners
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.shop_banners
  where active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >  now())
  order by sort_order asc, created_at desc
  limit 10;
$$;

revoke all on function public.get_active_shop_banners() from public;
grant execute on function public.get_active_shop_banners() to anon, authenticated;

-- ── Seed: 3 Launch-Banner (eigene Werbung). Idempotent über feste UUIDs. ──
insert into public.shop_banners (id, tag, title, subtitle, bg_color, link, sort_order, advertiser_label)
values
  ('11111111-1111-1111-1111-111111111111',
   'VORBESTELLUNG LÄUFT', 'Öl-Parfüm · halal · 10 ml', 'Jetzt vormerken → ab 9,90 €',
   '#3a2a1a', 'tab:sale', 10, 'Serlo'),
  ('22222222-2222-2222-2222-222222222222',
   'NEU FÜR DICH', '30 Düfte entdecken', 'Dupes · alkoholfrei · München',
   '#2a1a2e', 'tab:all', 20, 'Serlo'),
  ('33333333-3333-3333-3333-333333333333',
   'COMMUNITY', 'Eigenen Shop starten', 'In 2 Minuten verkaufen',
   '#15301f', '/shop/my-shop?create=1', 30, 'Serlo')
on conflict (id) do nothing;
