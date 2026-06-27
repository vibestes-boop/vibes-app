import type { Route } from 'next';
import type { Metadata } from 'next';
import Link from 'next/link';
import { XCircle, ArrowLeft } from 'lucide-react';

// -----------------------------------------------------------------------------
// /shop/cancelled — Landing wenn der User den Stripe-Checkout einer ECHTGELD-
// Bestellung (physische Ware / Parfüm) abbricht. Getrennt von /coin-shop/cancelled.
//
// Es wurde nichts abgebucht. Die Bestellung bleibt auf `payment_requested` und
// kann jederzeit unter „Meine Bestellungen" erneut bezahlt werden.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Zahlung abgebrochen — Serlo',
  robots: { index: false },
};

export default function ShopCancelledPage() {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <XCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">Zahlung abgebrochen</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Kein Problem — es wurde nichts abgebucht. Deine Bestellung wartet weiter
        auf dich und kann jederzeit bezahlt werden. 🌸
      </p>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Link
          href={'/studio/orders?role=buyer' as Route}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Zu meinen Bestellungen
        </Link>
        <Link
          href={'/shop' as Route}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Zurück zum Shop
        </Link>
      </div>
    </div>
  );
}
