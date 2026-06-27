import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { getUser } from '@/lib/auth/session';
import type { Product, ProductWithSeller, ProductCategory } from '@shared/types';

// -----------------------------------------------------------------------------
// ShopProduct = Product + Seller-Join + denormalisiertes Rating + saved-Flag
// Kanonische Projektion für Catalog, Detail, Merchant-Storefront, Saved-List.
// -----------------------------------------------------------------------------

export type ProductSaleMode = 'coins' | 'preorder' | 'cash';

export interface ShopProduct extends ProductWithSeller {
  stock: number;
  sold_count: number;
  avg_rating: number | null;
  review_count: number;
  is_active: boolean;
  saved_by_me: boolean;
  // Hat der Viewer dieses Produkt vorgemerkt? Nur auf der Detail-Seite (getProduct)
  // befüllt; in Listen immer false (dort nicht gebraucht).
  preordered_by_me: boolean;
  // 'coins' = Coin-Kauf (Standard) · 'preorder' = Sammelbestellung (kein Geld)
  // · 'cash' = echtes Geld/Stripe (Phase 1). Default 'coins' (Fallback unten).
  sale_mode: ProductSaleMode;
}

const PRODUCT_COLUMNS =
  'id, seller_id, title, description, category, price_coins, sale_price_coins, price_eur, stock, cover_url, image_urls, file_url, free_shipping, location, women_only, is_active, sale_mode, sold_count, avg_rating, review_count, created_at, updated_at';

const SELLER_JOIN = 'seller:profiles!products_seller_id_fkey ( id, username, avatar_url, verified:is_verified )';

type RawProductRow = Omit<Product, 'image_urls'> & {
  image_urls: string[] | null;
  seller: ShopProduct['seller'] | ShopProduct['seller'][] | null;
  sold_count: number | null;
  avg_rating: number | null;
  review_count: number | null;
  is_active: boolean;
  sale_mode: ProductSaleMode | null;
};

export type ShopPreviewProduct = Pick<
  Product,
  'id' | 'title' | 'price_coins' | 'sale_price_coins' | 'cover_url'
>;

function normalizeProduct(
  row: RawProductRow,
  saved: Set<string>,
  preordered?: Set<string>,
): ShopProduct | null {
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
    sale_mode: row.sale_mode ?? 'coins',
    saved_by_me: saved.has(row.id),
    preordered_by_me: preordered?.has(row.id) ?? false,
  };
}

