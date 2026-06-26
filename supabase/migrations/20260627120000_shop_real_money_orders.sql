-- 20260627120000_shop_real_money_orders.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Phase-1-Fundament: echte €-Bestellungen für PHYSISCHE Ware (Parfüm zuerst).
--
-- Marktplatz-nativ entworfen ("du = Verkäufer #1"): dasselbe Schema trägt
-- später Drittverkäufer (Stripe Connect) ohne Umbau. Diese Migration legt NUR
-- das Schema (Tabellen/RLS/Index) — Stripe-Checkout, Webhook und Flow-RPCs
-- folgen in eigenen Schritten, sobald Provision/Streit-Fenster final sind.
--
-- Strikt getrennt vom virtuellen System (coins/diamonds, Tabelle `orders`).
-- Quelle der Wahrheit: Brain decisions/2026-06-27-serlo-finanz-architektur.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Verkäufer-Konten (Zaur = #1; Connect/KYC erst bei Drittverkäufern) ─────
create table if not exists public.seller_accounts (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  display_name      text,
  stripe_connect_id text,                          -- NULL bis Phase 2 (Drittverkäufer-Onboarding)
  kyc_status        text    not null default 'none',   -- none | pending | verified
  payout_enabled    boolean not null default false,
  platform_fee_bps  int     not null default 1000,     -- Provision in Basispunkten (1000 = 10%); Zaur = 0
  created_at        timestamptz not null default now()
);

alter table public.seller_accounts enable row level security;

-- Verkäufer-Basics sind öffentlich lesbar (Shop zeigt den Verkäufer an)
drop policy if exists seller_accounts_read on public.seller_accounts;
create policy seller_accounts_read on public.seller_accounts
  for select using (true);

-- Schreiben nur service_role (Onboarding/Admin/Connect-Webhook)
drop policy if exists seller_accounts_service_write on public.seller_accounts;
create policy seller_accounts_service_write on public.seller_accounts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ── 2. Echte €-Bestellungen ───────────────────────────────────────────────────
create table if not exists public.product_orders (
  id                uuid primary key default gen_random_uuid(),
  buyer_id          uuid not null references public.profiles(id) on delete cascade,
  seller_id         uuid not null references public.profiles(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,
  preorder_id       uuid,                           -- optionaler Link zur Vormerkung (product_preorders)

  quantity          int  not null default 1 check (quantity > 0),
  unit_price_eur    numeric(10,2) not null check (unit_price_eur >= 0),
  amount_eur        numeric(10,2) not null check (amount_eur >= 0),
  platform_fee_eur  numeric(10,2) not null default 0 check (platform_fee_eur >= 0),
  currency          text not null default 'eur',

  -- Lebenszyklus.
  -- Parfüm (Zaurs eigene Ware): reserved → payment_requested → paid → shipped → delivered.
  --   (Vormerken zahlt NICHTS; Zaur bestellt beim Lieferanten; Ware da → User zahlt → Versand.)
  -- Marktplatz (später, Drittverkäufer mit Escrow): + disputed / refunded / released.
  status            text not null default 'reserved'
                    check (status in ('reserved','payment_requested','paid','shipped','delivered','cancelled','refunded','disputed')),

  -- Versandadresse
  ship_name         text,
  ship_street       text,
  ship_zip          text,
  ship_city         text,
  ship_country      text default 'DE',
  tracking_carrier  text,
  tracking_number   text,

  -- Stripe (session_id = Idempotenz-Key)
  stripe_session_id     text unique,
  stripe_payment_intent text,

  -- Zeitstempel des Lebenszyklus
  payment_requested_at  timestamptz,
  paid_at               timestamptz,
  shipped_at            timestamptz,
  delivered_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.product_orders enable row level security;

-- Käufer sieht eigene Bestellungen (Status/Tracking = Wiederkehr-Hook),
-- Verkäufer sieht seine Verkäufe.
drop policy if exists product_orders_party_read on public.product_orders;
create policy product_orders_party_read on public.product_orders
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Schreiben nur service_role (Stripe-Webhook + SECURITY-DEFINER-RPCs).
drop policy if exists product_orders_service_write on public.product_orders;
create policy product_orders_service_write on public.product_orders
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_product_orders_buyer  on public.product_orders(buyer_id, created_at desc);
create index if not exists idx_product_orders_seller on public.product_orders(seller_id, created_at desc);
create index if not exists idx_product_orders_status on public.product_orders(status, created_at desc);
create index if not exists idx_product_orders_session on public.product_orders(stripe_session_id)
  where stripe_session_id is not null;

-- updated_at automatisch pflegen
create or replace function public.set_product_orders_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_product_orders_updated_at on public.product_orders;
create trigger trg_product_orders_updated_at
  before update on public.product_orders
  for each row execute function public.set_product_orders_updated_at();

-- ── 3. Zaur als Verkäufer #1 (Provision 0) ───────────────────────────────────
insert into public.seller_accounts (user_id, display_name, platform_fee_bps, payout_enabled, kyc_status)
select id, 'Serlo', 0, true, 'verified'
  from public.profiles where username = 'zaur'
on conflict (user_id) do nothing;
