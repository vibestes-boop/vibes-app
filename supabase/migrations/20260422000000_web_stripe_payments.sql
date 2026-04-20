-- ═══════════════════════════════════════════════════════════════
-- Web-Version Phase 10 — Stripe Coin-Kauf + Creator-Tips
--
-- Ziele:
--   1. Pricing-Tiers als DB-Tabelle (statt hart kodiert) — Admin kann später
--      Preise anpassen ohne Redeploy. Seed enthält vier Tiers in Parität zu
--      Native RevenueCat-Bundles, aber mit ~20% Bonus-Coins als Web-Incentive
--      (kein 30% App-Store-Fee auf Web).
--   2. `web_coin_orders` Tabelle — Server-initiierte Stripe-Checkout-Sessions
--      werden hier registriert bevor der User zu Stripe redirected wird.
--      Bei Webhook-Bestätigung wird der Order auf `paid` gesetzt und
--      `credit_coins` RPC aufgerufen. Das ist Idempotenz-Key (Stripe
--      liefert `session_id` als Unique).
--   3. `creator_tips` Tabelle — One-off Coin-Transfers von Viewer → Creator
--      ohne Gift-Wrapping (direkter Support). Delegiert an `send_gift`-Pattern
--      aber mit `is_tip=true` Marker und customizable Amount (nicht
--      Katalog-gebunden).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Pricing Tiers ────────────────────────────────────────────────────────

create table if not exists coin_pricing_tiers (
  id              text primary key,           -- z.B. "web-100", "web-1200"
  coins           integer not null check (coins > 0),
  bonus_coins     integer not null default 0 check (bonus_coins >= 0),
  price_cents     integer not null check (price_cents > 0),  -- EUR-Cent
  currency        text not null default 'eur',
  stripe_price_id text,                        -- Stripe Price-ID (per Env-Deploy gesetzt)
  badge_label     text,                        -- z.B. "Bestseller", "Beste Wert"
  sort_order      integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz default now()
);

alter table coin_pricing_tiers enable row level security;

-- Jeder kann Tiers lesen (Pricing-Seite ist public lesbar falls jemand das
-- Coin-Shop ohne Login anschauen will — kauft aber nur mit Login).
create policy "coin_tiers_public_read" on coin_pricing_tiers
  for select using (active = true);

-- Nur service_role schreibt
create policy "coin_tiers_service_write" on coin_pricing_tiers
  for all using (auth.role() = 'service_role');

-- Seed — Web-Incentive: ~20% mehr Coins als Native für gleichen Preis.
-- Stripe-Price-IDs werden nach Deployment im Stripe-Dashboard generiert und
-- per `update coin_pricing_tiers set stripe_price_id = '...'` eingespielt.
insert into coin_pricing_tiers (id, coins, bonus_coins, price_cents, badge_label, sort_order) values
  ('web-100',   100,   20,    199,  null,               1),   -- 120 für 1,99 €
  ('web-500',   500,  120,    899,  'Beliebt',          2),   -- 620 für 8,99 €
  ('web-1200', 1200,  350,   1999,  'Bestseller',       3),   -- 1550 für 19,99 €
  ('web-3000', 3000, 1000,   4999,  'Beste Wert',       4)    -- 4000 für 49,99 €
on conflict (id) do nothing;

-- ─── 2. Web-Coin-Orders ──────────────────────────────────────────────────────

create type coin_order_status as enum (
  'pending',    -- Checkout-Session erstellt, User nicht zurück
  'paid',       -- Webhook-Bestätigung, Coins gutgeschrieben
  'failed',     -- Stripe-Webhook meldet Fehler (z.B. SCA-Failure)
  'refunded',   -- Später — manuelle Erstattung
  'cancelled'   -- User hat Checkout abgebrochen / Timeout
);

