"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CoinIcon } from '@/components/ui/coin-icon';
import {
  Bookmark,
  BookmarkCheck,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatEur } from "@/lib/utils";
import { QuantityStepper } from "./quantity-stepper";
import {
  useBuyProduct,
  useToggleSaveProduct,
  useExpressProductInterest,
  useCancelProductInterest,
} from "@/hooks/use-shop";
import type { ShopProduct } from "@/lib/data/shop";
import { ProductImage } from "./product-image";

// -----------------------------------------------------------------------------
// BuyBar — Call-to-Action-Block für die Produkt-Detail-Seite.
//
// Zwei Varianten (C4 — responsive Buy-CTA):
//   • `sticky`  = unterste Viewport-Zeile mit Backdrop-Blur (Mobile-Default)
//   • `inline`  = Card-Style-Block, eingesetzt in die rechte Info-Spalte auf
//                 Desktop. Gibt den unteren Seiten-Bereich frei für Reviews /
//                 „Mehr vom Seller" und vermeidet den „Mobile-First sieht auf
//                 Desktop wie eine App aus"-Look.
//
// Die Seite rendert BEIDE Varianten und schaltet via Tailwind `hidden lg:block`
// / `lg:hidden` — Dialog/State-Duplikation ist akzeptabel, weil der User pro
// Breakpoint immer nur EINE Instanz bedient; TanStack Query teilt den Cache
// zwischen beiden, Mutationen sind idempotent auf DB-Level.
// -----------------------------------------------------------------------------

export type BuyBarVariant = "sticky" | "inline";

