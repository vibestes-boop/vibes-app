import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Coins,
  Diamond,
  Gift,
  Receipt,
  FileText,
  ArrowRight,
  History,
  ExternalLink,
} from 'lucide-react';

import {
  getMyCoinBalance,
  getMyCoinOrders,
  formatPrice,
  totalCoins,
  STATUS_LABEL,
  STATUS_TONE,
} from '@/lib/data/payments';
import { CancelOrderButton } from '@/components/settings/cancel-order-button';

// -----------------------------------------------------------------------------
// /settings/billing — Coin-Wallet, Bestellhistorie, Rechnungen.
//
// Sektionen:
//   1. Wallet-Übersicht (Coins + Diamanten + „Verschenkt"-Counter)
//   2. CTAs: Coins kaufen → /coin-shop, Diamonds → Payout-Info (Phase 12)
//   3. Order-Historie mit Status-Badges, Invoice-Download, Receipt
//   4. Pending-Orders mit „Abbrechen"-Action
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Bezahlungen — Serlo',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const [balance, orders] = await Promise.all([
    getMyCoinBalance(),
    getMyCoinOrders(100, 0),
  ]);

  const coins = balance?.coins ?? 0;
  const diamonds = balance?.diamonds ?? 0;
  const totalGifted = balance?.totalGifted ?? 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Bezahlungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dein Coin-Guthaben, Bestellhistorie und Rechnungen.
        </p>
      </header>

      {/* ─── Wallet-Cards ───────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WalletCard
          icon={<Coins className="h-5 w-5" />}
          label="Coins"
          value={coins.toLocaleString('de-DE')}
          hint="für Gifts + Shop-Käufe"
          tone="gold"
          cta={{ href: '/coin-shop', label: 'Aufladen' }}
        />
        <WalletCard
          icon={<Diamond className="h-5 w-5" />}
          label="Diamanten"
          value={diamonds.toLocaleString('de-DE')}
          hint="von Fans erhalten"
          tone="blue"
        />
        <WalletCard
          icon={<Gift className="h-5 w-5" />}
          label="Verschenkt"
          value={totalGifted.toLocaleString('de-DE')}
          hint="Coins insgesamt"
          tone="muted"
        />
      </section>

      {/* ─── Order-Historie ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="h-4 w-4" />
            Bestellhistorie
          </h2>
          <Link
            href="/coin-shop"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Neue Bestellung
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <Receipt className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Noch keine Bestellungen</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Wenn du Coins kaufst, erscheinen die Rechnungen hier.
            </p>
            <Link
              href="/coin-shop"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Zum Coin-Shop
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Datum</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Paket</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Preis</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Belege</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const total = totalCoins(o);
                  const date = new Date(o.paid_at ?? o.created_at);
                  const tone = STATUS_TONE[o.status];
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {date.toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Coins className="h-3.5 w-3.5 text-brand-gold" />
                          <span className="font-medium">
                            {total.toLocaleString('de-DE')} Coins
                          </span>
                          {o.bonus_coins > 0 && (
                            <span className="text-[11px] text-brand-gold">
                              (+{o.bonus_coins.toLocaleString('de-DE')})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatPrice(o.price_cents, o.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={tone} label={STATUS_LABEL[o.status]} />
                        {o.status === 'pending' && (
                          <div className="mt-1">
                            <CancelOrderButton orderId={o.id} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {o.invoice_url && (
                            <a
                              href={o.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium hover:bg-muted"
                            >
                              <FileText className="h-3 w-3" />
                              Rechnung
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                          {o.receipt_url && (
                            <a
                              href={o.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium hover:bg-muted"
                            >
                              <Receipt className="h-3 w-3" />
                              Beleg
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Info-Block ─────────────────────────────────────────────────── */}
      <section className="mt-8 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Rechtliches</p>
        <p className="mt-1">
          Käufe sind endgültig nach Verwendung nicht erstattbar. Rechnungen und
          Belege werden von Stripe automatisch erstellt und per E-Mail an deine
          hinterlegte Adresse gesendet. Bei Fragen zu Zahlungen schreib uns an{' '}
          <a
            href="mailto:support@serlo.app"
            className="underline hover:text-foreground"
          >
            support@serlo.app
          </a>
          .
        </p>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function WalletCard({
  icon,
  label,
  value,
  hint,
  tone,
  cta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: 'gold' | 'blue' | 'muted';
  cta?: { href: string; label: string };
}) {
  const toneClasses = {
    gold: 'border-brand-gold/30 bg-brand-gold/5',
    blue: 'border-sky-500/30 bg-sky-500/5',
    muted: 'border-border bg-card',
  }[tone];
  const iconClasses = {
    gold: 'text-brand-gold',
    blue: 'text-sky-500',
    muted: 'text-muted-foreground',
  }[tone];

  return (
    <div className={`flex flex-col rounded-xl border p-4 ${toneClasses}`}>
      <div className={`flex items-center gap-2 text-xs font-medium ${iconClasses}`}>
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {cta && (
        <Link
          href={cta.href as '/coin-shop'}
          className="mt-3 inline-flex items-center gap-1 self-start rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent"
        >
          {cta.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function StatusPill({ tone, label }: { tone: 'neutral' | 'success' | 'warn' | 'error'; label: string }) {
  const classes = {
    success: 'bg-emerald-500/15 text-emerald-500',
    warn: 'bg-amber-500/15 text-amber-500',
    error: 'bg-rose-500/15 text-rose-500',
    neutral: 'bg-muted text-muted-foreground',
  }[tone];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${classes}`}>
      {label}
    </span>
  );
}
