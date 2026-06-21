import Link from "next/link";
import type { Route } from "next";
import { CoinIcon } from '@/components/ui/coin-icon';
import { MapPin, Truck, Camera, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { StarDisplay } from "./star-display";
import { ProductImage } from "./product-image";
import type { ShopProduct } from "@/lib/data/shop";

// -----------------------------------------------------------------------------
// ProductCard — Kanonisches 3:4 Grid-Tile für alle Shop-Listen.
// Blur-Fill-Hintergrund + contain-Foreground, Sale/NEW/Counter-Badges,
// Seller-Row, Title, Stars, Location + Free-Shipping-Pill, Price-Pill, Sold.
//
// Kein Click-Handler — gewickelt in Link zu `/shop/[id]` vom Caller.
// -----------------------------------------------------------------------------

const NEW_THRESHOLD_HOURS = 48;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function effectivePrice(p: ShopProduct): number {
  return p.sale_price_coins ?? p.price_coins;
}

function isNew(p: ShopProduct): boolean {
  const ts = new Date(p.created_at).getTime();
  if (!Number.isFinite(ts)) return false;
  const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
  return ageHours < NEW_THRESHOLD_HOURS;
}

export function ProductCard({
  product,
  className,
  priority = false,
}: {
  product: ShopProduct;
  className?: string;
  priority?: boolean;
}) {
  const eff = effectivePrice(product);
  const isSale = product.sale_price_coins != null;
  const fresh = !isSale && isNew(product);

  const cover = product.cover_url ?? product.image_urls[0] ?? null;
  const gallerySize = (product.cover_url ? 1 : 0) + product.image_urls.length;
  const lowStock = product.stock > 0 && product.stock <= 3;
  const soldOut = product.stock === 0;

  return (
    <Link
      href={`/shop/${product.id}` as Route}
      className={cn(
        // Base Card: weiche Elevation-1 als ruhender Zustand, Border nur als
        // Light-Mode-Fallback für Shadow-Sichtbarkeit (`dark:border-border/30`
        // macht die Border im Dark-Mode fast weg, weil Shadow dort via Border-
        // Kontrast statt via Alpha funktioniert — siehe tailwind.config Tokens).
        "group relative block overflow-hidden rounded-xl bg-card",
        "border border-border/60 dark:border-border/30",
        "shadow-elevation-1",
        // Hover-Lift (duration-base ~200ms mit out-expo-Easing = Short-Video-Snap).
        // `translate-y`-Verschiebung kommt aus transform, nicht aus margin —
        // damit keine Layout-Shift auftritt und die GPU composited statt neu
        // paintet.
        "transition-all duration-base ease-out-expo",
        "hover:-translate-y-0.5 hover:shadow-elevation-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        !product.is_active && "opacity-60",
        className,
      )}
    >
      {/* Hero-Bild 3:4 mit Blur-Fill */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        <ProductImage
          cover={cover}
          title={product.title}
          category={product.category}
          priority={priority}
        />

        {/*
         * Badge-Konsolidierung (UI-Phase 3, C2): nur noch ZWEI Ecken belegt,
         * vorher waren es vier — top-left Sale, top-right Counter/Ausverkauft,
         * bottom-right LowStock, bottom-left Women-Only. „Clown-Art"-Effekt.
         * Neue Regel:
         *   • Top-Left  = primärer Status, exklusiv. Priorität: Sale > NEU.
         *   • Top-Right = sekundäre Info, exklusiv. Priorität: Ausverkauft >
         *     LowStock > Image-Counter.
         *   • Women-Only → wandert aus der Ecke raus in die Seller-Info-Row
         *     (siehe unten).
         * Damit bleibt immer eine diagonale Ecke frei und das Bild atmet.
         */}
        {(isSale || fresh) && (
          <span
            className={cn(
              "absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/25 bg-black/65 px-2 py-0.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm",
            )}
          >
            {isSale ? (
              "Angebot"
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                Neu
              </>
            )}
          </span>
        )}

        {soldOut ? (
          <span className="absolute right-2 top-2 rounded-md bg-black/80 px-2 py-0.5 text-xs font-semibold text-white">
            Ausverkauft
          </span>
        ) : lowStock ? (
          <span className="absolute right-2 top-2 rounded-md border border-white/25 bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
            {product.stock === 1 ? "1 verfügbar" : `${product.stock} verfügbar`}
          </span>
        ) : gallerySize > 1 ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            <Camera className="h-3 w-3" />
            {gallerySize}
          </span>
        ) : null}

        {/* Nicht-aktiv Overlay (nur sichtbar für Owner im Studio) */}
        {!product.is_active && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-foreground">
              Inaktiv
            </span>
          </div>
        )}
      </div>

      {/* Text-Bereich */}
      <div className="flex flex-col gap-1.5 p-3">
        {/* Seller-Row — Women-Only wandert als diskretes ♀-Glyph hier rein,
            statt als eigener Badge in der Bild-Ecke (vgl. C2-Konsolidierung). */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">@{product.seller.username}</span>
          {product.seller.verified && (
            <BadgeCheck className="h-3 w-3 flex-none text-muted-foreground" />
          )}
          {product.women_only && (
            <span
              className="flex-none text-muted-foreground"
              title="Nur für Frauen"
              aria-label="Nur für Frauen"
            >
              ♀
            </span>
          )}
        </div>

        {/* Titel */}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight text-foreground">
          {product.title}
        </h3>

        {/* Stars */}
        {product.review_count > 0 && (
          <StarDisplay
            rating={product.avg_rating}
            count={product.review_count}
          />
        )}

        {/* Location + Gratis-Versand */}
        {(product.location || product.free_shipping) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {product.location && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 flex-none" />
                <span className="truncate">{product.location}</span>
              </span>
            )}
            {product.free_shipping && product.category === "physical" && (
              <span className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                <Truck className="h-3 w-3" />
                Gratis
              </span>
            )}
          </div>
        )}

        {/* Preis + Sold */}
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold tabular-nums text-foreground">
              <span className="inline-flex items-center gap-1">
                <CoinIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {eff.toLocaleString("de-DE")}
              </span>
            </span>
            {isSale && (
              <span className="text-xs text-muted-foreground line-through tabular-nums">
                {product.price_coins.toLocaleString("de-DE")}
              </span>
            )}
          </div>
          {product.sold_count > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatCount(product.sold_count)}× verkauft
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// -----------------------------------------------------------------------------
// Skeleton — identischer Aspect-Ratio + Text-Platzhalter für Lade-Zustand.
// -----------------------------------------------------------------------------

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-elevation-1 dark:border-border/30">
      <div className="aspect-[3/4] w-full animate-pulse bg-muted" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function ProductCardGridSkeleton({ count = 8 }: { count?: number }) {
  // Grid-Cap bei lg:4 (v1.w.UI.1 — C1 aus UI_AUDIT). Vorher: `2xl:grid-cols-5`.
  // Warum rausgenommen: auf 2560px-Displays produzierte 5-col-Layout extrem
  // schmale Cards (~200px Breite), die Blur-Fill-Aesthetic zerbröselt dort.
  // Short-Video-Shop cappt ebenfalls bei 4 pro Reihe mit großzügiger Breite-pro-Tile.
  // Gap 3 → 4 (zusätzliche visuelle Ruhe zwischen Cards jetzt wo sie gelifted
  // sind und Hover-Shadow brauchen Clearance zum Nachbarn).
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
