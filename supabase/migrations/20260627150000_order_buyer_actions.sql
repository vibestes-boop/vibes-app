-- 20260627150000_order_buyer_actions.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Käufer-Aktionen für Echtgeld-Bestellungen (product_orders), Phase 1.
--
--  1) cancel_product_order — Stornieren NUR solange unbezahlt
--     (status = 'payment_requested'). Kein Geld geflossen → gefahrlos.
--     Entfernt die verknüpfte Vormerkung (umentschieden = raus) + Push an
--     den Verkäufer. Ab 'paid' bewusst Fehler 'already_paid' → das UI leitet
--     dann auf „Verkäufer kontaktieren" (manuelle Stripe-Erstattung, kein
--     Auto-Refund in Phase 1 ohne AGB/Widerruf).
--
--  2) update_order_shipping_address — Lieferadresse ändern NUR solange 'paid'
--     (bezahlt, noch nicht versendet). Danach ist das Paket raus → gesperrt.
--     Push an den Verkäufer, damit nicht an die alte Adresse versendet wird.
--
-- Beide SECURITY DEFINER (product_orders ist service-write per RLS) mit
-- eigener buyer_id-Identitätsprüfung. Notifs nutzen den bestehenden Typ 'gift'
-- + comment_text (wie der übrige Bestell-Lebenszyklus).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Stornieren (nur unbezahlt) ─────────────────────────────────────────────
create or replace function public.cancel_product_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_order  public.product_orders%rowtype;
begin
  if v_caller is null then
    return jsonb_build_object('error','not_authenticated');
  end if;

  select * into v_order from public.product_orders where id = p_order_id;
  if not found then return jsonb_build_object('error','order_not_found'); end if;

  if v_order.buyer_id <> v_caller then
    return jsonb_build_object('error','not_authorized');
  end if;

  -- Ab 'paid' braucht es eine Rückerstattung (Stripe-Refund) → manuell durch den
  -- Verkäufer. Hier nur der gefahrlose Pfad: vor der Zahlung.
  if v_order.status = 'paid' then
    return jsonb_build_object('error','already_paid');
  end if;
  if v_order.status <> 'payment_requested' then
    return jsonb_build_object('error','not_cancellable');
  end if;

  update public.product_orders
     set status = 'cancelled', updated_at = now()
   where id = p_order_id;

  -- Vormerkung entfernen (Käufer hat sich umentschieden → raus aus der Liste).
  -- preorder_id ist ein loser uuid-Link (kein FK) → Löschen ist gefahrlos.
  if v_order.preorder_id is not null then
    delete from public.product_preorders where id = v_order.preorder_id;
  end if;

  begin
    insert into public.notifications (recipient_id, sender_id, type, comment_text)
    values (v_order.seller_id, v_caller, 'gift', 'Eine Bestellung wurde storniert.');
  exception when others then null;
  end;

  return jsonb_build_object('success', true);
end $$;

revoke all on function public.cancel_product_order(uuid) from public, anon;
grant execute on function public.cancel_product_order(uuid) to authenticated;

-- ── 2. Lieferadresse ändern (nur bezahlt, noch nicht versendet) ───────────────
create or replace function public.update_order_shipping_address(
  p_order_id uuid,
  p_name     text,
  p_street   text,
  p_zip      text,
  p_city     text,
  p_country  text default 'DE'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid := auth.uid();
  v_order   public.product_orders%rowtype;
  v_name    text := nullif(btrim(p_name), '');
  v_street  text := nullif(btrim(p_street), '');
  v_zip     text := nullif(btrim(p_zip), '');
  v_city    text := nullif(btrim(p_city), '');
  v_country text := upper(coalesce(nullif(btrim(p_country), ''), 'DE'));
begin
  if v_caller is null then
    return jsonb_build_object('error','not_authenticated');
  end if;

  select * into v_order from public.product_orders where id = p_order_id;
  if not found then return jsonb_build_object('error','order_not_found'); end if;

  if v_order.buyer_id <> v_caller then
    return jsonb_build_object('error','not_authorized');
  end if;

  -- Nur solange bezahlt + noch nicht versendet. Nach Versand ist das Paket raus.
  if v_order.status <> 'paid' then
    return jsonb_build_object('error','not_editable');
  end if;

  if v_name is null or v_street is null or v_zip is null or v_city is null then
    return jsonb_build_object('error','incomplete_address');
  end if;
  if v_country not in ('DE','AT','CH') then
    return jsonb_build_object('error','country_not_supported');
  end if;

  update public.product_orders
     set ship_name    = v_name,
         ship_street  = v_street,
         ship_zip     = v_zip,
         ship_city    = v_city,
         ship_country = v_country,
         updated_at   = now()
   where id = p_order_id;

  begin
    insert into public.notifications (recipient_id, sender_id, type, comment_text)
    values (v_order.seller_id, v_caller, 'gift', 'Eine Lieferadresse wurde aktualisiert.');
  exception when others then null;
  end;

  return jsonb_build_object('success', true);
end $$;

revoke all on function public.update_order_shipping_address(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_order_shipping_address(uuid, text, text, text, text, text) to authenticated;
