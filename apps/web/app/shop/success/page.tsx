import type { Route } from 'next';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock, AlertCircle, Package, ArrowRight } from 'lucide-react';

import { getUser } from '@/lib/auth/session';
import { getMyProductOrderBySession } from '@/lib/data/shop';
import { formatEur } from '@/lib/utils';

// -----------------------------------------------------------------------------
// /shop/success — Landing nach erfolgreichem Stripe-Checkout einer ECHTGELD-
// Bestellung (physische Ware / Parfüm). Getrennt von /coin-shop/success.
//
// Stripe sendet `?session_id={CHECKOUT_SESSION_ID}` → wir matchen auf
// `product_orders.stripe_session_id` (nur die eigene Bestellung, RLS).
//
// Webhook-Race: Der User kann hier landen BEVOR der Stripe-Webhook den Status
// auf `paid` gesetzt hat — dann steht die Order noch auf `payment_requested`.
// Dann zeigen wir „Zahlung wird bestätigt…" + Reload-Hinweis (meist <1s).
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Bestellung bestätigt — Serlo',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function ShopSuccessPage({ searchParams }: Props) {
  const user = await getUser();
  if (!user) redirect('/login?next=/studio/orders' as Route);

  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect('/studio/orders?role=buyer' as Route);

  const order = await getMyProductOrderBySession(sessionId);

  if (!order) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Keine Bestellung gefunden</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Die Zahlungssitzung ist abgelaufen oder gehört zu einem anderen Konto.
          Deine Bestellungen findest du jederzeit in deinem Profil.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href={'/studio/orders?role=buyer' as Route}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Meine Bestellungen
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link href={'/shop' as Route} className="text-xs text-muted-foreground hover:underline">
            Zurück zum Shop
          </Link>
        </div>
      </div>
    );
  }

  // payment_requested = Webhook noch nicht durch (Race). Alles ab `paid` = Erfolg.
  const isPending = order.status === 'payment_requested';
  const isFailed = order.status === 'cancelled' || order.status === 'refunded';
  const isSuccess = !isPending && !isFailed; // paid | shipped | delivered

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-10 lg:py-16">
      {isSuccess && (
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold">Bezahlt — danke! 🌸</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deine Bestellung ist eingegangen und wird vorbereitet. Sobald sie
            unterwegs ist, siehst du Versand &amp; Tracking unter „Meine Bestellungen“.
          </p>
        </header>
      )}

      {isPending && (
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <Clock className="h-8 w-8 animate-pulse text-amber-500" />
          </div>
          <h1 className="text-2xl font-semibold">Zahlung wird bestätigt…</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wir warten kurz auf die Bestätigung von Stripe — das dauert meist
            weniger als eine Minute. Lade die Seite gleich neu.
          </p>
        </header>
      )}

      {isFailed && (
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
            <AlertCircle className="h-8 w-8 text-rose-500" />
          </div>
          <h1 className="text-2xl font-semibold">Bestellung nicht abgeschlossen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mit dieser Bestellung hat etwas nicht geklappt. Schau in „Meine
            Bestellungen“ oder versuche es erneut.
          </p>
        </header>
      )}

      {/* Order-Summary */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Produkt</p>
            <p className="font-semibold">{order.product?.title ?? 'Bestellung'}</p>
          </div>
          <p className="text-base font-semibold">
            {formatEur(order.amount_eur) ?? '—'}
            {order.quantity > 1 && (
              <span className="ml-1 text-xs font-medium text-muted-foreground">
                ({order.quantity}×)
              </span>
            )}
          </p>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Bestell-Nr.</dt>
            <dd className="font-mono text-xs">{order.id.slice(0, 8)}…{order.id.slice(-4)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Datum</dt>
            <dd>{new Date(order.created_at).toLocaleString('de-DE')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">
              {isPending ? 'Zahlung in Bestätigung' : isFailed ? 'Nicht abgeschlossen' : 'Bezahlt'}
            </dd>
          </div>
        </dl>
      </div>

      {/* CTA */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href={'/studio/orders?role=buyer' as Route}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Meine Bestellungen
        </Link>
        <Link
          href={'/shop' as Route}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-center text-sm font-medium hover:bg-accent"
        >
          Weiter shoppen
        </Link>
      </div>
    </div>
  );
}
