'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getMyReview, type ProductReview } from '@/lib/data/shop';
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateInput,
  type ProductUpdateInput,
} from '@shared/schemas/product';

// -----------------------------------------------------------------------------
// Shop-Server-Actions — Käufer- und Händler-Seite.
// Käufer: toggleSaveProduct, buyProduct, submitReview, reportProduct.
// Händler: createProduct, updateProduct, deleteProduct, toggleProductActive.
//
// Buy geht explizit über die Native-RPC `buy_product` weil da die atomare
// Coin-Abbuchung + Seller-Credit + Order-Insert + Notification-Push schon
// battle-tested zusammenpackt ist. Alles andere sind direkte Table-Ops mit
// RLS-Absicherung (Native nutzt mal RPC mal Table, Web vereinheitlicht auf
// das einfachere Direkt-Pattern wo kein atomarer Cross-Tabellen-Fluss nötig ist).
// -----------------------------------------------------------------------------

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function getViewerId(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

// -----------------------------------------------------------------------------
// toggleSaveProduct — Merken/Entmerken. Nutzt Native-RPC für Atomarität.
// -----------------------------------------------------------------------------

export async function toggleSaveProduct(
  productId: string,
  currentlySaved: boolean,
): Promise<ActionResult<{ saved: boolean }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();

  if (currentlySaved) {
    const { error } = await supabase
      .from('saved_products')
      .delete()
      .eq('user_id', viewer.id)
      .eq('product_id', productId);
    if (error) return { ok: false, error: error.message };
    revalidateTag(`product:${productId}`);
    return { ok: true, data: { saved: false } };
  }

  const { error } = await supabase.from('saved_products').upsert(
    { user_id: viewer.id, product_id: productId },
    { onConflict: 'user_id,product_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  revalidateTag(`product:${productId}`);
  return { ok: true, data: { saved: true } };
}

// -----------------------------------------------------------------------------
// buyProduct — delegiert an Native-RPC.
// -----------------------------------------------------------------------------

export interface BuyResult {
  orderId: string;
  newBalance: number;
}

// Warme Stimme — siehe Design-Gesetz in CLAUDE.md (Fehler → Mikro-Freude).
const BUY_ERROR_MESSAGES: Record<string, string> = {
  insufficient_coins: 'Fast! Dafür reichen deine Coins nicht ganz — kurz aufladen? 🪙',
  no_wallet: 'Dein Coin-Konto wird gerade eingerichtet — gleich geht’s 🪙',
  cannot_buy_own: 'Das ist dein eigenes Produkt 😄',
  product_not_found: 'Das Produkt ist leider weg 🙈',
  out_of_stock: 'Ausverkauft — war wohl beliebt 🔥',
  network_error: 'Kurz die Verbindung verloren — nochmal versuchen? 🙂',
};

export async function buyProduct(
  productId: string,
  quantity = 1,
): Promise<ActionResult<BuyResult>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };
  if (quantity < 1 || quantity > 99) return { ok: false, error: 'Ungültige Menge.' };

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('buy_product', {
    p_product_id: productId,
    p_quantity: quantity,
  });

  if (error) return { ok: false, error: error.message };

  // RPC liefert { success, order_id, new_balance } ODER { error: '...' }
  const result = (data ?? {}) as {
    success?: boolean;
    order_id?: string;
    new_balance?: number;
    error?: string;
  };

  if (result.error) {
    return { ok: false, error: BUY_ERROR_MESSAGES[result.error] ?? result.error };
  }
  if (!result.success || !result.order_id) {
    return { ok: false, error: 'Unbekannter Fehler beim Kauf.' };
  }

  // Invalidate: Katalog (stock + sold_count geändert), Detail, Orders.
  revalidatePath('/shop');
  revalidateTag(`product:${productId}`);
  revalidatePath('/studio/orders');

  return {
    ok: true,
    data: {
      orderId: result.order_id,
      newBalance: result.new_balance ?? 0,
    },
  };
}

// -----------------------------------------------------------------------------
// submitReview — INSERT oder UPDATE (Trigger halten avg_rating konsistent).
// RLS erzwingt, dass der User das Produkt gekauft hat (order.status='completed').
// -----------------------------------------------------------------------------

