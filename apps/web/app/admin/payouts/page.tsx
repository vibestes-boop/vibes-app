import type { Metadata } from 'next';
import Image from 'next/image';
import { CreditCard, TrendingUp, Clock, Gem } from 'lucide-react';
import { getSellerBalances } from '@/app/actions/admin';

// -----------------------------------------------------------------------------
// /admin/payouts — Seller-Guthaben & Auszahlungs-Übersicht
//
// v1.w.UI.215: Parity mit app/admin/payouts.tsx.
// Liest admin_get_seller_balances RPC (SECURITY DEFINER, is_admin geprüft).
// Reine Lese-View — Auszahlungen werden manuell außerhalb der App veranlasst.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Admin — Auszahlungen',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  const sellers = await getSellerBalances();

  const totalDiamonds = sellers.reduce((s, r) => s + r.diamond_balance, 0);
  const totalEarned   = sellers.reduce((s, r) => s + r.total_earned, 0);
  const pendingCount  = sellers.reduce((s, r) => s + r.pending_orders, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Gem}
          label="Diamonds (gesamt)"
          value={totalDiamonds.toLocaleString('de-DE')}
          accent="#8b5cf6"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Coin-Einnahmen"
          value={`🪙 ${totalEarned.toLocaleString('de-DE')}`}
          accent="#10b981"
        />
        <SummaryCard
          icon={Clock}
          label="Offene Bestellungen"
          value={pendingCount}
          accent={pendingCount > 0 ? '#f59e0b' : undefined}
        />
      </div>

      {/* Table */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Seller-Guthaben
        </h2>

        {sellers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-14 text-sm text-muted-foreground">
            <CreditCard className="h-6 w-6 opacity-30" />
            <span>Keine Seller-Daten verfügbar.</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Seller</span>
              <span className="text-right">Diamonds</span>
              <span className="text-right">Verdient</span>
              <span className="text-right">Offen</span>
            </div>
            <ul className="divide-y divide-border">
              {sellers.map((seller) => (
                <li
                  key={seller.seller_id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3"
                >
                  {/* Avatar + name */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                      {seller.avatar_url ? (
                        <Image
                          src={seller.avatar_url}
                          alt={seller.username}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-muted-foreground">
                          {seller.username.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <span className="truncate text-sm font-medium text-foreground">
                      @{seller.username}
                    </span>
                  </div>

                  {/* Diamonds */}
                  <span className="text-right text-sm font-semibold tabular-nums text-purple-600 dark:text-purple-400">
                    💎 {seller.diamond_balance.toLocaleString('de-DE')}
                  </span>

                  {/* Total earned */}
                  <span className="text-right text-sm tabular-nums text-foreground">
                    🪙 {seller.total_earned.toLocaleString('de-DE')}
                  </span>

                  {/* Pending orders */}
                  <span
                    className={
                      seller.pending_orders > 0
                        ? 'text-right text-sm font-semibold tabular-nums text-amber-500'
                        : 'text-right text-sm tabular-nums text-muted-foreground'
                    }
                  >
                    {seller.pending_orders}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="text-center text-[11px] text-muted-foreground">
        Auszahlungen werden manuell über das Buchhaltungs-System veranlasst.
        Diese Übersicht zeigt den aktuellen Stand der Seller-Guthaben.
      </p>
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: accent ? `${accent}18` : 'var(--muted)' }}
      >
        <Icon className="h-4 w-4" style={{ color: accent ?? 'var(--muted-foreground)' }} />
      </div>
      <div className="text-xl font-bold tabular-nums tracking-tight text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
