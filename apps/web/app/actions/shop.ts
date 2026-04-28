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

const BUY_ERROR_MESSAGES: Record<string, string> = {
  insufficient_coins: 'Nicht genug Coins. Lade dein Guthaben auf.',
  no_wallet: 'Dein Coin-Konto ist noch nicht initialisiert.',
  cannot_buy_own: 'Du kannst dein eigenes Produkt nicht kaufen.',
  product_not_found: 'Produkt nicht mehr verfügbar.',
  out_of_stock: 'Ausverkauft.',
  network_error: 'Verbindungsfehler — bitte nochmal versuchen.',
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
  'inappropriate',
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
      stock: parse.data.stock,
      cover_url: parse.data.cover_url ?? null,
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
