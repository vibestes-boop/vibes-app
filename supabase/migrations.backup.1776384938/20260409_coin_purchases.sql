-- ═══════════════════════════════════════════════════════════════
-- Coin Purchases Log + credit_coins RPC
-- Für RevenueCat Webhook Idempotenz und Coin-Gutschrift
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Kauf-Log Tabelle ─────────────────────────────────────────────────────
create table if not exists coin_purchases (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  product_id      text not null,
  coins_credited  integer not null,
  transaction_id  text unique,          -- Idempotenz-Key
  event_type      text not null,
  raw_event       jsonb,                -- Vollständiges RevenueCat Event
  created_at      timestamptz default now()
);

alter table coin_purchases enable row level security;

-- Nur Service Role darf schreiben
create policy "coin_purchases_service_only" on coin_purchases
  for all using (auth.role() = 'service_role');

-- User kann eigene Käufe sehen
create policy "coin_purchases_select_own" on coin_purchases
  for select using (auth.uid() = user_id);

-- Index für schnelle Idempotenz-Checks
create index if not exists idx_coin_purchases_transaction_id
  on coin_purchases(transaction_id);

create index if not exists idx_coin_purchases_user_id
  on coin_purchases(user_id, created_at desc);

-- ─── 2. credit_coins RPC (atomic UPSERT + increment) ─────────────────────────
create or replace function credit_coins(
  p_user_id uuid,
  p_coins   integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Wallet erstellen falls nicht vorhanden, dann Coins addieren
  insert into coins_wallets (user_id, coins, updated_at)
  values (p_user_id, p_coins, now())
  on conflict (user_id) do update
    set coins      = coins_wallets.coins + excluded.coins,
        updated_at = now();
end;
$$;

-- Nur Service Role darf credit_coins aufrufen
revoke all on function credit_coins(uuid, integer) from public;
grant execute on function credit_coins(uuid, integer) to service_role;
