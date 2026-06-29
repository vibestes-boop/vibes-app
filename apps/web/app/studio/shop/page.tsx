import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { Plus, Package, BarChart3, ShoppingBag, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudioProductList } from '@/components/shop/studio-product-list';
import { getMyProducts } from '@/lib/data/shop';
import { getUser, getIsAdmin } from '@/lib/auth/session';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = {
  title: 'Shop-Studio · Serlo',
  description: 'Verwalte deine Produkte und Verkäufe.',
};

export const dynamic = 'force-dynamic';

export default async function StudioShopPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/studio/shop');

  const [products, isAdmin] = await Promise.all([getMyProducts(), getIsAdmin()]);

  const activeCount = products.filter((p) => p.is_active).length;
  const totalSold = products.reduce((s, p) => s + p.sold_count, 0);
  const totalRevenue = products.reduce(
    (s, p) => s + p.sold_count * (p.sale_price_coins ?? p.price_coins),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Package className="h-6 w-6 text-primary" />
            Shop-Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lege Produkte an, ändere Preise, aktiviere oder deaktiviere Angebote.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Vorbestell-Verwaltung: reine Admin-Funktion (Sammelbestell-Aktion,
              z.B. Parfüm) — normale Verkäufer sehen den Einstieg nicht. */}
          {isAdmin && (
            <Button asChild variant="outline">
              <Link href={'/studio/shop/preorders' as Route}>
                <Boxes className="h-4 w-4" />
                Vorbestellungen
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={'/studio/shop/analytics' as Route}>
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={'/studio/orders' as Route}>
              <ShoppingBag className="h-4 w-4" />
              Bestellungen
            </Link>
          </Button>
          <Button asChild>
            <Link href={'/studio/shop/new' as Route}>
              <Plus className="h-4 w-4" />
              Neues Produkt
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI-Cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Produkte" value={products.length.toLocaleString('de-DE')} />
        <StatCard label="Aktiv" value={activeCount.toLocaleString('de-DE')} />
        <StatCard label="Verkauft" value={totalSold.toLocaleString('de-DE')} />
        <StatCard
          label="Umsatz"
          value={`🪙 ${totalRevenue.toLocaleString('de-DE')}`}
        />
      </div>

      {/* Produkt-Liste */}
      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" strokeWidth={1.75} />}
          title="Noch keine Produkte"
          description="Leg dein erstes Produkt an — digitaler Download, physischer Artikel, Service oder Collectible."
          size="md"
          bordered
          cta={
            <Button asChild>
              <Link href={'/studio/shop/new' as Route}>
                <Plus className="h-4 w-4" />
                Neues Produkt anlegen
              </Link>
            </Button>
          }
        />
      ) : (
        <StudioProductList products={products} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// Fallback für Card-Thumbs wenn kein Cover
void Image;
