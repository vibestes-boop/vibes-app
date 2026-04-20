import type { Metadata } from 'next';
import Link from 'next/link';
import { XCircle, ArrowLeft, Coins } from 'lucide-react';

// -----------------------------------------------------------------------------
// /coin-shop/cancelled — Landing wenn der User den Stripe-Checkout abbricht.
//
// Stripe redirected hierhin ohne query-params (sofern wir im `create-checkout-
// session` CANCEL_URL gesetzt haben). Der User sieht keine Order — die bleibt
// server-seitig zunächst auf `pending` und wird nach Session-Expiry per
// Stripe-Webhook (`checkout.session.expired`) auf `cancelled` gesetzt.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Zahlung abgebrochen — Serlo',
  robots: { index: false },
};

export default function CoinShopCancelledPage() {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <XCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">Zahlung abgebrochen</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Du hast den Zahlungsvorgang verlassen bevor er abgeschlossen wurde. Es
        wurde nichts abgebucht.
      </p>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Link
          href="/coin-shop"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Coins className="h-4 w-4" />
          Zurück zum Coin-Shop
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Zum Feed
        </Link>
      </div>
    </div>
  );
}
