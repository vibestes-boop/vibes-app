'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, Clock, CreditCard, PackageCheck, Truck } from 'lucide-react';
import {
  confirmOrderDelivered,
  markPreordersPayable,
  payProductOrder,
  setOrderShipped,
} from '@/app/actions/shop';
import type { ProductOrderRow, ProductOrderStatus } from '@/lib/data/shop';
import { formatEur } from '@/lib/utils';

const STATUS: Record<ProductOrderStatus, { label: string; cls: string }> = {
  reserved:          { label: 'Vorgemerkt',   cls: 'bg-muted text-muted-foreground' },
  payment_requested: { label: 'Zahlung offen', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  paid:              { label: 'Bezahlt',       cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  shipped:           { label: 'Unterwegs',     cls: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  delivered:         { label: 'Geliefert',     cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  cancelled:         { label: 'Storniert',     cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  refunded:          { label: 'Erstattet',     cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  disputed:          { label: 'In Klärung',    cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

interface Props {
  role: 'buyer' | 'seller';
  orders: ProductOrderRow[];
  preorderProducts: { id: string; title: string; price_eur: number | null }[];
}

export function ProductOrdersPanel({ role, orders, preorderProducts }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const hasSellerPreorders = role === 'seller' && preorderProducts.length > 0;
  if (orders.length === 0 && !hasSellerPreorders) return null;

  const onPay = (id: string) =>
    startTransition(async () => {
      const r = await payProductOrder(id);
      if (!r.ok) { setMsg(r.error); return; }
      window.location.href = r.data.url;
    });

  const onConfirm = (id: string) => {
    if (!window.confirm('Paket erhalten?')) return;
    startTransition(async () => {
      const r = await confirmOrderDelivered(id);
      if (!r.ok) setMsg(r.error);
      else { setMsg('Erhalt bestätigt ✓'); router.refresh(); }
    });
  };

  const onShip = (id: string) => {
    const carrier = window.prompt('Versanddienst (z.B. DHL):', 'DHL') ?? '';
    const tracking = window.prompt('Sendungsnummer (optional):', '') ?? '';
    startTransition(async () => {
      const r = await setOrderShipped(id, carrier, tracking);
      if (!r.ok) setMsg(r.error);
      else { setMsg('Als versendet markiert ✓'); router.refresh(); }
    });
  };

  const onMarkPayable = (id: string, title: string) =>
    startTransition(async () => {
      const r = await markPreordersPayable(id);
      if (!r.ok) { setMsg(r.error); return; }
      setMsg(
        `„${title}": ${r.data.created} Zahlungsaufforderung(en) gesendet` +
        (r.data.skipped > 0 ? `, ${r.data.skipped} schon offen.` : '.'),
      );
      router.refresh();
    });

  const addr = (o: ProductOrderRow) =>
    [o.ship_name, o.ship_street, [o.ship_zip, o.ship_city].filter(Boolean).join(' '), o.ship_country]
      .filter(Boolean)
      .join(', ');

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Echtgeld-Bestellungen (Ware)
      </h2>

      {msg && (
        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">{msg}</div>
      )}

      {/* Verkäufer: Ware ist da → Zahlung anfordern */}
      {hasSellerPreorders && (
        <div className="mb-4 space-y-2 rounded-xl border bg-card p-4">
          <div className="text-sm font-medium">Ware ist da → Zahlung anfordern</div>
          {preorderProducts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatEur(p.price_eur) ?? 'kein €-Preis gesetzt'}
                </div>
              </div>
              <button
                onClick={() => onMarkPayable(p.id, p.title)}
                disabled={pending || p.price_eur == null}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Bell className="h-3.5 w-3.5" />
                Anfordern
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bestell-Liste */}
      {orders.length > 0 && (
        <div className="divide-y rounded-xl border bg-card">
          {orders.map((o) => {
            const st = STATUS[o.status] ?? STATUS.reserved;
            return (
              <div key={o.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{o.product?.title ?? 'Produkt'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {formatEur(o.amount_eur) ?? '—'}{o.quantity > 1 ? ` · ${o.quantity}×` : ''}
                    {role === 'seller' && o.status === 'paid' && addr(o) ? ` · ${addr(o)}` : ''}
                    {o.tracking_number ? ` · ${[o.tracking_carrier, o.tracking_number].filter(Boolean).join(' ')}` : ''}
                  </div>
                </div>

                {/* Käufer-Aktionen */}
                {role === 'buyer' && o.status === 'payment_requested' && (
                  <button
                    onClick={() => onPay(o.id)}
                    disabled={pending}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    Jetzt bezahlen
                  </button>
                )}
                {role === 'buyer' && o.status === 'shipped' && (
                  <button
                    onClick={() => onConfirm(o.id)}
                    disabled={pending}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Erhalten
                  </button>
                )}
                {role === 'buyer' && o.status === 'paid' && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" /> wird vorbereitet
                  </span>
                )}

                {/* Verkäufer-Aktion */}
                {role === 'seller' && o.status === 'paid' && (
                  <button
                    onClick={() => onShip(o.id)}
                    disabled={pending}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <PackageCheck className="h-4 w-4" />
                    Als versendet markieren
                  </button>
                )}
                {role === 'seller' && o.status === 'shipped' && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <Truck className="h-4 w-4" /> versendet
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