export function BuyBar({
  product,
  viewerId,
  coinBalance,
  variant = "sticky",
  className,
}: {
  product: ShopProduct;
  viewerId: string | null;
  coinBalance: number;
  variant?: BuyBarVariant;
  className?: string;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    orderId: string;
    newBalance: number;
  } | null>(null);

  const save = useToggleSaveProduct();
  const [preorderDone, setPreorderDone] = useState(false);
  const [preorderCancelled, setPreorderCancelled] = useState(false);
  const interest = useExpressProductInterest({
    onSuccess: () => {
      setPreorderDone(true);
      setPreorderCancelled(false);
    },
  });
  const cancelInterest = useCancelProductInterest({
    onSuccess: () => {
      setPreorderCancelled(true);
      setPreorderDone(false);
    },
  });
  const buy = useBuyProduct({
    onSuccess: (r) => {
      setResult(r);
      setQty(1);
      // Modal bleibt offen und zeigt den Erfolg — Caller kann dann schließen.
      // router.refresh() lädt die Server-Daten neu, damit das Coin-Badge oben
      // (server-gerendert) sofort den neuen Saldo zeigt statt den alten.
      router.refresh();
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
      router.push(
        `/login?next=${encodeURIComponent(`/shop/${product.id}`)}` as Route,
      );
      return;
    }
    if (isOwn || soldOut) return;
    setConfirmOpen(true);
  };

  const isInline = variant === "inline";

  // ── Vorbestellung / Sammelbestellung — KEIN Geld, nur Interesse vormerken. ──
  if (product.sale_mode === "preorder") {
    const isOwnP = viewerId === product.seller.id;
    // Server-Flag ODER frisch in dieser Session vorgemerkt — solange nicht
    // gerade zurückgenommen.
    const isPreordered =
      (product.preordered_by_me || preorderDone) && !preorderCancelled;
    const handleVormerken = () => {
      if (!viewerId) {
        router.push(`/login?next=${encodeURIComponent(`/shop/${product.id}`)}` as Route);
        return;
      }
      if (isOwnP) return;
      interest.mutate({ productId: product.id, quantity: qty });
    };
    return (
      <div
        className={cn(
          isInline
            ? "rounded-xl border border-border/60 bg-card p-3 shadow-elevation-1 dark:border-border/30"
            : "sticky bottom-0 left-0 right-0 z-20 border-t bg-background/90 px-4 py-3 backdrop-blur-md lg:px-6",
          className,
        )}
      >
        <div className={cn("flex flex-col gap-2", isInline ? "" : "mx-auto max-w-5xl")}>
          {formatEur(product.price_eur) && (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {formatEur(product.price_eur)}
              </span>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Vorbestellung
              </span>
            </div>
          )}
          <p className="text-xs leading-snug text-muted-foreground">
            🤎 <span className="font-medium text-foreground">Sammelbestellung</span> — du zahlst
            erst, wenn die Ware da ist. Trag dich ein, @{product.seller.username} meldet sich.
          </p>
          <div className="flex items-center gap-3">
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
                "flex h-12 w-12 flex-none items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted",
                product.saved_by_me && "text-primary",
              )}
              aria-label={product.saved_by_me ? "Nicht mehr merken" : "Merken"}
            >
              {product.saved_by_me ? (
                <BookmarkCheck className="h-5 w-5 fill-current" />
              ) : (
                <Bookmark className="h-5 w-5" />
              )}
            </button>

            {/* Menge */}
            <QuantityStepper value={qty} onChange={setQty} min={1} max={99} className="h-12" />

            {/* Vormerken-CTA — wenn schon vorgemerkt: Status (kein Re-Trigger) */}
            <button
              type="button"
              onClick={isPreordered ? undefined : handleVormerken}
              disabled={isOwnP || interest.isPending || isPreordered}
              className={cn(
                "flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
                isPreordered
                  ? "bg-emerald-500/15 text-emerald-600 disabled:opacity-100 dark:text-emerald-400"
                  : isOwnP
                    ? "bg-muted text-muted-foreground disabled:opacity-60"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
              )}
            >
              {interest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPreordered ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Vorgemerkt
                </>
              ) : isOwnP ? (
                "Dein Produkt"
              ) : !viewerId ? (
                "Einloggen zum Vormerken"
              ) : (
                "Vormerken"
              )}
            </button>
          </div>
          {isPreordered && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs leading-snug text-emerald-600 dark:text-emerald-400">
                Eingetragen — @{product.seller.username} meldet sich bei dir. 🤎
              </p>
              <button
                type="button"
                onClick={() => cancelInterest.mutate(product.id)}
                disabled={cancelInterest.isPending}
                className="flex-none text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
              >
                {cancelInterest.isPending ? "…" : "Zurücknehmen"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Container — gleiche Kinder, anderer Shell. Sticky-Variante läuft vom
          Viewport-Rand (bottom-0), Inline-Variante ist ein ruhiger Card-Block
          in der Info-Column. */}
      <div
        className={cn(
          isInline
            ? "rounded-xl border border-border/60 bg-card p-3 shadow-elevation-1 dark:border-border/30"
            : "sticky bottom-0 left-0 right-0 z-20 border-t bg-background/90 px-4 py-3 backdrop-blur-md lg:px-6",
          className,
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3",
            isInline ? "" : "mx-auto max-w-5xl",
          )}
        >
          {/* Merken */}
          <button
            type="button"
            onClick={() =>
              viewerId
                ? save.mutate({
                    productId: product.id,
                    saved: product.saved_by_me,
                  })
                : router.push(
                    `/login?next=${encodeURIComponent(`/shop/${product.id}`)}` as Route,
                  )
            }
            disabled={save.isPending}
            className={cn(
              "flex h-12 w-12 flex-none items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted",
              product.saved_by_me && "text-primary",
            )}
            aria-label={product.saved_by_me ? "Nicht mehr merken" : "Merken"}
          >
            {product.saved_by_me ? (
              <BookmarkCheck className="h-5 w-5 fill-current" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
          </button>

          {/* Quantity-Stepper */}
          {showStepper && (
            <QuantityStepper
              value={qty}
              onChange={setQty}
              min={1}
              max={maxQty}
              className="h-12"
            />
          )}

          {/* Big-CTA */}
          <button
            type="button"
            onClick={handleBuy}
            disabled={soldOut || isOwn || buy.isPending}
            className={cn(
              "flex h-12 flex-1 items-center justify-between gap-3 rounded-full px-4 text-sm font-semibold text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              soldOut || isOwn
                ? "bg-muted text-muted-foreground"
                : !canAfford && viewerId
                  ? "border border-border bg-card text-foreground hover:bg-muted"
                  : "bg-primary hover:bg-primary/90",
            )}
          >
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CoinIcon className="h-4 w-4" />
              {totalCost.toLocaleString("de-DE")}
            </span>
            <span className="h-5 w-px bg-current/30" aria-hidden />
            <span>
              {soldOut
                ? "Ausverkauft"
                : isOwn
                  ? "Dein Produkt"
                  : !viewerId
                    ? "Einloggen zum Kaufen"
                    : !canAfford
                      ? "Coins aufladen"
                      : "Jetzt kaufen"}
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
            <SuccessPanel
              result={result}
              product={product}
              onClose={() => setConfirmOpen(false)}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Produkt kaufen?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
                  <div className="relative h-14 w-14 flex-none overflow-hidden rounded-md bg-muted">
                    <ProductImage
                      cover={product.cover_url}
                      title={product.title}
                      category={product.category}
                      sizes="56px"
                      fallbackClassName="text-xl"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium">
                      {product.title}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {qty}× · @{product.seller.username}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
                      <CoinIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {totalCost.toLocaleString("de-DE")}
                    </div>
                    {qty > 1 && (
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        ({qty}× {effPrice.toLocaleString("de-DE")})
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Aktuelles Guthaben
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <CoinIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {coinBalance.toLocaleString("de-DE")}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Nach Kauf</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 tabular-nums font-medium",
                        !canAfford && "text-foreground",
                      )}
                    >
                      <CoinIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {(coinBalance - totalCost).toLocaleString("de-DE")}
                    </span>
                  </div>
                </div>

                {!canAfford && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    Dir fehlen{" "}
                    {(totalCost - coinBalance).toLocaleString("de-DE")} Coins.
                    Lade Guthaben im Coin-Shop auf.
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
                    onClick={() =>
                      buy.mutate({ productId: product.id, quantity: qty })
                    }
                  >
                    {buy.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Bestätigen"
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
          Bestellung für &bdquo;{product.title}&quot; gespeichert. Neues
          Guthaben: {result.newBalance.toLocaleString("de-DE")} Coins.
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
            router.push("/shop/orders" as Route);
          }}
        >
          Meine Käufe
        </Button>
      </div>
    </div>
  );
}
