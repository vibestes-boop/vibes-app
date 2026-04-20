import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Product, ProductWithSeller, ProductCategory } from '@shared/types';

// -----------------------------------------------------------------------------
// ShopProduct = Product + Seller-Join + denormalisiertes Rating + saved-Flag
// Kanonische Projektion für Catalog, Detail, Merchant-Storefront, Saved-List.
// -----------------------------------------------------------------------------

export interface ShopProduct extends ProductWithSeller {
  stock: number;
  sold_count: number;
  avg_rating: number | null;
  review_count: number;
  is_active: boolean;
  saved_by_me: boolean;
}

const PRODUCT_COLUMNS =
  'id, seller_id, title, description, category, price_coins, sale_price_coins, stock, cover_url, image_urls, file_url, free_shipping, location, women_only, is_active, sold_count, avg_rating, review_count, created_at, updated_at';

const SELLER_JOIN = 'seller:profiles!products_seller_id_fkey ( id, username, avatar_url, verified )';

type RawProductRow = Omit<Product, 'image_urls'> & {
  image_urls: string[] | null;
  seller: ShopProduct['seller'] | ShopProduct['seller'][] | null;
  sold_count: number | null;
  avg_rating: number | null;
  review_count: number | null;
  is_active: boolean;
};

function normalizeProduct(row: RawProductRow, saved: Set<string>): ShopProduct | null {
  const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
  if (!seller) return null;
  return {
    ...(row as unknown as Product),
    image_urls: row.image_urls ?? [],
    seller,
    sold_count: row.sold_count ?? 0,
    avg_rating: row.avg_rating,
    review_count: row.review_count ?? 0,
    is_active: row.is_active,
    saved_by_me: saved.has(row.id),
  };
}

async function batchSaved(productIds: string[], viewerId: string | null): Promise<Set<string>> {
  if (!viewerId || productIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from('saved_products')
    .select('product_id')
    .eq('user_id', viewerId)
    .in('product_id', productIds);
  return new Set((data ?? []).map((r) => r.product_id as string));
}

// -----------------------------------------------------------------------------
// Catalog-Params — werden 1:1 aus den URL-Query-Params abgeleitet.
// -----------------------------------------------------------------------------

export interface ShopCatalogParams {
  category?: ProductCategory | 'all';
  sellerId?: string;
  minPrice?: number;
  maxPrice?: number;
  onSaleOnly?: boolean;
  freeShippingOnly?: boolean;
  womenOnly?: boolean;
  sort?: 'popular' | 'newest' | 'price-asc' | 'price-desc';
  limit?: number;
  offset?: number;
  q?: string;
}

export const getShopProducts = cache(async (params: ShopCatalogParams = {}): Promise<ShopProduct[]> => {
  const {
    category,
    sellerId,
    minPrice,
    maxPrice,
    onSaleOnly,
    freeShippingOnly,
    womenOnly,
    sort = 'popular',
    limit = 40,
    offset = 0,
    q,
  } = params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  let query = supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, ${SELLER_JOIN}`)
    .eq('is_active', true);

  if (category && category !== 'all') query = query.eq('category', category);
  if (sellerId) query = query.eq('seller_id', sellerId);
  if (typeof minPrice === 'number') query = query.gte('price_coins', minPrice);
  if (typeof maxPrice === 'number') query = query.lte('price_coins', maxPrice);
  if (onSaleOnly) query = query.not('sale_price_coins', 'is', null);
  if (freeShippingOnly) query = query.eq('free_shipping', true);
  if (!womenOnly) query = query.eq('women_only', false);
  if (q && q.trim().length >= 2) {
    const like = `%${q.trim().replace(/[%_]/g, '')}%`;
    query = query.or(`title.ilike.${like},description.ilike.${like}`);
  }

  switch (sort) {
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'price-asc':
      query = query.order('price_coins', { ascending: true });
      break;
    case 'price-desc':
      query = query.order('price_coins', { ascending: false });
      break;
    case 'popular':
    default:
      query = query.order('sold_count', { ascending: false }).order('created_at', { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data: rows, error } = await query;
  if (error || !rows) return [];

  const ids = rows.map((r) => r.id as string);
  const savedSet = await batchSaved(ids, viewerId);

  return (rows as unknown as RawProductRow[])
    .map((row) => normalizeProduct(row, savedSet))
    .filter((p): p is ShopProduct => p !== null);
});

// -----------------------------------------------------------------------------
// getProduct — Detail-Seite. Kein cache() auf Author/saved damit Login-State
// live reagiert, aber Data selbst wird per Request gecached.
// -----------------------------------------------------------------------------

export const getProduct = cache(async (productId: string): Promise<ShopProduct | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, ${SELLER_JOIN}`)
    .eq('id', productId)
    .maybeSingle();

  if (error || !data) return null;

  const savedSet = await batchSaved([productId], viewerId);
  return normalizeProduct(data as unknown as RawProductRow, savedSet);
});