async function fetchPublicShopPreviewProducts(limit: number): Promise<ShopPreviewProduct[]> {
  const supabase = createPublicClient();

  try {
    const { data, error } = await supabase.rpc('get_public_shop_preview_products', {
      result_limit: limit,
    });

    if (!error && Array.isArray(data)) {
      return data as ShopPreviewProduct[];
    }
  } catch {
    // Migration may not be deployed yet. Fall back to the PostgREST path.
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, title, price_coins, sale_price_coins, cover_url')
    .eq('is_active', true)
    .eq('women_only', false)
    .order('sold_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as ShopPreviewProduct[];
}

const getCachedPublicShopPreviewProducts = unstable_cache(
  async (limit: number): Promise<ShopPreviewProduct[]> => fetchPublicShopPreviewProducts(limit),
  ['public-shop-preview-products'],
  { revalidate: 300 },
);

export const getPublicShopPreviewProducts = cache(async (limit = 6): Promise<ShopPreviewProduct[]> =>
  getCachedPublicShopPreviewProducts(limit),
);

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
  const user = await getUser();
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
  // Hat der Viewer dieses Produkt vorgemerkt? (für den „Zurücknehmen"-Button)
  let preorderedSet: Set<string> | undefined;
  if (viewerId) {
    const { data: pp } = await supabase
      .from('product_preorders')
      .select('product_id')
      .eq('user_id', viewerId)
      .eq('product_id', productId)
      .maybeSingle();
    if (pp) preorderedSet = new Set([productId]);
  }
  return normalizeProduct(data as unknown as RawProductRow, savedSet, preorderedSet);
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
// getHostShopCount — Lightweight count for the live-viewer ShoppingBag badge.
// Only counts active products to match what the viewer sees in the sheet.
// -----------------------------------------------------------------------------

export const getHostShopCount = cache(async (sellerId: string): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .eq('is_active', true);
  return count ?? 0;
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

  // FIX: Der Coin-Saldo lebt in `coins_wallets` (Spalte `coins`), NICHT in
  // `profiles.coins_balance` (existiert nicht → lieferte immer 0). Dadurch zeigte
  // das Kauf-Modal „Aktuelles Guthaben: 0", obwohl Header/Coin-Shop (die schon
  // `coins_wallets` lesen) korrekt 10.000 anzeigten.
  const { data } = await supabase
    .from('coins_wallets')
    .select('coins')
    .eq('user_id', user.id)
    .maybeSingle();

  return (data?.coins as number | undefined) ?? 0;
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

// -----------------------------------------------------------------------------
// Echtgeld-Bestellungen (physische Ware / Parfüm, Phase 1) — Tabelle product_orders.
// Getrennt vom coin-basierten Order-System (getMyOrders).
// -----------------------------------------------------------------------------

export type ProductOrderStatus =
  | 'reserved' | 'payment_requested' | 'paid' | 'shipped'
  | 'delivered' | 'cancelled' | 'refunded' | 'disputed';

export interface ProductOrderRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  quantity: number;
  amount_eur: number;
  status: ProductOrderStatus;
  ship_name: string | null;
  ship_street: string | null;
  ship_zip: string | null;
  ship_city: string | null;
  ship_country: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  product: { id: string; title: string; cover_url: string | null } | null;
}

const PRODUCT_ORDER_COLUMNS =
  'id, buyer_id, seller_id, product_id, quantity, amount_eur, status, ship_name, ship_street, ship_zip, ship_city, ship_country, tracking_carrier, tracking_number, created_at, product:products(id, title, cover_url)';

export async function getMyProductOrders(role: 'buyer' | 'seller'): Promise<ProductOrderRow[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const col = role === 'seller' ? 'seller_id' : 'buyer_id';
  const { data, error } = await supabase
    .from('product_orders')
    .select(PRODUCT_ORDER_COLUMNS)
    .eq(col, user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data as unknown as ProductOrderRow[];
}

// Einzelne Echtgeld-Bestellung per Stripe-Session-ID — für /shop/success nach dem
// Checkout-Redirect (?session_id=…). RLS (product_orders_party_read) + expliziter
// buyer_id-Filter stellen sicher, dass nur der Käufer seine eigene Order sieht.
export async function getMyProductOrderBySession(
  sessionId: string,
): Promise<ProductOrderRow | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('product_orders')
    .select(PRODUCT_ORDER_COLUMNS)
    .eq('stripe_session_id', sessionId)
    .eq('buyer_id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ProductOrderRow;
}

// Offene Vormerkungen des Verkäufers, gruppiert pro Produkt (für „Ware ist da →
// Zahlung anfordern"). Nur Produkte MIT offenen Vormerkern (interested/notified),
// inkl. Anzahl Personen, Flaschen, wer + seit wann.
export interface PreorderGroup {
  id: string;
  title: string;
  cover_url: string | null;
  price_eur: number | null;
  people: number;
  bottles: number;
  buyers: string[];
  first_at: string;
}

export async function getMyPreorderGroups(): Promise<PreorderGroup[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  // WICHTIG: KEIN `user:profiles(username)`-Embed — `product_preorders.user_id`
  // referenziert `auth.users`, NICHT `profiles`. PostgREST findet die Beziehung
  // nicht (PGRST200) und 400t die GANZE Query → Panel blieb leer. Usernames daher
  // separat per .in() laden (gleiches Muster wie batchSaved).
  const { data, error } = await supabase
    .from('product_preorders')
    .select('product_id, user_id, quantity, created_at, product:products!inner(id, title, cover_url, price_eur, seller_id)')
    .eq('product.seller_id', user.id)
    .in('status', ['interested', 'notified'])
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  type PreorderProduct = { id: string; title: string; cover_url: string | null; price_eur: number | null };
  type PreorderRow = {
    product_id: string;
    user_id: string;
    quantity: number;
    created_at: string;
    product: PreorderProduct | PreorderProduct[] | null;
  };
  const rows = data as unknown as PreorderRow[];

  // Usernames in einer eigenen Abfrage holen (FK-Embed nicht möglich, s.o.).
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);
    for (const p of profs ?? []) {
      if (p.username) nameById.set(p.id as string, p.username as string);
    }
  }

  const groups = new Map<string, PreorderGroup>();
  for (const row of rows) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    if (!product) continue;
    let g = groups.get(row.product_id);
    if (!g) {
      g = {
        id: product.id,
        title: product.title,
        cover_url: product.cover_url,
        price_eur: product.price_eur,
        people: 0,
        bottles: 0,
        buyers: [],
        first_at: row.created_at,
      };
      groups.set(row.product_id, g);
    }
    g.people += 1;
    g.bottles += row.quantity ?? 1;
    const uname = nameById.get(row.user_id);
    if (uname) g.buyers.push(uname);
  }
  return [...groups.values()];
}