export async function submitReview(params: {
  productId: string;
  rating: number;
  comment?: string | null;
}): Promise<ActionResult<{ reviewId: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const rating = Math.round(params.rating);
  if (rating < 1 || rating > 5) return { ok: false, error: 'Rating 1-5.' };
  const comment = params.comment?.trim() || null;
  if (comment && comment.length > 1000) return { ok: false, error: 'Kommentar zu lang (max 1000).' };

  const supabase = await createClient();

  // Order-Reference holen — die RLS-Policy für product_reviews.insert braucht order_id
  // (nur wer tatsächlich gekauft hat darf reviewen).
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('buyer_id', viewer.id)
    .eq('product_id', params.productId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) return { ok: false, error: 'Du kannst nur gekaufte Produkte bewerten.' };

  const { data, error } = await supabase
    .from('product_reviews')
    .upsert(
      {
        product_id: params.productId,
        reviewer_id: viewer.id,
        order_id: order.id,
        rating,
        comment,
      },
      { onConflict: 'reviewer_id,product_id' },
    )
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler beim Speichern.' };

  revalidateTag(`product:${params.productId}`);
  revalidateTag(`reviews:${params.productId}`);

  return { ok: true, data: { reviewId: data.id as string } };
}

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();

  // Produkt-ID für Revalidation holen
  const { data: review } = await supabase
    .from('product_reviews')
    .select('product_id')
    .eq('id', reviewId)
    .eq('reviewer_id', viewer.id)
    .maybeSingle();

  const { error } = await supabase
    .from('product_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('reviewer_id', viewer.id);

  if (error) return { ok: false, error: error.message };

  if (review?.product_id) {
    revalidateTag(`product:${review.product_id}`);
    revalidateTag(`reviews:${review.product_id}`);
  }
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// getMyReviewAction — Server-Action-Wrapper für Client-Components (orders page).
// Thin wrapper um getMyReview() aus lib/data/shop.ts.
// -----------------------------------------------------------------------------

export async function getMyReviewAction(productId: string): Promise<ProductReview | null> {
  return getMyReview(productId);
}

// -----------------------------------------------------------------------------
// reportProduct — nutzt existierenden `create_report` Helper.
// -----------------------------------------------------------------------------

const REPORT_REASONS = new Set([
  'spam',
  'nsfw',
  'inappropriate',
  'copyright',
  'counterfeit',
  'scam',
  'misleading',
  'other',
]);

export async function reportProduct(params: {
  productId: string;
  reason: string;
}): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };
  if (!REPORT_REASONS.has(params.reason)) return { ok: false, error: 'Ungültiger Grund.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_report', {
    p_target_type: 'product',
    p_target_id: params.productId,
    p_reason: params.reason,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// createProduct — Studio/Shop/New. Zod-Validierung + RLS (seller_id=auth.uid()).
// -----------------------------------------------------------------------------

export async function createProduct(
  input: ProductCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const parse = productCreateSchema.safeParse(input);
  if (!parse.success) {
    const first = parse.error.errors[0];
    return { ok: false, error: first?.message ?? 'Validierungsfehler.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .insert({
      seller_id: viewer.id,
      title: parse.data.title,
      description: parse.data.description ?? null,
      category: parse.data.category,
      price_coins: parse.data.price_coins,
      sale_price_coins: parse.data.sale_price_coins ?? null,
      price_eur: parse.data.price_eur ?? null,
      // Vorbestellung direkt bei Erstellung (Admin) — DB-Trigger gated Nicht-Admins.
      sale_mode: parse.data.sale_mode ?? 'coins',
      stock: parse.data.stock,
      cover_url: parse.data.cover_url ?? null,
      file_url: parse.data.file_url ?? null,
      image_urls: parse.data.image_urls,
      free_shipping: parse.data.free_shipping,
      location: parse.data.location ?? null,
      women_only: parse.data.women_only,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Insert fehlgeschlagen.' };

  revalidatePath('/studio/shop');
  revalidatePath('/shop');

  return { ok: true, data: { id: data.id as string } };
}

export async function updateProduct(
  productId: string,
  patch: ProductUpdateInput,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const parse = productUpdateSchema.safeParse(patch);
  if (!parse.success) {
    const first = parse.error.errors[0];
    return { ok: false, error: first?.message ?? 'Validierungsfehler.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update(parse.data)
    .eq('id', productId)
    .eq('seller_id', viewer.id);

  if (error) return { ok: false, error: error.message };

  revalidateTag(`product:${productId}`);
  revalidatePath('/studio/shop');
  revalidatePath('/shop');

  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// Vorbestellung / Sammelbestellung (Phase 0) — kein Geld.
// -----------------------------------------------------------------------------

export async function setProductSaleMode(
  productId: string,
  mode: 'coins' | 'preorder' | 'cash',
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };
  if (!['coins', 'preorder', 'cash'].includes(mode)) {
    return { ok: false, error: 'Ungültiger Modus.' };
  }

  const supabase = await createClient();
  // Sicherheit erzwingen RLS (seller_id=auth.uid) + DB-Trigger (nur Admin darf
  // <> coins). Hier nur das einfache Update — Nicht-Admins werden DB-seitig
  // automatisch auf 'coins' zurückgestuft.
  const { error } = await supabase
    .from('products')
    .update({ sale_mode: mode })
    .eq('id', productId)
    .eq('seller_id', viewer.id);

  if (error) return { ok: false, error: error.message };

  revalidateTag(`product:${productId}`);
  revalidatePath('/studio/shop');
  revalidatePath('/shop');
  return { ok: true, data: null };
}

const PREORDER_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: 'Bitte zuerst einloggen 🙂',
  product_not_found: 'Das Produkt ist leider weg 🙈',
  product_inactive: 'Das Produkt ist gerade nicht verfügbar.',
  not_preorder: 'Dieses Produkt ist keine Vorbestellung.',
  cannot_preorder_own: 'Das ist dein eigenes Produkt 😄',
};

export async function expressProductInterest(
  productId: string,
  quantity = 1,
  note?: string,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('express_product_interest', {
    p_product_id: productId,
    p_quantity: Math.max(1, Math.min(Math.round(quantity) || 1, 999)),
    p_note: note?.trim() || null,
  });

  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string };
  if (!res.success) {
    return {
      ok: false,
      error: PREORDER_ERROR_MESSAGES[res.error ?? ''] ?? 'Konnte nicht vormerken.',
    };
  }

  revalidateTag(`product:${productId}`);
  return { ok: true, data: null };
}

const NOTIFY_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: 'Bitte zuerst einloggen 🙂',
  empty_message: 'Schreib kurz eine Nachricht.',
  message_too_long: 'Nachricht ist zu lang (max. 500 Zeichen).',
  product_not_found: 'Das Produkt ist leider weg 🙈',
  not_owner: 'Das ist nicht dein Produkt.',
};

// „Alle benachrichtigen" — schreibt allen Interessenten (status='interested') in
// einem Rutsch eine DM und setzt sie auf 'notified' (kein erneutes Anschreiben
// beim zweiten Klick). Läuft über die SECURITY-DEFINER-RPC (umgeht Cooldown +
// product_preorders-RLS, Verkäufer-Identität wird in der RPC geprüft).
export async function notifyPreorderBuyers(
  productId: string,
  message: string,
): Promise<ActionResult<{ notified: number }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('notify_preorder_buyers', {
    p_product_id: productId,
    p_message: message,
  });

  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string; notified?: number };
  if (!res.success) {
    return { ok: false, error: NOTIFY_ERROR_MESSAGES[res.error ?? ''] ?? 'Konnte nicht senden.' };
  }

  revalidatePath('/studio/shop/preorders');
  revalidatePath('/messages');
  return { ok: true, data: { notified: res.notified ?? 0 } };
}

// Käufer nimmt seine eigene Vormerkung zurück (unverbindlich → muss reversibel
// sein). RLS „preorders_owner_all" erlaubt dem Käufer das Löschen der eigenen
// Zeile — keine RPC/Migration nötig.
export async function cancelProductInterest(
  productId: string,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('product_preorders')
    .delete()
    .eq('product_id', productId)
    .eq('user_id', viewer.id);

  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  revalidateTag(`product:${productId}`);
  return { ok: true, data: null };
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('seller_id', viewer.id);

  if (error) return { ok: false, error: error.message };

  revalidateTag(`product:${productId}`);
  revalidatePath('/studio/shop');
  revalidatePath('/shop');
  return { ok: true, data: null };
}

export async function bulkDeleteProducts(
  productIds: string[],
): Promise<ActionResult<{ deleted: number }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };
  const ids = Array.from(new Set(productIds)).slice(0, 100);
  if (ids.length === 0) return { ok: true, data: { deleted: 0 } };

  const supabase = await createClient();
  // `.eq('seller_id', …)` + RLS stellen sicher, dass nur eigene Produkte gelöscht
  // werden. Dank Migration 20260624150000 klappt das auch bei Bestell-Historie.
  const { error, count } = await supabase
    .from('products')
    .delete({ count: 'exact' })
    .in('id', ids)
    .eq('seller_id', viewer.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/studio/shop');
  revalidatePath('/shop');
  return { ok: true, data: { deleted: count ?? 0 } };
}

