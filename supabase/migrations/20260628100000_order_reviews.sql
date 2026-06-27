-- 20260628100000_order_reviews.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Bewertungen für Echtgeld-Bestellungen (Käufer ↔ Verkäufer), nach Lieferung.
-- Beidseitig: der Käufer bewertet den Verkäufer/das Produkt, der Verkäufer den
-- Käufer (Marktplatz-Reputation). Getrennt von product_reviews (Coin-Produkte).
--
-- Schreiben nur über die SECURITY-DEFINER-RPC submit_order_review (prüft: Order-
-- Partei + status='delivered'). Lesen: beide Order-Parteien.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.order_reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.product_orders(id) on delete cascade,
  reviewer_id   uuid not null references public.profiles(id) on delete cascade,
  reviewee_id   uuid not null references public.profiles(id) on delete cascade,
  reviewer_role text not null check (reviewer_role in ('buyer','seller')),
  rating        int  not null check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (order_id, reviewer_id)   -- eine Bewertung pro Person & Bestellung
);

alter table public.order_reviews enable row level security;

-- Beide Parteien der Bestellung dürfen die Bewertungen lesen (eigene + erhaltene).
drop policy if exists order_reviews_party_read on public.order_reviews;
create policy order_reviews_party_read on public.order_reviews
  for select using (auth.uid() = reviewer_id or auth.uid() = reviewee_id);

-- Kein direktes INSERT/UPDATE für authenticated → läuft ausschließlich über die RPC.
grant select on public.order_reviews to authenticated;

create index if not exists idx_order_reviews_order    on public.order_reviews(order_id);
create index if not exists idx_order_reviews_reviewee on public.order_reviews(reviewee_id);

create or replace function public.set_order_reviews_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_order_reviews_updated_at on public.order_reviews;
create trigger trg_order_reviews_updated_at
  before update on public.order_reviews
  for each row execute function public.set_order_reviews_updated_at();

-- ── RPC: Bewertung abgeben (nur nach Lieferung, nur Order-Partei) ─────────────
create or replace function public.submit_order_review(
  p_order_id uuid,
  p_rating   int,
  p_comment  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_order    public.product_orders%rowtype;
  v_role     text;
  v_reviewee uuid;
  v_comment  text := nullif(btrim(p_comment), '');
begin
  if v_caller is null then return jsonb_build_object('error','not_authenticated'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('error','invalid_rating');
  end if;
  if v_comment is not null and length(v_comment) > 1000 then
    v_comment := left(v_comment, 1000);
  end if;

  select * into v_order from public.product_orders where id = p_order_id;
  if not found then return jsonb_build_object('error','order_not_found'); end if;

  if v_caller = v_order.buyer_id then
    v_role := 'buyer'; v_reviewee := v_order.seller_id;
  elsif v_caller = v_order.seller_id then
    v_role := 'seller'; v_reviewee := v_order.buyer_id;
  else
    return jsonb_build_object('error','not_authorized');
  end if;

  if v_order.status <> 'delivered' then
    return jsonb_build_object('error','not_delivered');
  end if;

  insert into public.order_reviews
    (order_id, reviewer_id, reviewee_id, reviewer_role, rating, comment)
  values
    (p_order_id, v_caller, v_reviewee, v_role, p_rating, v_comment)
  on conflict (order_id, reviewer_id) do update
    set rating = excluded.rating, comment = excluded.comment, updated_at = now();

  return jsonb_build_object('success', true);
end $$;

revoke all on function public.submit_order_review(uuid, int, text) from public, anon;
grant execute on function public.submit_order_review(uuid, int, text) to authenticated;
