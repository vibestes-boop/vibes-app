import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CoinIcon } from '@/components/ui/coin-icon';
import { Store, Bookmark, Package, ShoppingBag, Plus } from "lucide-react";
import { ShopGrid } from "@/components/shop/shop-grid";
import { ShopFilters } from "@/components/shop/shop-filters";
import { ShopSearchInput } from "@/components/shop/shop-search-input";
import { BannerCarousel } from "@/components/shop/banner-carousel";
import { EmptyState as CanonicalEmptyState } from "@/components/ui/empty-state";
import {
  getShopProducts,
  getShopBanners,
  getMyCoinBalance,
  type ShopCatalogParams,
} from "@/lib/data/shop";
import { getUser } from "@/lib/auth/session";
import { getT, getLocale } from "@/lib/i18n/server";
import { LOCALE_INTL } from "@/lib/i18n/config";
import type { ProductCategory } from "@shared/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("shop.metaTitle"),
    description: t("shop.metaDescription"),
    openGraph: {
      title: t("shop.ogTitle"),
      description: t("shop.ogDescription"),
    },
  };
}

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// Katalog-Seite. URL-Query-Parameters steuern Category/Sort/Sale/Shipping/
// Preis-Range/Suche. ShopFilters (Sidebar) schreibt die URL; diese Page
// re-rendert pro Param-Änderung weil `force-dynamic`.
// -----------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShopCatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const pick = (key: string): string | undefined => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const params: ShopCatalogParams = {
    category:
      (pick("category") as ProductCategory | "all" | undefined) ?? "all",
    sort: (pick("sort") as ShopCatalogParams["sort"]) ?? "popular",
    onSaleOnly: pick("sale") === "1",
    freeShippingOnly: pick("shipping") === "1",
    minPrice: pick("min") ? Number(pick("min")) : undefined,
    maxPrice: pick("max") ? Number(pick("max")) : undefined,
    q: pick("q") ?? undefined,
    limit: 24,
  };

  const [products, banners, user, t, locale] = await Promise.all([
    getShopProducts(params),
    getShopBanners(),
    getUser(),
    getT(),
    getLocale(),
  ]);
  const balance = user ? await getMyCoinBalance() : null;

  return (
    // pt-14 mobile: Platz für die fixed Auth-/Account-Pills oben rechts —
    // sonst verdecken sie die „Filter & Sortierung"-Leiste (erste Zeile).
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-0 pt-14 lg:grid-cols-[260px_1fr] lg:pt-0">
      <ShopFilters />

      <main className="min-w-0 px-2 pb-6 pt-4 sm:px-4 sm:pt-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Store className="h-6 w-6 text-primary" />
              {t("shop.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length === 0
                ? t("shop.noMatches")
                : t("shop.browseCatalog")}
            </p>
          </div>

          {/* Vertikale Icon-über-Label-Chips (icon oben, Beschriftung unten) —
              fit auf Mobile ohne horizontalen Überlauf. Coin groß + rahmenlos,
              Zahl darunter. Auf sm+ rechts gruppiert. */}
          <div className="flex items-stretch justify-around gap-1 sm:justify-end sm:gap-4">
            {balance !== null && (
              <Link
                href={"/coin-shop" as Route}
                className="flex flex-col items-center justify-center gap-1 px-1 transition-opacity hover:opacity-80"
                title="Guthaben aufladen"
              >
                <CoinIcon className="h-8 w-8" />
                <span className="text-[11px] font-semibold leading-none tabular-nums">
                  {balance.toLocaleString(LOCALE_INTL[locale])}
                </span>
              </Link>
            )}
            {user && (
              <ActionChip
                href="/studio/shop/new"
                label="Verkaufen"
                icon={<Plus className="h-5 w-5" />}
                primary
              />
            )}
            {user && (
              <ActionChip
                href="/studio/shop"
                label="Mein Shop"
                icon={<Store className="h-5 w-5" />}
              />
            )}
            {user && (
              <ActionChip
                href="/shop/orders"
                label={t("shop.myOrders")}
                icon={<Package className="h-5 w-5" />}
              />
            )}
            {user && (
              <ActionChip
                href="/shop/saved"
                label={t("shop.saved")}
                icon={<Bookmark className="h-5 w-5" />}
              />
            )}
          </div>
        </div>

        {/* Werbe-Banner-Karussell (eigene Promos / vermietbare Fläche) */}
        {banners.length > 0 && <BannerCarousel banners={banners} />}

        {/* Such-Box */}
        <div className="mb-6 max-w-md">
          <ShopSearchInput initialQuery={params.q ?? ""} />
        </div>

        {/* Grid */}
        {products.length === 0 ? (
          <EmptyState />
        ) : (
          <ShopGrid initialProducts={products} params={params} />
        )}
      </main>
    </div>
  );
}

// Vertikaler Shop-Action-Chip: Icon-Kreis oben, Label darunter. `primary` =
// Akzent-Kreis (Verkaufen-CTA), sonst dezenter `bg-muted`-Kreis.
function ActionChip({
  href,
  icon,
  label,
  primary,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href as Route}
      className="flex flex-col items-center gap-1 px-1"
    >
      <span
        className={
          "flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-90 " +
          (primary ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")
        }
      >
        {icon}
      </span>
      <span className="whitespace-nowrap text-[11px] font-medium leading-none">
        {label}
      </span>
    </Link>
  );
}

async function EmptyState() {
  const t = await getT();
  return (
    <CanonicalEmptyState
      icon={<ShoppingBag className="h-8 w-8" strokeWidth={1.75} />}
      title={t("shop.emptyTitle")}
      description={t("shop.emptyHint")}
      size="md"
      bordered
    />
  );
}
