-- ═══════════════════════════════════════════════════════════════
-- Virtuelle Geschenke System
-- Tabellen: coins_wallets, gift_catalog, gift_transactions
-- + RPC: send_gift (atomic: debit sender, credit creator)
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. User Wallets ─────────────────────────────────────────────────────────
create table if not exists coins_wallets (
  user_id       uuid primary key references profiles(id) on delete cascade,
  coins         integer not null default 0 check (coins >= 0),
  diamonds      integer not null default 0 check (diamonds >= 0), -- Creator-Earnings
  total_gifted  integer not null default 0,  -- Gesamtausgaben des Users
  updated_at    timestamptz default now()
);

alter table coins_wallets enable row level security;

-- User kann nur eigene Wallet lesen
create policy "wallet_select_own" on coins_wallets
  for select using (auth.uid() = user_id);

-- Nur Backend (service_role) darf schreiben
create policy "wallet_update_service" on coins_wallets
  for all using (auth.role() = 'service_role');

-- ─── 2. Gift Katalog ─────────────────────────────────────────────────────────
create table if not exists gift_catalog (
  id            text primary key,
  name          text not null,
  emoji         text not null,
  coin_cost     integer not null check (coin_cost > 0),
  diamond_value integer not null check (diamond_value > 0),
  lottie_url    text,           -- LottieFiles CDN URL (optional)
  color         text,           -- Primärfarbe für UI
  sort_order    integer default 0
);

alter table gift_catalog enable row level security;

-- Jeder kann Katalog lesen
create policy "gift_catalog_public_read" on gift_catalog
  for select using (true);

-- Initiale Geschenke einfügen
insert into gift_catalog (id, name, emoji, coin_cost, diamond_value, color, sort_order, lottie_url) values
  ('rose',      'Rose',       '🌹',  10,    8,    '#f43f5e', 1, 'https://assets7.lottiefiles.com/packages/lf20_BYRdkI.json'),
  ('heart',     'Heart',      '❤️',  25,   20,    '#ef4444', 2, 'https://assets3.lottiefiles.com/packages/lf20_k2ednosd.json'),
  ('diamond',   'Diamond',    '💎',  100,  85,    '#06b6d4', 3, 'https://assets9.lottiefiles.com/packages/lf20_9GHVnS.json'),
  ('crown',     'Crown',      '👑',  250, 215,    '#f59e0b', 4, 'https://assets1.lottiefiles.com/packages/lf20_3BVPbK.json'),
  ('trophy',    'Trophy',     '🏆',  500, 435,    '#eab308', 5, null),
  ('galaxy',    'Galaxy',     '🌌', 1000, 880,    '#8b5cf6', 6, null),
  ('lion',      'Lion',       '🦁', 2500,2200,    '#f97316', 7, null),
  ('unicorn',   'Unicorn',   '🦄',  5000,4400,    '#ec4899', 8, null)
on conflict (id) do nothing;

-- ─── 3. Gift Transaktionen ────────────────────────────────────────────────────
create table if not exists gift_transactions (
  id               uuid primary key default gen_random_uuid(),
  sender_id        uuid not null references profiles(id) on delete cascade,
  recipient_id     uuid not null references profiles(id) on delete cascade,
  live_session_id  text not null, -- LiveKit room ID
  gift_id          text not null references gift_catalog(id),
  coin_cost        integer not null,
  diamond_value    integer not null,
  created_at       timestamptz default now()
);

create index if not exists idx_gift_tx_session    on gift_transactions(live_session_id, created_at desc);
create index if not exists idx_gift_tx_recipient  on gift_transactions(recipient_id, created_at desc);
create index if not exists idx_gift_tx_sender     on gift_transactions(sender_id, created_at desc);

alter table gift_transactions enable row level security;

-- User kann eigene Transaktionen sehen (als Sender oder Empfänger)
create policy "gift_tx_select" on gift_transactions
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Insert erlaubt (die Validierung macht die RPC)
create policy "gift_tx_insert" on gift_transactions
  for insert with check (auth.uid() = sender_id);

-- ─── 4. Atomic RPC: send_gift ─────────────────────────────────────────────────
-- Führt in einer DB-Transaktion aus:
-- 1. Prüft ob Sender genug Coins hat
-- 2. Zieht Coins vom Sender ab
-- 3. Schreibt Diamonds an Creator
-- 4. Speichert Transaktion
create or replace function send_gift(
  p_recipient_id    uuid,
  p_live_session_id text,
  p_gift_id         text
) returns jsonb
language plpgsql security definer
as $$
declare
  v_sender_id     uuid := auth.uid();
  v_gift          gift_catalog%rowtype;
  v_sender_coins  integer;
begin
  -- Gift laden
  select * into v_gift from gift_catalog where id = p_gift_id;
  if not found then
    return jsonb_build_object('error', 'gift_not_found');
  end if;

  -- Sender kann nicht an sich selbst verschenken
  if v_sender_id = p_recipient_id then
    return jsonb_build_object('error', 'cannot_gift_yourself');
  end if;

  -- Sender Wallet (mit Lock)
  select coins into v_sender_coins
  from coins_wallets
  where user_id = v_sender_id
  for update;

  if not found then
    return jsonb_build_object('error', 'no_wallet');
  end if;

  if v_sender_coins < v_gift.coin_cost then
    return jsonb_build_object('error', 'insufficient_coins', 'balance', v_sender_coins);
  end if;

  -- Coins vom Sender abziehen
  update coins_wallets
  set coins = coins - v_gift.coin_cost,
      total_gifted = total_gifted + v_gift.coin_cost,
      updated_at = now()
  where user_id = v_sender_id;

  -- Diamonds an Creator gutschreiben
  insert into coins_wallets (user_id, diamonds, updated_at)
  values (p_recipient_id, v_gift.diamond_value, now())
  on conflict (user_id) do update
    set diamonds = coins_wallets.diamonds + v_gift.diamond_value,
        updated_at = now();

  -- Transaktion speichern
  insert into gift_transactions
    (sender_id, recipient_id, live_session_id, gift_id, coin_cost, diamond_value)
  values
    (v_sender_id, p_recipient_id, p_live_session_id, p_gift_id, v_gift.coin_cost, v_gift.diamond_value);

  return jsonb_build_object('success', true, 'new_balance', v_sender_coins - v_gift.coin_cost);
end;
$$;

-- ─── 5. Wallet automatisch beim User-Signup erstellen ────────────────────────
create or replace function create_user_wallet()
returns trigger language plpgsql security definer as $$
begin
  insert into coins_wallets (user_id, coins) values (new.id, 0)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_create_wallet on profiles;
create trigger on_profile_created_create_wallet
  after insert on profiles
  for each row execute function create_user_wallet();