export async function toggleProductActive(
  productId: string,
  nextActive: boolean,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ is_active: nextActive })
    .eq('id', productId)
    .eq('seller_id', viewer.id);

  if (error) return { ok: false, error: error.message };

  revalidateTag(`product:${productId}`);
  revalidatePath('/studio/shop');
  revalidatePath('/shop');
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// updateOrderStatus — Händler-Seite für physical orders.
// -----------------------------------------------------------------------------

const ORDER_STATUSES = new Set(['pending', 'completed', 'cancelled', 'refunded']);

export async function updateOrderStatus(
  orderId: string,
  nextStatus: string,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };
  if (!ORDER_STATUSES.has(nextStatus)) return { ok: false, error: 'Ungültiger Status.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .eq('seller_id', viewer.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/studio/orders');
  return { ok: true, data: null };
}

// ─── Echtgeld-Bestellungen (physische Ware / Parfüm, Phase 1) ────────────────

const PRODUCT_PAY_ERRORS: Record<string, string> = {
  order_not_found: 'Bestellung nicht gefunden.',
  not_authorized: 'Das ist nicht deine Bestellung.',
  order_not_payable: 'Diese Bestellung ist gerade nicht zahlbar.',
  stripe_not_configured: 'Zahlungen vorübergehend nicht verfügbar.',
  stripe_session_create_failed: 'Stripe-Checkout konnte nicht gestartet werden.',
};