create table if not exists web_coin_orders (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references profiles(id) on delete cascade,
  tier_id               text not null references coin_pricing_tiers(id),
  coins                 integer not null check (coins > 0),
  bonus_coins           integer not null default 0,
  price_cents           integer not null,
  currency              text not null default 'eur',
  status                coin_order_status not null default 'pending',
  stripe_session_id     text unique,                            -- cs_test_... / cs_live_...
  stripe_payment_intent text,                                   -- pi_...
  invoice_url           text,                                   -- Stripe hosted invoice
  receipt_url           text,                                   -- Stripe receipt
  paid_at               timestamptz,
  failed_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table web_coin_orders enable row level security;

-- User sieht nur eigene Orders (für Billing-Seite)
create policy "web_coin_orders_select_own" on web_coin_orders
  for select using (auth.uid() = user_id);

-- Nur service_role schreibt (Webhook, create-checkout-session Edge-Function)
create policy "web_coin_orders_service_write" on web_coin_orders
  for all using (auth.role() = 'service_role');

create index if not exists idx_web_coin_orders_user_date
  on web_coin_orders(user_id, created_at desc);
create index if not exists idx_web_coin_orders_status
  on web_coin_orders(status, created_at desc);
create index if not exists idx_web_coin_orders_session
  on web_coin_orders(stripe_session_id)
  where stripe_session_id is not null;

-- Trigger: updated_at pflegen
create or replace function set_web_coin_orders_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_web_coin_orders_updated_at on web_coin_orders;
create trigger trg_web_coin_orders_updated_at
  before update on web_coin_orders
  for each row execute function set_web_coin_orders_updated_at();

-- ─── 3. Creator-Tips (One-off Tips ohne Gift-Wrapping) ───────────────────────

create table if not exists creator_tips (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null references profiles(id) on delete cascade,
  recipient_id    uuid not null references profiles(id) on delete cascade,
  coin_amount     integer not null check (coin_amount > 0 and coin_amount <= 100000),
  message         text check (char_length(message) <= 140),
  created_at      timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

alter table creator_tips enable row level security;

-- Sender + Recipient sehen den Tip (Recipient für „Supporter-Wall" auf dem Profil)
create policy "creator_tips_select_sender" on creator_tips
  for select using (auth.uid() = sender_id);
create policy "creator_tips_select_recipient" on creator_tips
  for select using (auth.uid() = recipient_id);

-- Insert via RPC `send_creator_tip` — nicht direkt erlaubt
-- (wir validieren Balance + führen atomare Buchung aus)

create index if not exists idx_creator_tips_recipient
  on creator_tips(recipient_id, created_at desc);
create index if not exists idx_creator_tips_sender
  on creator_tips(sender_id, created_at desc);

-- ─── 4. RPC: send_creator_tip ────────────────────────────────────────────────

create or replace function send_creator_tip(
  p_recipient_id uuid,
  p_coin_amount  integer,
  p_message      text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_sender_id    uuid := auth.uid();
  v_sender_coins integer;
  v_diamonds     integer;
  v_tip_id       uuid;
begin
  if v_sender_id is null then
    raise exception 'unauthenticated';
  end if;
  if v_sender_id = p_recipient_id then
    raise exception 'cannot_tip_self';
  end if;
  if p_coin_amount is null or p_coin_amount < 1 or p_coin_amount > 100000 then
    raise exception 'invalid_amount';
  end if;
  if p_message is not null and char_length(p_message) > 140 then
    raise exception 'message_too_long';
  end if;

  -- Balance-Check (Row-Lock damit kein race)
  select coins into v_sender_coins from coins_wallets
    where user_id = v_sender_id for update;
  if v_sender_coins is null or v_sender_coins < p_coin_amount then
    raise exception 'insufficient_coins';
  end if;

  -- Diamonds-Conversion: 85% vom Coin-Amount (gleiche Ratio wie send_gift)
  v_diamonds := floor(p_coin_amount * 0.85)::integer;

  -- Atomic Buchung
  update coins_wallets
    set coins = coins - p_coin_amount,
        total_gifted = total_gifted + p_coin_amount,
        updated_at = now()
    where user_id = v_sender_id;

  insert into coins_wallets (user_id, coins, diamonds, updated_at)
    values (p_recipient_id, 0, v_diamonds, now())
    on conflict (user_id) do update
      set diamonds = coins_wallets.diamonds + excluded.diamonds,
          updated_at = now();

  insert into creator_tips (sender_id, recipient_id, coin_amount, message)
    values (v_sender_id, p_recipient_id, p_coin_amount, p_message)
    returning id into v_tip_id;

  return v_tip_id;
end $$;

revoke all on function send_creator_tip(uuid, integer, text) from public;
grant execute on function send_creator_tip(uuid, integer, text) to authenticated;

-- ─── 5. RPC: get_my_coin_order_history ───────────────────────────────────────

create or replace function get_my_coin_order_history(
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id                uuid,
  tier_id           text,
  coins             integer,
  bonus_coins       integer,
  price_cents       integer,
  currency          text,
  status            coin_order_status,
  invoice_url       text,
  receipt_url       text,
  paid_at           timestamptz,
  created_at        timestamptz
)
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  return query
    select o.id, o.tier_id, o.coins, o.bonus_coins, o.price_cents, o.currency,
           o.status, o.invoice_url, o.receipt_url, o.paid_at, o.created_at
    from web_coin_orders o
    where o.user_id = auth.uid()
    order by o.created_at desc
    limit least(p_limit, 200)
    offset p_offset;
end $$;

revoke all on function get_my_coin_order_history(integer, integer) from public;
grant execute on function get_my_coin_order_history(integer, integer) to authenticated;