// -----------------------------------------------------------------------------
// getSavedProducts — eigener Merk-Ordner des Users.
// -----------------------------------------------------------------------------

export const getSavedProducts = cache(async (limit = 50): Promise<ShopProduct[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: saves } = await supabase
    .from('saved_products')
    .select('product_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!saves || saves.length === 0) return [];
  const productIds = saves.map((s) => s.product_id as string);

  const { data: rows } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, ${SELLER_JOIN}`)
    .in('id', productIds)
    .eq('is_active', true);

  if (!rows) return [];

  // Saved-Set ist hier per Definition alle Ergebnisse
  const savedSet = new Set(productIds);
  const indexMap = new Map(productIds.map((id, i) => [id, i]));

  return (rows as unknown as RawProductRow[])
    .map((row) => normalizeProduct(row, savedSet))
    .filter((p): p is ShopProduct => p !== null)
    .sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));
});

// -----------------------------------------------------------------------------
// getMerchantProducts — `/u/[username]/shop`. Liefert auch inactive Produkte
// falls viewerId === sellerId, sonst nur active.
// -----------------------------------------------------------------------------

export const getMerchantProducts = cache(
  async (sellerId: string, limit = 60): Promise<ShopProduct[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const viewerId = user?.id ?? null;
    const isOwner = viewerId === sellerId;

    let query = supabase
      .from('products')
      .select(`${PRODUCT_COLUMNS}, ${SELLER_JOIN}`)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!isOwner) query = query.eq('is_active', true);

    const { data: rows, error } = await query;
    if (error || !rows) return [];

    const ids = rows.map((r) => r.id as string);
    const savedSet = await batchSaved(ids, viewerId);

    return (rows as unknown as RawProductRow[])
      .map((row) => normalizeProduct(row, savedSet))
      .filter((p): p is ShopProduct => p !== null);
  },
);

// -----------------------------------------------------------------------------
// getMyProducts — Studio-Dashboard, alle Zustände des Owners.
// -----------------------------------------------------------------------------

export const getMyProducts = cache(async (): Promise<ShopProduct[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, ${SELLER_JOIN}`)
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  if (!rows) return [];

  return (rows as unknown as RawProductRow[])
    .map((row) => normalizeProduct(row, new Set()))
    .filter((p): p is ShopProduct => p !== null);
});

// -----------------------------------------------------------------------------
// Orders — Studio/Orders. Role-Split: buyer/seller sind beide relevant.
// -----------------------------------------------------------------------------

