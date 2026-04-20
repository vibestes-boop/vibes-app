import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { ArrowLeft, BarChart3, TrendingUp } from 'lucide-react';
import { getShopAnalytics } from '@/lib/data/shop';
import { getUser } from '@/lib/auth/session';
import { StarDisplay } from '@/components/shop/star-display';

export const metadata: Metadata = {
  title: 'Shop-Analytics · Serlo',
  description: 'Performance deiner Produkte auf einen Blick.',
};

export const dynamic = 'force-dynamic';

export default async function ShopAnalyticsPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/studio/shop/analytics');

  const rows = await getShopAnalytics();
  const sorted = [...rows].sort((a, b) => b.revenue_coins - a.revenue_coins);

  const totalSold = rows.reduce((s, r) => s + r.sold_count, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue_coins, 0);
  const productsWithSales = rows.filter((r) => r.sold_count > 0).length;
  const maxRevenue = Math.max(1, ...sorted.map((r) => r.revenue_coins));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      <Link
        href={'/studio/shop' as Route}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zum Shop-Studio
      </Link>

      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BarChart3 className="h-6 w-6 text-primary" />
          Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Umsatz, Verkäufe und Bewertungen pro Produkt. Umsatz = 70% nach Plattform-Anteil.
        </p>
      </div>

      {/* KPI-Cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Produkte" value={rows.length.toLocaleString('de-DE')} />
        <StatCard label="Mit Verkäufen" value={productsWithSales.toLocaleString('de-DE')} />
        <StatCard label="Verkaufte Einheiten" value={totalSold.toLocaleString('de-DE')} />
        <StatCard
          label="Netto-Umsatz"
          value={`🪙 ${totalRevenue.toLocaleString('de-DE')}`}
          highlight
        />
      </div>

      {/* Ranking */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <div className="text-5xl">📊</div>
          <h3 className="text-lg font-semibold">Noch keine Daten</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Leg Produkte an und teil deinen Shop — sobald jemand etwas kauft, siehst du hier
            dein Top-Performer-Ranking.
          </p>
          <Link
            href={'/studio/shop/new' as Route}
            className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Neues Produkt anlegen
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-primary" />
            Top-Performer
          </div>
          <div className="divide-y">
            {sorted.map((row, idx) => {
              const bar = Math.max(2, Math.round((row.revenue_coins / maxRevenue) * 100));
              return (
                <div key={row.product_id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-6 flex-none text-sm font-semibold text-muted-foreground tabular-nums">
                      {idx + 1}.
                    </div>
                    <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg bg-muted">
                      {row.cover_url ? (
                        <Image
                          src={row.cover_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl">
                          📦
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/shop/${row.product_id}` as Route}
                        className="line-clamp-1 text-sm font-medium hover:underline"
                      >
                        {row.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                        <span>{row.sold_count}× verkauft</span>
                        <span className="font-medium text-foreground">
                          🪙 {row.revenue_coins.toLocaleString('de-DE')}
                        </span>
                        {row.review_count > 0 && row.avg_rating !== null && (
                          <span className="inline-flex items-center gap-1">
                            <StarDisplay rating={row.avg_rating} size={12} />
                            <span>({row.review_count})</span>
                          </span>
                        )}
                      </div>
                      {/* Revenue-Bar */}
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                          style={{ width: `${bar}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hinweis */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Plattform-Anteil: 30% · Auszahlung: 70% vom Brutto-Verkaufspreis.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? 'rounded-xl border border-primary/20 bg-primary/5 p-4'
          : 'rounded-xl border bg-card p-4'
      }
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
