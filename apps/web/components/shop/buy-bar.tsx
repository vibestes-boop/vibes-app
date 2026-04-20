'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Image from 'next/image';
import { Bookmark, BookmarkCheck, Coins, Loader2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuantityStepper } from './quantity-stepper';
import { useBuyProduct, useToggleSaveProduct } from '@/hooks/use-shop';
import type { ShopProduct } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// BuyBar — sticky Call-to-Action am unteren Ende der Produkt-Detail-Seite.
// - Merken-Circle (Bookmark-Toggle)
// - Quantity-Stepper (nur wenn > 1 möglich)
// - Big-CTA mit Preis-Split
// - Confirm-Modal vor Buy-Commit
// -----------------------------------------------------------------------------

export function BuyBar({
  product,
  viewerId,
  coinBalance,
}: {
  product: ShopProduct;
  viewerId: string | null;
  coinBalance: number;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ orderId: string; newBalance: number } | null>(null);

  const save = useToggleSaveProduct();
  const buy = useBuyProduct({
    onSuccess: (r) => {
      setResult(r);
      setQty(1);
      // Modal bleibt offen und zeigt den Erfolg — Caller kann dann schließen
    },
  });

  const effPrice = product.sale_price_coins ?? product.price_coins;
  const totalCost = effPrice * qty;
  const soldOut = product.stock === 0;
  const isOwn = viewerId === product.seller.id;
  const canAfford = coinBalance >= totalCost;
  const maxQty = product.stock === -1 ? 99 : product.stock;
  const showStepper = !soldOut && maxQty > 1;

  const handleBuy = () => {
    if (!viewerId) {
      router.push(`/login?next=${encodeURIComponent(`/shop/${product.id}`)}` as Route);
      return;
    }
    if (isOwn || soldOut) return;
    setConfirmOpen(true);
  };

  return (
    <>
      {/* Sticky Bar */}
      <div className="sticky bottom-0 left-0 right-0 z-20 border-t bg-background/90 px-4 py-3 backdrop-blur-md lg:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          {/* Merken */}
          <button
            type="button"
            onClick={() =>
              viewerId
                ? save.mutate({ productId: product.id, saved: product.saved_by_me })
                : router.push(`/login?next=${encodeURIComponent(`/shop/${product.id}`)}` as Route)
            }
            disabled={save.isPending}
            className={cn(
              'flex h-12 w-12 flex-none items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted',
              product.saved_by_me && 'text-primary',
            )}
            aria-label={product.saved_by_me ? 'Nicht mehr merken' : 'Merken'}
          >
            {product.saved_by_me ? (
              <BookmarkCheck className="h-5 w-5 fill-current" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
          </button>

          {/* Quantity-Stepper */}
          {showStepper && (
            <QuantityStepper value={qty} onChange={setQty} min={1} max={maxQty} className="h-12" />
          )}

          {/* Big-CTA */}
          <button
            type="button"
            onClick={handleBuy}
            disabled={soldOut || isOwn || buy.isPending}
            className={cn(
              'flex h-12 flex-1 items-center justify-between gap-3 rounded-full px-4 text-sm font-semibold text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              soldOut || isOwn
                ? 'bg-muted text-muted-foreground'
                : !canAfford && viewerId
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-primary hover:bg-primary/90',
            )}
          >
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Coins className="h-4 w-4" />
              {totalCost.toLocaleString('de-DE')}
            </span>
            <span className="h-5 w-px bg-current/30" aria-hidden />
            <span>
              {soldOut
                ? 'Ausverkauft'
                : isOwn
                  ? 'Dein Produkt'
                  : !viewerId
                    ? 'Einloggen zum Kaufen'
                    : !canAfford
                      ? 'Coins aufladen'
                      : 'Jetzt kaufen'}
            </span>
          </button>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(v) => {
          setConfirmOpen(v);
          if (!v && result) setResult(null);
        }}
      >
        <DialogContent>
          {result ? (
            <SuccessPanel result={result} product={product} onClose={() => setConfirmOpen(false)} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Produkt kaufen?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
                  <div className="relative h-14 w-14 flex-none overflow-hidden rounded-md bg-muted">
                    {product.cover_url && (
                      <Image
                        src={product.cover_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium">{product.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {qty}× · @{product.seller.username}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      🪙 {totalCost.toLocaleString('de-DE')}
                    </div>
                    {qty > 1 && (
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        ({qty}× {effPrice.toLocaleString('de-DE')})
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Aktuelles Guthaben</span>
                    <span className="tabular-nums">🪙 {coinBalance.toLocaleString('de-DE')}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Nach Kauf</span>
                    <span
                      className={cn(
                        'tabular-nums font-medium',
                        !canAfford && 'text-red-500',
                      )}
                    >
                      🪙 {(coinBalance - totalCost).toLocaleString('de-DE')}
                    </span>
                  </div>
                </div>

                {!canAfford && (
                  <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                    Dir fehlen {(totalCost - coinBalance).toLocaleString('de-DE')} Coins. Lade
                    Guthaben im Coin-Shop auf.
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmOpen(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!canAfford || buy.isPending}
                    onClick={() => buy.mutate({ productId: product.id, quantity: qty })}
                  >
                    {buy.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Bestätigen'
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SuccessPanel({
  result,
  product,
  onClose,
}: {
  result: { orderId: string; newBalance: number };
  product: ShopProduct;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className="rounded-full bg-emerald-500/10 p-3">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Kauf erfolgreich</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Bestellung für „{product.title}" gespeichert. Neues Guthaben: 🪙{' '}
          {result.newBalance.toLocaleString('de-DE')}
        </p>
      </div>
      <div className="flex w-full gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Schließen
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            onClose();
            router.push('/studio/orders' as Route);
          }}
        >
          Meine Käufe
        </Button>
      </div>
    </div>
  );
}
