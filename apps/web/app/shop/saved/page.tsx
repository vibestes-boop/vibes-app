import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { Bookmark, ArrowLeft } from 'lucide-react';
import { ProductCard } from '@/components/shop/product-card';
import { getSavedProducts } from '@/lib/data/shop';
import { getUser } from '@/lib/auth/session';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = {
  title: 'Gemerkt — Shop',
  description: 'Produkte die du gemerkt hast.',
};

export const dynamic = 'force-dynamic';

export default async function SavedProductsPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/shop/saved');

  const products = await getSavedProducts(60);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <Link
        href={'/shop' as Route}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zum Shop
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Bookmark className="h-6 w-6 text-primary" />
        Gemerkt
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {products.length > 0
          ? `${products.length} Produkt${products.length === 1 ? '' : 'e'} gespeichert.`
          : 'Du hast noch nichts gemerkt.'}
      </p>

      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="h-8 w-8" strokeWidth={1.75} />}
            title="Noch nichts gemerkt"
            description="Klick auf das Lesezeichen-Symbol bei Produkten die dich interessieren — sie erscheinen dann hier."
            size="md"
            bordered
            cta={
              <Link
                href={'/shop' as Route}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Shop entdecken
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
