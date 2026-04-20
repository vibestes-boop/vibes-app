'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { useState, useTransition } from 'react';
import { Check, Truck, XCircle, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { updateOrderStatus } from '@/app/actions/shop';
import { cn } from '@/lib/utils';
import type { ShopOrder } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// OrderRow — zeigt eine Bestellung und erlaubt dem Verkäufer Status-Wechsel.
// -----------------------------------------------------------------------------

const STATUS_LABELS: Record<ShopOrder['status'], string> = {
  pending: 'Offen',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  refunded: 'Rückerstattet',
};

const STATUS_STYLES: Record<ShopOrder['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function OrderRow({
  order,
  role,
}: {
  order: ShopOrder;
  role: 'buyer' | 'seller';
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(order.status);

  const changeStatus = (next: ShopOrder['status']) => {
    if (next === status) return;
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus(next);
      toast.success(`Status: ${STATUS_LABELS[next]}`);
    });
  };

  return (
    <div className="flex items-start gap-4 p-4">
      {/* Thumb */}
      <div className="relative h-16 w-16 flex-none overflow-hidden rounded-lg bg-muted">
        {order.product?.cover_url ? (
          <Image
            src={order.product.cover_url}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">📦</div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {order.product ? (
            <Link
              href={`/shop/${order.product.id}` as Route}
              className="line-clamp-1 font-medium hover:underline"
            >
              {order.product.title}
            </Link>
          ) : (
            <span className="line-clamp-1 font-medium text-muted-foreground">
              (Produkt entfernt)
            </span>
          )}
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              STATUS_STYLES[status],
            )}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
          {order.counterparty ? (
            <Link
              href={`/u/${order.counterparty.username}` as Route}
              className="hover:text-foreground hover:underline"
            >
              {role === 'buyer' ? '← ' : '→ '}
              @{order.counterparty.username}
            </Link>
          ) : (
            <span>— Nutzer gelöscht</span>
          )}
          <span>🪙 {order.total_coins.toLocaleString('de-DE')}</span>
          {order.quantity > 1 && <span>×{order.quantity}</span>}
          <span>{formatDate(order.created_at)}</span>
        </div>
        {order.delivery_notes && (
          <div className="mt-2 line-clamp-2 rounded bg-muted/60 px-2 py-1.5 text-xs">
            💬 {order.delivery_notes}
          </div>
        )}
        {order.download_url && order.product?.category === 'digital' && (
          <a
            href={order.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-xs text-primary hover:underline"
          >
            ↓ Download öffnen
          </a>
        )}
      </div>

      {/* Action */}
      {role === 'seller' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Status ändern'
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => changeStatus('pending')}>
              <Truck className="h-4 w-4" />
              Als offen markieren
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => changeStatus('completed')}>
              <Check className="h-4 w-4" />
              Abschließen
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => changeStatus('cancelled')}>
              <XCircle className="h-4 w-4" />
              Stornieren
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onSelect={() => changeStatus('refunded')}
            >
              <RotateCcw className="h-4 w-4" />
              Rückerstatten
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