// Käufer: bezahlen → Stripe-Checkout-URL (Client redirected danach).
export async function payProductOrder(orderId: string): Promise<ActionResult<{ url: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'create-checkout-session',
    { body: { order_id: orderId } },
  );

  if (error) return { ok: false, error: 'Checkout konnte nicht gestartet werden.' };
  if (!data || data.error || !data.url) {
    return { ok: false, error: PRODUCT_PAY_ERRORS[data?.error ?? ''] ?? 'Checkout konnte nicht gestartet werden.' };
  }
  return { ok: true, data: { url: data.url } };
}

// Verkäufer: „Ware ist da" → Zahlungsaufforderungen aus Vormerkungen erzeugen.
export async function markPreordersPayable(
  productId: string,
): Promise<ActionResult<{ created: number; skipped: number }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('mark_preorders_payable', { p_product_id: productId });
  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string; created?: number; skipped?: number };
  if (!res.success) return { ok: false, error: res.error ?? 'Konnte nicht anfordern.' };

  revalidatePath('/studio/orders');
  return { ok: true, data: { created: res.created ?? 0, skipped: res.skipped ?? 0 } };
}

// Verkäufer/Admin: „Sammelbestellung offen" ankündigen → Vormerker + Speicherer
// des Produkts bekommen eine Benachrichtigung (+ Push) mit Deep-Link aufs Produkt.
export async function announcePreorderRound(
  productId: string,
  message?: string,
): Promise<ActionResult<{ notified: number }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('announce_preorder_round', {
    p_product_id: productId,
    p_message: message?.trim() ? message.trim() : null,
  });
  if (error) return { ok: false, error: `Konnte nicht ankündigen: ${error.message}` };

  const res = (data ?? {}) as { success?: boolean; error?: string; detail?: string; notified?: number };
  if (!res.success) {
    // detail = echter SQL-Fehler (aus der robusten RPC) für die Diagnose.
    return { ok: false, error: res.detail ? `Konnte nicht ankündigen: ${res.detail}` : (res.error ?? 'Konnte nicht ankündigen.') };
  }

  revalidatePath('/studio/shop/preorders');
  return { ok: true, data: { notified: res.notified ?? 0 } };
}

// Verkäufer: versendet (+ Tracking).
export async function setOrderShipped(
  orderId: string,
  carrier?: string,
  tracking?: string,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_order_shipped', {
    p_order_id: orderId,
    p_carrier: carrier?.trim() || null,
    p_tracking: tracking?.trim() || null,
  });
  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string };
  if (!res.success) return { ok: false, error: res.error ?? 'Konnte nicht aktualisieren.' };

  revalidatePath('/studio/orders');
  return { ok: true, data: null };
}

// Käufer: Empfang bestätigen (shipped → delivered).
export async function confirmOrderDelivered(orderId: string): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_order_delivered', { p_order_id: orderId });
  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string };
  if (!res.success) return { ok: false, error: res.error ?? 'Konnte nicht bestätigen.' };

  revalidatePath('/studio/orders');
  return { ok: true, data: null };
}