export interface ShopOrder {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  quantity: number;
  total_coins: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  delivery_notes: string | null;
  download_url: string | null;
  created_at: string;
  product: {
    id: string;
    title: string;
    cover_url: string | null;
    category: ProductCategory;
  } | null;
  counterparty: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export const getMyOrders = cache(
  async (role: 'buyer' | 'seller' = 'buyer', limit = 100): Promise<ShopOrder[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const col = role === 'buyer' ? 'buyer_id' : 'seller_id';
    const counterpartyCol = role === 'buyer' ? 'seller_id' : 'buyer_id';
    const counterpartyRel =
      role === 'buyer'
        ? 'counterparty:profiles!orders_seller_id_fkey ( id, username, avatar_url )'
        : 'counterparty:profiles!orders_buyer_id_fkey ( id, username, avatar_url )';

    const { data } = await supabase
      .from('orders')
      .select(
        `id, buyer_id, seller_id, product_id, quantity, total_coins, status, delivery_notes, download_url, created_at,
         product:products!orders_product_id_fkey ( id, title, cover_url, category ),
         ${counterpartyRel}`,
      )
      .eq(col, user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return (data as unknown as (ShopOrder & {
      product: ShopOrder['product'] | ShopOrder['product'][];
      counterparty: ShopOrder['counterparty'] | ShopOrder['counterparty'][];
    })[]).map((row) => ({
      ...row,
      product: Array.isArray(row.product) ? row.product[0] ?? null : row.product,
      counterparty: Array.isArray(row.counterparty) ? row.counterparty[0] ?? null : row.counterparty,
    })) as ShopOrder[];
    void counterpartyCol; // keep linter happy (referenced conceptually via relation)
  },
);

// -----------------------------------------------------------------------------
// Reviews — Produkt-Detail. `getMyReview` getrennt für Prefill-Logik.
// -----------------------------------------------------------------------------

export interface ProductReview {
  id: string;
  product_id: string;
  reviewer_id: string;
  rating: number; // 1-5
  comment: string | null;
  created_at: string;
  reviewer: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export const getProductReviews = cache(
  async (productId: string, limit = 50): Promise<ProductReview[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('product_reviews')
      .select(
        `id, product_id, reviewer_id, rating, comment, created_at,
         reviewer:profiles!product_reviews_reviewer_id_fkey ( id, username, avatar_url )`,
      )
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return (data as unknown as (ProductReview & {
      reviewer: ProductReview['reviewer'] | ProductReview['reviewer'][];
    })[]).map((row) => ({
      ...row,
      reviewer: Array.isArray(row.reviewer) ? row.reviewer[0] ?? null : row.reviewer,
    })) as ProductReview[];
  },
);

export const getMyReview = cache(async (productId: string): Promise<ProductReview | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('product_reviews')
    .select(
      `id, product_id, reviewer_id, rating, comment, created_at,
       reviewer:profiles!product_reviews_reviewer_id_fkey ( id, username, avatar_url )`,
    )
    .eq('product_id', productId)
    .eq('reviewer_id', user.id)
    .maybeSingle();

  if (!data) return null;
  const row = data as unknown as ProductReview & {
    reviewer: ProductReview['reviewer'] | ProductReview['reviewer'][];
  };
  return {
    ...row,
    reviewer: Array.isArray(row.reviewer) ? row.reviewer[0] ?? null : row.reviewer,
  };
});

// -----------------------------------------------------------------------------
// Hat der Viewer dieses Produkt bereits erfolgreich gekauft?
// Gate fürs „Bewertung schreiben"-Sheet.
// -----------------------------------------------------------------------------

export const getEligibleOrderForReview = cache(
  async (productId: string): Promise<string | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('product_id', productId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (data?.id as string | undefined) ?? null;
  },
);

// -----------------------------------------------------------------------------
// Viewer-Coin-Balance — für Buy-Bar „Guthaben nach Kauf" + canAfford-Gate.
// -----------------------------------------------------------------------------

export const getMyCoinBalance = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from('profiles')
    .select('coins_balance')
    .eq('id', user.id)
    .maybeSingle();

  return (data?.coins_balance as number | undefined) ?? 0;
});

// -----------------------------------------------------------------------------
// Analytics für `/studio/shop/analytics`.
// -----------------------------------------------------------------------------

export interface ShopAnalyticsProduct {
  product_id: string;
  title: string;
  cover_url: string | null;
  sold_count: number;
  revenue_coins: number; // total coins the seller earned (70% cut approximation)
  avg_rating: number | null;
  review_count: number;
}

export const getShopAnalytics = cache(async (): Promise<ShopAnalyticsProduct[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: products } = await supabase
    .from('products')
    .select('id, title, cover_url, sold_count, avg_rating, review_count')
    .eq('seller_id', user.id);

  if (!products) return [];

  // Revenue aus completed orders aufsummieren, dann mit 0.7 skalieren (Plattform-Anteil 30%).
  const { data: revenueRows } = await supabase
    .from('orders')
    .select('product_id, total_coins')
    .eq('seller_id', user.id)
    .eq('status', 'completed');

  const revenueByProduct = new Map<string, number>();
  for (const r of revenueRows ?? []) {
    const pid = r.product_id as string;
    const total = r.total_coins as number;
    revenueByProduct.set(pid, (revenueByProduct.get(pid) ?? 0) + total);
  }

  return products.map((p) => ({
    product_id: p.id as string,
    title: p.title as string,
    cover_url: (p.cover_url as string | null) ?? null,
    sold_count: (p.sold_count as number | null) ?? 0,
    revenue_coins: Math.floor((revenueByProduct.get(p.id as string) ?? 0) * 0.7),
    avg_rating: (p.avg_rating as number | null) ?? null,
    review_count: (p.review_count as number | null) ?? 0,
  }));
});
