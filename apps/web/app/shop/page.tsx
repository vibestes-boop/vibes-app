import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Store, Bookmark, Coins, Package, ShoppingBag } from 'lucide-react';
import { ShopGrid } from '@/components/shop/shop-grid';
import { ShopFilters } from '@/components/shop/shop-filters';
import { ShopSearchInput } from '@/components/shop/shop-search-input';
import { EmptyState as CanonicalEmptyState } from '@/components/ui/empty-state';
import { getShopProducts, getMyCoinBalance, type ShopCatalogParams } from '@/lib/data/shop';
import { getUser } from '@/lib/auth/session';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';
import type { ProductCategory } from '@shared/types';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('shop.metaTitle'),
    description: t('shop.metaDescription'),
    openGraph: {
      title: t('shop.ogTitle'),
      description: t('shop.ogDescription'),
    },
  };
}

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Katalog-Seite. URL-Query-Parameters steuern Category/Sort/Sale/Shipping/
// Preis-Range/Suche. ShopFilters (Sidebar) schreibt die URL; diese Page
// re-rendert pro Param-Änderung weil `force-dynamic`.
// -----------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShopCatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const pick = (key: string): string | undefined => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const params: ShopCatalogParams = {
    category: (pick('category') as ProductCategory | 'all' | undefined) ?? 'all',
    sort: (pick('sort') as ShopCatalogParams['sort']) ?? 'popular',
    onSaleOnly: pick('sale') === '1',
    freeShippingOnly: pick('shipping') === '1',
    minPrice: pick('min') ? Number(pick('min')) : undefined,
    maxPrice: pick('max') ? Number(pick('max')) : undefined,
    q: pick('q') ?? undefined,
    limit: 24,
  };

  const [products, user, t, locale] = await Promise.all([
    getShopProducts(params),
    getUser(),
    getT(),
    getLocale(),
  ]);
  const balance = user ? await getMyCoinBalance() : null;

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-0 lg:grid-cols-[260px_1fr]">
      <ShopFilters />

      <main className="min-w-0 px-4 py-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Store className="h-6 w-6 text-primary" />
              {t('shop.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length === 0 ? t('shop.noMatches') : t('shop.browseCatalog')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {balance !== null && (
              <div className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium tabular-nums">
                <Coins className="h-4 w-4 text-amber-500" />
                {balance.toLocaleString(LOCALE_INTL[locale])}
              </div>
            )}
            {user && (
              <Link
                href={'/shop/orders' as Route}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <Package className="h-4 w-4" />
                {t('shop.myOrders')}
              </Link>
            )}
            {user && (
              <Link
                href={'/shop/saved' as Route}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <Bookmark className="h-4 w-4" />
                {t('shop.saved')}
              </Link>
            )}
          </div>
        </div>

        {/* Such-Box */}
        <div className="mb-6 max-w-md">
          <ShopSearchInput initialQuery={params.q ?? ''} />
        </div>

        {/* Grid */}
        {products.length === 0 ? (
          <EmptyState />
        ) : (
          <ShopGrid initialProducts={products} params={params} />
        )}
      </main>
    </div>
  );
}

async function EmptyState() {
  const t = await getT();
  return (
    <CanonicalEmptyState
      icon={<ShoppingBag className="h-8 w-8" strokeWidth={1.75} />}
      title={t('shop.emptyTitle')}
      description={t('shop.emptyHint')}
      size="md"
      bordered
    />
  );
}