const ORDER_CANCEL_ERRORS: Record<string, string> = {
  order_not_found: 'Bestellung nicht gefunden.',
  not_authorized: 'Das ist nicht deine Bestellung.',
  already_paid: 'Schon bezahlt — eine Stornierung läuft über den Verkäufer (Rückerstattung). Schreib ihm kurz. 🙂',
  not_cancellable: 'Diese Bestellung kann nicht mehr storniert werden.',
};

// Käufer: Bestellung stornieren (nur solange unbezahlt).
export async function cancelProductOrder(orderId: string): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_product_order', { p_order_id: orderId });
  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string };
  if (!res.success) return { ok: false, error: ORDER_CANCEL_ERRORS[res.error ?? ''] ?? 'Konnte nicht stornieren.' };

  revalidatePath('/studio/orders');
  return { ok: true, data: null };
}

const ORDER_ADDR_ERRORS: Record<string, string> = {
  order_not_found: 'Bestellung nicht gefunden.',
  not_authorized: 'Das ist nicht deine Bestellung.',
  not_editable: 'Die Adresse ist nicht mehr änderbar (schon versendet).',
  incomplete_address: 'Bitte Name, Straße, PLZ und Ort ausfüllen.',
  country_not_supported: 'Versand aktuell nur nach DE, AT oder CH.',
};

export interface ShippingAddressInput {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

const ORDER_DISPUTE_ERRORS: Record<string, string> = {
  order_not_found: 'Bestellung nicht gefunden.',
  not_authorized: 'Das ist nicht deine Bestellung.',
  invalid_reason: 'Bitte einen Grund wählen.',
  not_reportable: 'Ein Problem kannst du erst ab der Bezahlung melden.',
  dispute_not_found: 'Meldung nicht gefunden.',
};

// Käufer/Verkäufer: Problem an einer Bestellung melden.
export async function reportOrderDispute(
  orderId: string,
  reason: string,
  detail?: string,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_order_dispute', {
    p_order_id: orderId,
    p_reason: reason,
    p_detail: detail?.trim() || null,
  });
  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string };
  if (!res.success) return { ok: false, error: ORDER_DISPUTE_ERRORS[res.error ?? ''] ?? 'Konnte nicht melden.' };

  revalidatePath('/studio/orders');
  return { ok: true, data: null };
}

// Admin: Streit-Meldung klären (oder verwerfen).
export async function resolveOrderDispute(
  disputeId: string,
  resolution?: string,
  dismiss = false,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('resolve_order_dispute', {
    p_dispute_id: disputeId,
    p_resolution: resolution?.trim() || null,
    p_dismiss: dismiss,
  });
  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string };
  if (!res.success) return { ok: false, error: ORDER_DISPUTE_ERRORS[res.error ?? ''] ?? 'Konnte nicht klären.' };

  revalidatePath('/studio/orders');
  return { ok: true, data: null };
}

const ORDER_REVIEW_ERRORS: Record<string, string> = {
  order_not_found: 'Bestellung nicht gefunden.',
  not_authorized: 'Das ist nicht deine Bestellung.',
  not_delivered: 'Bewerten kannst du erst nach der Lieferung.',
  invalid_rating: 'Bitte 1–5 Sterne wählen.',
};

// Bewertung abgeben (Käufer↔Verkäufer, nur nach Lieferung).
export async function submitOrderReview(
  orderId: string,
  rating: number,
  comment?: string,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_order_review', {
    p_order_id: orderId,
    p_rating: Math.round(rating),
    p_comment: comment?.trim() || null,
  });
  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string };
  if (!res.success) return { ok: false, error: ORDER_REVIEW_ERRORS[res.error ?? ''] ?? 'Konnte nicht speichern.' };

  revalidatePath('/studio/orders');
  return { ok: true, data: null };
}

// Käufer: Lieferadresse ändern (nur solange bezahlt, noch nicht versendet).
export async function updateOrderShippingAddress(
  orderId: string,
  addr: ShippingAddressInput,
): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_order_shipping_address', {
    p_order_id: orderId,
    p_name: addr.name,
    p_street: addr.street,
    p_zip: addr.zip,
    p_city: addr.city,
    p_country: addr.country,
  });
  if (error) return { ok: false, error: 'Kurz die Verbindung verloren — nochmal? 🙂' };

  const res = (data ?? {}) as { success?: boolean; error?: string };
  if (!res.success) return { ok: false, error: ORDER_ADDR_ERRORS[res.error ?? ''] ?? 'Konnte nicht speichern.' };

  revalidatePath('/studio/orders');
  return { ok: true, data: null };
}
