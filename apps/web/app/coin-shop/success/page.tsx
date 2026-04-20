import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, Coins, Clock, AlertCircle, ArrowRight, FileText, Receipt } from 'lucide-react';

import { getUser } from '@/lib/auth/session';
import {
  getMyCoinOrderBySession,
  formatPrice,
  totalCoins,
} from '@/lib/data/payments';

// -----------------------------------------------------------------------------
// /coin-shop/success — Landing nach erfolgreichem Stripe-Checkout.
//
// Stripe sendet `?session_id={CHECKOUT_SESSION_ID}` — wir matchen auf
// `web_coin_orders.stripe_session_id` und zeigen den aktuellen Status.
//
// Webhook-Race:
//   Der User kann hier landen BEVOR der Stripe-Webhook den Status auf `paid`
//   gesetzt hat — dann steht die Order noch auf `pending` obwohl die Zahlung
//   durch ist. Wir zeigen in dem Fall ein „Wird bearbeitet…" State und
//   empfehlen Reload. In 99% der Fälle ist der Webhook schneller als der
//   User-Redirect (<1s), aber der Edge-Case ist möglich.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Zahlung erfolgreich — Serlo',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function CoinShopSuccessPage({ searchParams }: Props) {
  const user = await getUser();
  if (!user) redirect('/login?next=/coin-shop');

  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect('/coin-shop');

  const order = await getMyCoinOrderBySession(sessionId);

  // Keine Order gefunden → Session-ID passt nicht zu diesem User → kann
  // passieren wenn der User zwischen Login-Wechseln landed. Wir zeigen
  // freundlich auf den Shop zurück.
  if (!order) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Keine Bestellung gefunden</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Die Zahlungssitzung ist entweder abgelaufen oder gehört zu einem anderen Konto.
          Falls du Coins gekauft hast, prüfe deine Bestellhistorie.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href="/settings/billing"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Bestellhistorie ansehen
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/coin-shop" className="text-xs text-muted-foreground hover:underline">
            Zurück zum Coin-Shop
          </Link>
        </div>
      </div>
    );
  }

  const total = totalCoins(order);
  const price = formatPrice(order.price_cents, order.currency);

  // ── Status-Rendering ─────────────────────────────────────────────────────
  const isPaid = order.status === 'paid';
  const isPending = order.status === 'pending';
  const isFailed = order.status === 'failed' || order.status === 'cancelled';

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-10 lg:py-16">
      {isPaid && (
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold">Zahlung erfolgreich</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deine Coins sind gutgeschrieben — du kannst direkt weitermachen.
          </p>
        </header>
      )}

      {isPending && (
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <Clock className="h-8 w-8 animate-pulse text-amber-500" />
          </div>
          <h1 className="text-2xl font-semibold">Zahlung wird bearbeitet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wir warten auf die Bestätigung von Stripe. Das dauert meistens
            weniger als eine Minute. Lade die Seite in Kürze neu.
          </p>
        </header>
      )}

      {isFailed && (
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
            <AlertCircle className="h-8 w-8 text-rose-500" />
          </div>
          <h1 className="text-2xl font-semibold">Zahlung nicht erfolgreich</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Es gab ein Problem mit dem Zahlungsvorgang. Versuche es erneut oder
            wähle eine andere Zahlungsmethode.
          </p>
        </header>
      )}

      {/* Order-Summary */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/10">
            <Coins className="h-5 w-5 text-brand-gold" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Coin-Paket</p>
            <p className="font-semibold">
              {total.toLocaleString('de-DE')} Coins
              {order.bonus_coins > 0 && (
                <span className="ml-1 text-xs font-medium text-brand-gold">
                  (inkl. {order.bonus_coins.toLocaleString('de-DE')} Bonus)
                </span>
              )}
            </p>
          </div>
          <p className="text-base font-semibold">{price}</p>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Bestell-Nr.</dt>
            <dd className="font-mono text-xs">{order.id.slice(0, 8)}…{order.id.slice(-4)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Datum</dt>
            <dd>{new Date(order.paid_at ?? order.created_at).toLocaleString('de-DE')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">
              {isPaid ? 'Bezahlt' : isPending ? 'In Bearbeitung' : 'Fehlgeschlagen'}
            </dd>
          </div>
        </dl>

        {(order.invoice_url || order.receipt_url) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {order.invoice_url && (
              <a
                href={order.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5" />
                Rechnung (PDF)
              </a>
            )}
            {order.receipt_url && (
              <a
                href={order.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Receipt className="h-3.5 w-3.5" />
                Beleg
              </a>
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/"
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Zum Feed
        </Link>
        <Link
          href="/settings/billing"
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-center text-sm font-medium hover:bg-accent"
        >
          Alle Bestellungen
        </Link>
      </div>
    </div>
  );
}
