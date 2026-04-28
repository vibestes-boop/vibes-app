import { NextResponse } from 'next/server';
import { getShopProducts, type ShopCatalogParams } from '@/lib/data/shop';
import type { ProductCategory } from '@shared/types';

// -----------------------------------------------------------------------------
// GET /api/shop/products
// Offset-pagination endpoint for the shop catalog infinite scroll.
// Accepts the same filter params as the shop page URL.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 48;
const DEFAULT_LIMIT = 24;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = url.searchParams;

  const limit = Math.min(Math.max(Number(sp.get('limit') ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const offset = Math.max(Number(sp.get('offset') ?? 0), 0);

  const params: ShopCatalogParams = {
    category: (sp.get('category') as ProductCategory | 'all' | undefined) ?? 'all',
    sort: (sp.get('sort') as ShopCatalogParams['sort']) ?? 'popular',
    onSaleOnly: sp.get('sale') === '1',
    freeShippingOnly: sp.get('shipping') === '1',
    minPrice: sp.get('min') ? Number(sp.get('min')) : undefined,
    maxPrice: sp.get('max') ? Number(sp.get('max')) : undefined,
    q: sp.get('q') ?? undefined,
    limit,
    offset,
  };

  const products = await getShopProducts(params);

  return NextResponse.json(products, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
