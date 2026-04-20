import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Store, Bookmark, Coins } from 'lucide-react';
import { ProductCard } from '@/components/shop/product-card';
import { ShopFilters } from '@/components/shop/shop-filters';
import { ShopSearchInput } from '@/components/shop/shop-search-input';
import { getShopProducts, getMyCoinBalance, type ShopCatalogParams } from '@/lib/data/shop';
import { getUser } from '@/lib/auth/session';
import type { ProductCategory } from '@shared/types';

export const metadata: Metadata = {
  title: 'Shop — Entdecke kuratierte Produkte',
  description:
    'Digital, physisch, Services und Collectibles — direkt von Creatorn der Serlo-Community. Mit Coins oder (in Kürze) per Karte bezahlen.',
  openGraph: {
    title: 'Serlo Shop',
    description: 'Kuratierte Produkte direkt von Creatorn.',
  },
};

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
    limit: 40,
  };

  const [products, user] = await Promise.all([getShopProducts(params), getUser()]);
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
              Shop
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length > 0
                ? `${products.length} Produkte`
                : 'Keine Produkte passen auf deine Filter.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {balance !== null && (
              <div className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium tabular-nums">
                <Coins className="h-4 w-4 text-amber-500" />
                {balance.toLocaleString('de-DE')}
              </div>
            )}
            {user && (
              <Link
                href={'/shop/saved' as Route}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <Bookmark className="h-4 w-4" />
                Gemerkt
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
      <div className="text-5xl">🛒</div>
      <h3 className="text-lg font-semibold">Keine Treffer</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Lockere die Filter oder probiere eine andere Kategorie. Die Sidebar links hat einen
        „Zurücksetzen"-Button.
      </p>
    </div>
  );
}
