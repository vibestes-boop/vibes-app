import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Gem,
  ShoppingBag,
  Coins,
  TrendingUp,
  Download,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  PauseCircle,
} from 'lucide-react';
import {
  getCreatorEarnings,
  getCreatorGiftHistory,
  getShopRevenue,
  getShopOrdersDetailed,
  type Period,
} from '@/lib/data/studio';
import { PeriodTabs } from '@/components/studio/period-tabs';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// /studio/revenue — Einnahmen-Übersicht: Gifts + Shop-Verkäufe.
//
// Sektionen:
// 1. Gift-Einnahmen — Diamanten-Balance, Gifts in Periode, Top-Gift, Top-Gifter
// 2. Shop-Einnahmen — Total-Coins, Completed/Pending/Refunded, Unique-Buyers
// 3. Letzte Gifts (Tabelle)
// 4. Letzte Shop-Orders (Tabelle mit CSV-Export-Link)
//
// CSV-Export:
// Eine Route-Handler `/studio/revenue/export.csv?period=…` liefert die
// detaillierte Orders-Liste als CSV (für Accounting-Import). Tabelle-Header
// + UTF-8-BOM für Excel-Kompatibilität.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Einnahmen',
  description: 'Gift- + Shop-Umsätze. CSV-Export für Accounting.',
};

export const dynamic = 'force-dynamic';

const VALID_PERIODS: Period[] = [7, 28, 90];

export default async function StudioRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const requestedPeriod = Number(sp.period);
  const period: Period = VALID_PERIODS.includes(requestedPeriod as Period)
    ? (requestedPeriod as Period)
    : 28;

  const [earnings, giftHistory, shopRevenue, shopOrders] = await Promise.all([
    getCreatorEarnings(period),
    getCreatorGiftHistory(25),
    getShopRevenue(period),
    getShopOrdersDetailed(period, 100),
  ]);

  const totalShopCoins = shopRevenue.totalCoinsEarned;
  const totalDiamondsPeriod = earnings?.periodDiamonds ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Einnahmen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gift-Einnahmen aus Live-Streams + Shop-Verkäufe.
          </p>
        </div>
        <PeriodTabs period={period} basePath="/studio/revenue" />
      </header>

      {/* Summary Row */}
      <section className="grid gap-3 md:grid-cols-4">
        <BigMetricCard
          icon={Gem}
          label="Diamanten-Balance"
          value={(earnings?.diamondsBalance ?? 0).toLocaleString('de-DE')}
          unit="💎"
          tint="primary"
        />
        <BigMetricCard
          icon={TrendingUp}
          label="Diamanten (Periode)"
          value={`+${totalDiamondsPeriod.toLocaleString('de-DE')}`}
          unit="💎"
          tint="success"
        />
        <BigMetricCard
          icon={ShoppingBag}
          label="Shop-Umsatz (Periode)"
          value={totalShopCoins.toLocaleString('de-DE')}
          unit="🪙"
          tint="warning"
        />
        <BigMetricCard
          icon={Coins}
          label="Shop-Verkäufe"
          value={shopRevenue.completedOrders.toLocaleString('de-DE')}
          unit="Orders"
          tint="muted"
        />
      </section>

      {/* Shop-Status-Breakdown */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Shop-Status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatusPill
            icon={CheckCircle2}
            label="Abgeschlossen"
            value={`🪙 ${shopRevenue.totalCoinsEarned.toLocaleString('de-DE')}`}
            accent="success"
          />
          <StatusPill
            icon={PauseCircle}
            label="Ausstehend"
            value={`🪙 ${shopRevenue.pendingCoins.toLocaleString('de-DE')}`}
            accent="warning"
          />
          <StatusPill
            icon={RotateCcw}
            label="Erstattet"
            value={`🪙 ${shopRevenue.refundedCoins.toLocaleString('de-DE')}`}
            accent="danger"
          />
          <StatusPill
            icon={CreditCard}
            label="Einmalige Käufer"
            value={shopRevenue.uniqueBuyers.toLocaleString('de-DE')}
            accent="muted"
          />
        </div>
      </section>

      {/* Zwei-Spalter: Gifts + Orders */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Gifts */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">Gift-History</h2>
            <span className="text-xs text-muted-foreground">
              {earnings?.periodGifts ?? 0} in {period} T
            </span>
          </div>
          {giftHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Gem className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Noch keine Gifts. Gehe live — dann kommen sie.
              </p>
              <Link
                href={'/studio/live' as Route}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                Zur Live-Historie
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {giftHistory.map((g, i) => (
                <li
                  key={`${g.createdAt}-${i}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-2xl">
                    {g.giftEmoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="truncate font-medium">{g.giftName}</span>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-sky-600 dark:text-sky-400">
                        💎 {g.diamondValue.toLocaleString('de-DE')}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      von {g.senderName ?? '–'} ·{' '}
                      {new Date(g.createdAt).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Shop-Orders */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">Shop-Orders</h2>
            <a
              href={`/studio/revenue/export.csv?period=${period}`}
              className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
              download
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </a>
          </div>
          {shopOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Noch keine Shop-Verkäufe in diesem Zeitraum.
              </p>
              <Link
                href={'/studio/shop/new' as Route}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                Produkt anlegen
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Datum</th>
                    <th className="px-4 py-2 font-medium">Produkt</th>
                    <th className="px-4 py-2 font-medium">Käufer</th>
                    <th className="px-4 py-2 text-right font-medium">Coins</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shopOrders.map((o) => (
                    <tr key={o.id} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-2 align-middle text-xs tabular-nums text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="max-w-[20ch] truncate">
                          {o.productTitle ?? '–'}
                          {o.quantity > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              × {o.quantity}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="max-w-[16ch] truncate text-xs text-muted-foreground">
                          {o.buyerUsername ? `@${o.buyerUsername}` : '–'}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right align-middle tabular-nums">
                        🪙 {o.totalCoins.toLocaleString('de-DE')}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <OrderStatusPill status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Payout-Hinweis */}
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Auszahlung</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Diamanten können ab 100.000 💎 (= ca. 500 € netto) per SEPA ausgezahlt werden.
              Die Auszahlungs-Funktion kommt in Phase 10.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

function BigMetricCard({
  icon: Icon,
  label,
  value,
  unit,
  tint,
}: {
  icon: typeof Gem;
  label: string;
  value: string;
  unit: string;
  tint: 'primary' | 'success' | 'warning' | 'muted';
}) {
  const bg = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    muted: 'bg-muted text-muted-foreground',
  }[tint];

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', bg)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-xl font-semibold tabular-nums">{value}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Gem;
  label: string;
  value: string;
  accent: 'success' | 'warning' | 'danger' | 'muted';
}) {
  const cls = {
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    danger: 'bg-red-500/10 text-red-700 dark:text-red-400',
    muted: 'bg-muted text-muted-foreground',
  }[accent];

  return (
    <div className={cn('rounded-lg p-3', cls)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function OrderStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: {
      label: 'OK',
      className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    },
    pending: {
      label: 'Wartend',
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    cancelled: {
      label: 'Storno',
      className: 'bg-muted text-muted-foreground',
    },
    refunded: {
      label: 'Erstattet',
      className: 'bg-red-500/10 text-red-700 dark:text-red-400',
    },
  };
  const m = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
        m.className,
      )}
    >
      {m.label}
    </span>
  );
}
