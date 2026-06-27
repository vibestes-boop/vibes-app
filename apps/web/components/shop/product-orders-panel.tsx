'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { Bell, CheckCircle2, Clock, CreditCard, MapPin, PackageCheck, Truck } from 'lucide-react';
import {
  cancelProductOrder,
  confirmOrderDelivered,
  markPreordersPayable,
  payProductOrder,
  setOrderShipped,
  updateOrderShippingAddress,
} from '@/app/actions/shop';
import type { PreorderGroup, ProductOrderRow, ProductOrderStatus } from '@/lib/data/shop';
import { formatEur } from '@/lib/utils';
import { ProductImage } from './product-image';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

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
  preorderGroups: PreorderGroup[];
}

export function ProductOrdersPanel({ role, orders, preorderGroups }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [editAddrId, setEditAddrId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', street: '', zip: '', city: '', country: 'DE' });
  const [shipId, setShipId] = useState<string | null>(null);
  const [shipForm, setShipForm] = useState({ carrier: 'DHL', tracking: '' });
  const [confirmAction, setConfirmAction] = useState<{ id: string; kind: 'receive' | 'cancel' } | null>(null);

  const hasSellerPreorders = role === 'seller' && preorderGroups.length > 0;
  if (orders.length === 0 && !hasSellerPreorders) return null;

  const onPay = (id: string) =>
    startTransition(async () => {
      const r = await payProductOrder(id);
      if (!r.ok) { setMsg(r.error); return; }
      window.location.href = r.data.url;
    });

  // Eigenes UI statt window.confirm/prompt: Bestätigung läuft über <Dialog>.
  const onConfirm = (id: string) => setConfirmAction({ id, kind: 'receive' });

  const onShip = (id: string) => {
    setShipForm({ carrier: 'DHL', tracking: '' });
    setShipId(id);
  };

  const submitShip = () =>
    startTransition(async () => {
      if (!shipId) return;
      const r = await setOrderShipped(shipId, shipForm.carrier, shipForm.tracking);
      if (!r.ok) { setMsg(r.error); return; }
      setMsg('Als versendet markiert ✓');
      setShipId(null);
      router.refresh();
    });

  const runConfirm = () =>
    startTransition(async () => {
      if (!confirmAction) return;
      const r = confirmAction.kind === 'receive'
        ? await confirmOrderDelivered(confirmAction.id)
        : await cancelProductOrder(confirmAction.id);
      if (!r.ok) { setMsg(r.error); setConfirmAction(null); return; }
      setMsg(confirmAction.kind === 'receive' ? 'Erhalt bestätigt ✓' : 'Bestellung storniert.');
      setConfirmAction(null);
      router.refresh();
    });

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

  const onCancel = (id: string) => setConfirmAction({ id, kind: 'cancel' });

  const openAddrEdit = (o: ProductOrderRow) => {
    setForm({
      name: o.ship_name ?? '',
      street: o.ship_street ?? '',
      zip: o.ship_zip ?? '',
      city: o.ship_city ?? '',
      country: o.ship_country ?? 'DE',
    });
    setEditAddrId(o.id);
  };

  const onSaveAddr = (id: string) =>
    startTransition(async () => {
      const r = await updateOrderShippingAddress(id, form);
      if (!r.ok) { setMsg(r.error); return; }
      setMsg('Adresse aktualisiert ✓');
      setEditAddrId(null);
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
          {preorderGroups.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href={`/shop/${g.id}` as Route}
                  className="relative h-12 w-12 flex-none overflow-hidden rounded-lg bg-muted"
                >
                  <ProductImage cover={g.cover_url} title={g.title} category="physical" sizes="48px" fallbackClassName="text-base" />
                </Link>
                <div className="min-w-0">
                  <Link href={`/shop/${g.id}` as Route} className="block truncate text-sm font-medium hover:underline">
                    {g.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {formatEur(g.price_eur) ?? 'kein €-Preis gesetzt'}
                    {' · '}{g.people} {g.people === 1 ? 'Person' : 'Personen'} · {g.bottles} {g.bottles === 1 ? 'Flasche' : 'Flaschen'}
                  </div>
                  {g.buyers.length > 0 && (
                    <div className="truncate text-xs text-muted-foreground">
                      {g.buyers.map((u) => `@${u}`).join(', ')} · seit {fmtDateTime(g.first_at)}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => onMarkPayable(g.id, g.title)}
                disabled={pending || g.price_eur == null}
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
              <div key={o.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {o.product ? (
                      <Link
                        href={`/shop/${o.product.id}` as Route}
                        className="relative h-14 w-14 flex-none overflow-hidden rounded-lg bg-muted"
                      >
                        <ProductImage cover={o.product.cover_url} title={o.product.title} category="physical" sizes="56px" fallbackClassName="text-lg" />
                      </Link>
                    ) : (
                      <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg bg-muted" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {o.product ? (
                          <Link href={`/shop/${o.product.id}` as Route} className="truncate font-medium hover:underline">
                            {o.product.title}
                          </Link>
                        ) : (
                          <span className="truncate font-medium">Produkt</span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {formatEur(o.amount_eur) ?? '—'}{o.quantity > 1 ? ` · ${o.quantity}×` : ''}
                        {role === 'seller' && o.status === 'paid' && addr(o) ? ` · ${addr(o)}` : ''}
                        {o.tracking_number ? ` · ${[o.tracking_carrier, o.tracking_number].filter(Boolean).join(' ')}` : ''}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(o.created_at)}</div>
                    </div>
                  </div>

                  {/* Käufer-Aktionen */}
                  {role === 'buyer' && o.status === 'payment_requested' && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => onCancel(o.id)}
                        disabled={pending}
                        className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        Doch nicht
                      </button>
                      <button
                        onClick={() => onPay(o.id)}
                        disabled={pending}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        <CreditCard className="h-4 w-4" />
                        Jetzt bezahlen
                      </button>
                    </div>
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

                {/* Käufer · bezahlt: Lieferadresse anzeigen + ändern (bis zum Versand) */}
                {role === 'buyer' && o.status === 'paid' && editAddrId !== o.id && (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 text-sm">
                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <MapPin className="h-3 w-3" /> Lieferadresse
                        </div>
                        <div className="mt-0.5">{addr(o) || 'Keine Adresse hinterlegt'}</div>
                      </div>
                      <button
                        onClick={() => openAddrEdit(o)}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        Adresse ändern
                      </button>
                    </div>
                  </div>
                )}

                {/* Adress-Edit-Formular (nur bis zum Versand) */}
                {editAddrId === o.id && (
                  <div className="mt-3 rounded-lg border bg-card p-3">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">Lieferadresse ändern</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                      <input
                        className="rounded-lg border bg-background px-3 py-2 text-sm sm:col-span-6"
                        placeholder="Name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      />
                      <input
                        className="rounded-lg border bg-background px-3 py-2 text-sm sm:col-span-6"
                        placeholder="Straße & Hausnummer"
                        value={form.street}
                        onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                      />
                      <input
                        className="rounded-lg border bg-background px-3 py-2 text-sm sm:col-span-2"
                        placeholder="PLZ"
                        value={form.zip}
                        onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                      />
                      <input
                        className="rounded-lg border bg-background px-3 py-2 text-sm sm:col-span-2"
                        placeholder="Ort"
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      />
                      <select
                        className="rounded-lg border bg-background px-3 py-2 text-sm sm:col-span-2"
                        value={form.country}
                        onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                      >
                        <option value="DE">Deutschland</option>
                        <option value="AT">Österreich</option>
                        <option value="CH">Schweiz</option>
                      </select>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => onSaveAddr(o.id)}
                        disabled={pending}
                        className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => setEditAddrId(null)}
                        className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-accent"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Versand-Dialog (eigenes UI statt window.prompt) */}
      <Dialog open={shipId !== null} onOpenChange={(o) => !o && setShipId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Als versendet markieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Versanddienst (z.B. DHL)"
              value={shipForm.carrier}
              onChange={(e) => setShipForm((f) => ({ ...f, carrier: e.target.value }))}
            />
            <Input
              placeholder="Sendungsnummer (optional)"
              value={shipForm.tracking}
              onChange={(e) => setShipForm((f) => ({ ...f, tracking: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setShipId(null)}
              className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              onClick={submitShip}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <PackageCheck className="h-4 w-4" />
              Versenden
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bestätigungs-Dialog: Erhalten / Stornieren (eigenes UI statt window.confirm) */}
      <Dialog open={confirmAction !== null} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.kind === 'receive' ? 'Paket erhalten?' : 'Bestellung stornieren?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction?.kind === 'receive'
              ? 'Bestätige, dass dein Paket angekommen ist.'
              : 'Solange noch nicht bezahlt ist, kannst du jederzeit absagen.'}
          </p>
          <DialogFooter>
            <button
              onClick={() => setConfirmAction(null)}
              className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              onClick={runConfirm}
              disabled={pending}
              className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                confirmAction?.kind === 'cancel'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {confirmAction?.kind === 'receive' ? 'Ja, erhalten' : 'Stornieren'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
