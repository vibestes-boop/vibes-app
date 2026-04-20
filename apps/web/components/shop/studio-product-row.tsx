'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { useState } from 'react';
import { Edit, Trash2, Eye, EyeOff, ExternalLink, MoreHorizontal, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToggleProductActive, useDeleteProduct } from '@/hooks/use-shop';
import { cn } from '@/lib/utils';
import type { ShopProduct } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// StudioProductRow — eine Zeile in der Studio-Liste. Thumbnail, Titel, Status-
// Pill, Preis, Stock, Sold, Actions-Menü (Edit/Toggle/Delete).
// -----------------------------------------------------------------------------

export function StudioProductRow({ product }: { product: ShopProduct }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toggle = useToggleProductActive();
  const del = useDeleteProduct();

  const eff = product.sale_price_coins ?? product.price_coins;
  const stockLabel =
    product.stock === -1 ? '∞' : product.stock === 0 ? 'Aus' : product.stock.toString();

  return (
    <>
      <div className="flex items-center gap-4 p-4">
        {/* Thumb */}
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-lg bg-muted">
          {product.cover_url ? (
            <Image src={product.cover_url} alt="" fill className="object-cover" sizes="64px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">📦</div>
          )}
          {!product.is_active && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <EyeOff className="h-5 w-5 text-white" />
            </div>
          )}
        </div>

        {/* Titel + Pills */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/shop/${product.id}` as Route}
              className="line-clamp-1 font-medium hover:underline"
            >
              {product.title}
            </Link>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                product.is_active
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {product.is_active ? 'Aktiv' : 'Inaktiv'}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {product.category}
            </span>
            {product.sale_price_coins !== null && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-600 dark:text-red-400">
                Sale
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span>🪙 {eff.toLocaleString('de-DE')}</span>
            <span>Stock: {stockLabel}</span>
            <span>{product.sold_count}× verkauft</span>
            {product.review_count > 0 && (
              <span>
                ★ {product.avg_rating?.toFixed(1)} ({product.review_count})
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Aktionen">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href={`/studio/shop/${product.id}/edit` as Route}>
                <Edit className="h-4 w-4" />
                Bearbeiten
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/shop/${product.id}` as Route} target="_blank">
                <ExternalLink className="h-4 w-4" />
                Vorschau
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                toggle.mutate({ productId: product.id, nextActive: !product.is_active })
              }
              disabled={toggle.isPending}
            >
              {product.is_active ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Deaktivieren
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Aktivieren
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Confirm-Delete */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produkt löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            „{product.title}" wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht
            werden.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={del.isPending}
              onClick={() => {
                del.mutate(product.id, {
                  onSuccess: () => setConfirmDelete(false),
                });
              }}
            >
              {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Löschen'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
