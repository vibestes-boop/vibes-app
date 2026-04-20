import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import { OrderRow } from '@/components/shop/order-row';
import { getMyOrders } from '@/lib/data/shop';
import { getUser } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Bestellungen · Serlo',
  description: 'Deine Käufe und Verkäufe.',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ role?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const { role: roleParam } = await searchParams;
  const role: 'buyer' | 'seller' = roleParam === 'seller' ? 'seller' : 'buyer';

  const user = await getUser();
  if (!user) redirect('/login?next=/studio/orders');

  const orders = await getMyOrders(role);

  const totalCoins = orders.reduce((s, o) => s + o.total_coins, 0);
  const completedCount = orders.filter((o) => o.status === 'completed').length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
      <Link
        href={'/studio/shop' as Route}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zum Shop-Studio
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShoppingBag className="h-6 w-6 text-primary" />
          Bestellungen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === 'buyer'
            ? 'Produkte, die du gekauft hast.'
            : 'Produkte, die andere bei dir gekauft haben.'}
        </p>
      </div>

      {/* Role-Toggle */}
      <div className="mb-6 inline-flex rounded-full border bg-card p-1">
        <Link
          href={'/studio/orders?role=buyer' as Route}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            role === 'buyer'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Käufe
        </Link>
        <Link
          href={'/studio/orders?role=seller' as Route}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            role === 'seller'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Verkäufe
        </Link>
      </div>

      {/* KPIs */}
      {orders.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatBox label="Bestellungen" value={orders.length.toLocaleString('de-DE')} />
          <StatBox label="Abgeschlossen" value={completedCount.toLocaleString('de-DE')} />
          <StatBox
            label={role === 'buyer' ? 'Ausgegeben' : 'Umsatz (brutto)'}
            value={`🪙 ${totalCoins.toLocaleString('de-DE')}`}
          />
        </div>
      )}

      {/* Liste */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <div className="text-5xl">{role === 'buyer' ? '🛍️' : '📭'}</div>
          <h3 className="text-lg font-semibold">
            {role === 'buyer' ? 'Noch keine Käufe' : 'Noch keine Verkäufe'}
          </h3>
          <p className="max-w-md text-sm text-muted-foreground">
            {role === 'buyer'
              ? 'Du hast bisher nichts im Shop gekauft. Entdecke Produkte anderer Creator.'
              : 'Sobald jemand eins deiner Produkte kauft, erscheint es hier.'}
          </p>
          <Link
            href={(role === 'buyer' ? '/shop' : '/studio/shop') as Route}
            className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {role === 'buyer' ? 'Shop entdecken' : 'Zum Shop-Studio'}
          </Link>
        </div>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} role={role} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
