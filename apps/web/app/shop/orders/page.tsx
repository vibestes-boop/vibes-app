import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  ArrowLeft,
  ShoppingBag,
  ChevronRight,
} from 'lucide-react';

import { getMyOrders, type ShopOrder } from '@/lib/data/shop';
import { getUser } from '@/lib/auth/session';

// -----------------------------------------------------------------------------
// /shop/orders — Käufer-Bestellhistorie.
// v1.w.UI.165: Mobile-Parity zu app/shop/orders.tsx (buyer role).
// Seller-Ansicht lebt in /studio/orders.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Meine Bestellungen — Serlo Shop',
  description: 'Deine Bestellhistorie im Serlo Shop.',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending: {
    label: 'Ausstehend',
    icon: Clock,
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/30 dark:text-amber-400',
  },
  completed: {
    label: 'Abgeschlossen',
    icon: CheckCircle2,
    className: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30 dark:text-emerald-400',
  },
  cancelled: {
    label: 'Storniert',
    icon: XCircle,
    className: 'text-red-600 bg-red-500/10 border-red-500/30 dark:text-red-400',
  },
  refunded: {
    label: 'Erstattet',
    icon: RefreshCw,
    className: 'text-violet-600 bg-violet-500/10 border-violet-500/30 dark:text-violet-400',
  },
} as const satisfies Record<ShopOrder['status'], { label: string; icon: typeof Clock; className: string }>;

const CAT_LABELS: Record<string, string> = {
  digital: '📁 Digital',
  physical: '📦 Physisch',
  service: '🛠️ Service',
  preset: '🎨 Preset',
  video: '🎬 Video',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: ShopOrder }) {
  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.pending;
  const Icon = cfg.icon;
  const product = order.product;
  const catLabel = CAT_LABELS[product?.category ?? ''] ?? '📦 Produkt';
  const isDigital = product?.category === 'digital';
  const canDownload = isDigital && order.status === 'completed' && !!order.download_url;

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-elevation-1 transition-colors hover:bg-card/80">
      {/* Cover */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {product?.cover_url ? (
          <Image
            src={product.cover_url}
            alt={product.title ?? ''}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-6 w-6 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            href={`/shop/${order.product_id}` as Route}
            className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
          >
            {product?.title ?? 'Unbekanntes Produkt'}
          </Link>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
            <Icon className="h-3 w-3" />
            {cfg.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{catLabel}</span>
          {order.quantity > 1 && <span>· {order.quantity}×</span>}
          <span>· 🪙 {order.total_coins.toLocaleString('de-DE')}</span>
          <span>· {formatDate(order.created_at)}</span>
        </div>

        {order.counterparty && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Verkäufer:</span>
            <Link
              href={`/u/${order.counterparty.username}` as Route}
              className="font-medium text-foreground/80 hover:underline"
            >
              @{order.counterparty.username}
            </Link>
          </div>
        )}

        {order.delivery_notes && (
          <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-foreground/70">
            {order.delivery_notes}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {canDownload && (
            <a
              href={order.download_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" />
              Herunterladen
            </a>
          )}
          <Link
            href={`/shop/${order.product_id}` as Route}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Produkt ansehen
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ShopOrdersPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/shop/orders');

  const orders = await getMyOrders('buyer', 100);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={'/shop' as Route}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zum Shop
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Meine Bestellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deine Käufe im Serlo Shop — digitale Produkte kannst du hier direkt herunterladen.
        </p>
      </div>

      {/* List */}
      {orders.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-elevation-2 ring-1 ring-amber-500/20">
            <ShoppingBag className="h-8 w-8 text-amber-500" strokeWidth={1.75} />
          </div>
          <div className="max-w-xs">
            <p className="text-base font-semibold">Noch keine Bestellungen</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Entdecke Produkte von Creators — digital, physisch und mehr.
            </p>
          </div>
          <Link
            href={'/shop' as Route}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4" />
            Zum Shop
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {orders.length} {orders.length === 1 ? 'Bestellung' : 'Bestellungen'}
          </p>
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </main>
  );
}
