'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';

import { cancelPendingOrder } from '@/app/actions/payments';

// -----------------------------------------------------------------------------
// CancelOrderButton — Client-Button auf der Billing-Seite, um eine noch nicht
// bezahlte Order zu stornieren. Delegiert an Server-Action.
//
// Confirmation-Guard: window.confirm reicht hier — die Action ist reversibel
// (User kann danach erneut bei Stripe bezahlen, Webhook dreht zurück auf paid),
// eine fancy Dialog-Komponente wäre Overkill.
// -----------------------------------------------------------------------------

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onCancel() {
    setError(null);
    if (!confirm('Diese Bestellung wirklich abbrechen?')) return;
    startTransition(async () => {
      const result = await cancelPendingOrder(orderId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:underline disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        Abbrechen
      </button>
      {error && (
        <p className="mt-1 text-[11px] text-rose-500" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
