import type { Metadata } from "next";
import { safeJsonLd } from '@/lib/seo/json-ld';
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { CoinIcon } from '@/components/ui/coin-icon';
import {
  BadgeCheck,
  MapPin,
  Package,
  Download,
  Wrench,
  Gem,
  ShoppingBag,
  Star,
} from "lucide-react";
import { ImageCarousel } from "@/components/shop/image-carousel";
import { BuyBar } from "@/components/shop/buy-bar";
import { ReviewList } from "@/components/shop/review-list";
import { ReviewForm } from "@/components/shop/review-form";
import { ProductCard } from "@/components/shop/product-card";
import { ProductDescription } from "@/components/shop/product-description";
import { StarDisplay } from "@/components/shop/star-display";
import { SellerChatButton } from "@/components/shop/seller-chat-button";
import {
  getProduct,
  getProductReviews,
  getMyReview,
  getEligibleOrderForReview,
  getMerchantProducts,
  getMyCoinBalance,
} from "@/lib/data/shop";
import { getUser } from "@/lib/auth/session";
import { formatEur } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Product-Detail — /shop/[id]
// - Hero-Carousel + Blur-Fill
// - Seller-Karte
// - Description (kollabierbar via Details-Summary)
// - Stock-Hinweis
// - Review-Sektion (read + write wenn eligible)
// - Related-Products (andere Produkte desselben Sellers)
// - Sticky BuyBar am unteren Ende
// -----------------------------------------------------------------------------

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) {
    return { title: "Produkt nicht gefunden" };
  }
  const eff = product.sale_price_coins ?? product.price_coins;
  const title = `${product.title} · @${product.seller.username}`;
  const description =
    product.description?.slice(0, 160) ??
    `Produkt von @${product.seller.username} für ${eff.toLocaleString("de-DE")} Coins.`;
  const cover = product.cover_url ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: `/shop/${id}` },
    openGraph: {
      // Next's Metadata-API hat kein natives `product`-Type (facebook/OG macht das
      // über OG-Extensions). `website` ist der safe-default; Preis + Verfügbarkeit
      // kommunizieren wir über die Description, damit alle Scraper (Discord,
      // WhatsApp, Telegram, FB) konsistent rendern.
      type: "website",
      title,
      description,
      url: `/shop/${id}`,
      siteName: "Serlo",
      images: cover ? [{ url: cover, alt: product.title }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: typeof Package; delivery: string }
> = {
  physical: {
    label: "Physisches Produkt",
    icon: Package,
    delivery: "Wird verschickt. Details koordinierst du mit dem Verkäufer.",
  },
  digital: {
    label: "Digitaler Download",
    icon: Download,
    delivery: "Sofortiger Download nach Kauf.",
  },
  service: {
    label: "Service",
    icon: Wrench,
    delivery: "Nach Kauf kontaktiert dich der Anbieter für Details.",
  },
  collectible: {
    label: "Collectible",
    icon: Gem,
    delivery: "Sammelobjekt — Lieferbedingungen siehe Beschreibung.",
  },
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const [reviews, myReview, eligibleOrderId, moreFromSeller, user] =
    await Promise.all([
      getProductReviews(id),
      getMyReview(id),
      getEligibleOrderForReview(id),
      getMerchantProducts(product.seller_id, 8),
      getUser(),
    ]);
  const balance = user ? await getMyCoinBalance() : 0;

  const images = [product.cover_url, ...product.image_urls].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  const catMeta = CATEGORY_META[product.category];

  const eff = product.sale_price_coins ?? product.price_coins;
  const isSale = product.sale_price_coins !== null;
  const isPreorder = product.sale_mode === "preorder";

  const others = moreFromSeller.filter((p) => p.id !== product.id).slice(0, 4);

  // ── Etsy-Minimal (Parität zur Mobile-Detailseite): Subline + 3-Spalten-Infozeile ──
  const percentOff = isSale
    ? Math.round((1 - eff / product.price_coins) * 100)
    : null;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const subline = [
    catMeta?.label ?? product.category,
    product.women_only ? "Women-Only" : null,
    product.sold_count > 0
      ? `${product.sold_count.toLocaleString("de-DE")}× verkauft`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const deliveryShort =
    product.category === "physical"
      ? product.free_shipping
        ? "Gratis"
        : "Per DM"
      : product.category === "digital"
        ? "Sofort"
        : "Nach Kauf";
  const stockShort =
    product.stock === -1
      ? "Auf Lager"
      : product.stock === 0
        ? "Ausverkauft"
        : isLowStock
          ? `Nur ${product.stock}`
          : `${product.stock}`;

  // ── JSON-LD: Product schema ──────────────────────────────────────────────
  // Ermöglicht Google Rich-Snippets (Bewertungssterne, Preis-Hint) in den
  // Suchergebnissen — signifikanter CTR-Boost für Shop-Seiten.
  // Preis: Coins sind keine ISO-4217-Währung — wir geben `priceCurrency: 'XXX'`
  // (ISO-Platzhalter für non-fiat) + `description` mit Coin-Betrag.
  // v1.w.UI.133 — JSON-LD structured data batch.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://serlo.app";
  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: images.length > 0 ? images : undefined,
    url: `${siteUrl}/shop/${product.id}`,
    brand: {
      "@type": "Person",
      name: `@${product.seller.username}`,
      url: `${siteUrl}/u/${product.seller.username}`,
    },
    offers: {
      "@type": "Offer",
      availability:
        product.stock === 0
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      priceCurrency: "XXX",
      price: eff,
      seller: {
        "@type": "Person",
        name: `@${product.seller.username}`,
        url: `${siteUrl}/u/${product.seller.username}`,
      },
    },
    ...(product.review_count > 0 && product.avg_rating !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.avg_rating.toFixed(1),
            reviewCount: product.review_count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }}
      />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col px-4 pb-0 pt-6 lg:px-6">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-muted-foreground">
          <Link href={"/shop" as Route} className="hover:text-foreground">
            Shop
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{product.title}</span>
        </nav>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: Image-Carousel */}
          <div>
            <ImageCarousel
              images={images}
              alt={product.title}
              category={product.category}
            />
          </div>

          {/* Right: Info */}
          <div className="flex flex-col gap-5">
            {/* Titel zuerst (Etsy-Minimal) + Subline: Kategorie · Women-Only · Verkäufe */}
            <div>
              <h1 className="text-2xl font-semibold leading-tight md:text-3xl">
                {product.title}
              </h1>
              {subline && (
                <p className="mt-1.5 text-sm text-muted-foreground">{subline}</p>
              )}
            </div>

            {/* Preis (monochrom): Coin + Preis + Alt-Preis + −% · Ort darunter */}
            <div>
              {isPreorder ? (
                formatEur(product.price_eur) ? (
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold tabular-nums text-foreground">
                      {formatEur(product.price_eur)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      🤎 Vorbestellung · zahlbar bei Lieferung
                    </span>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/15 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                    🤎 Vorbestellung · Preis siehe Beschreibung
                  </span>
                )
              ) : (
                <div className="flex items-baseline gap-3">
                  <span className="inline-flex items-center gap-2 text-4xl font-bold tabular-nums text-foreground">
                    <CoinIcon className="h-7 w-7" />
                    {eff.toLocaleString("de-DE")}
                  </span>
                  {isSale && (
                    <>
                      <span className="text-lg text-muted-foreground line-through tabular-nums">
                        {product.price_coins.toLocaleString("de-DE")}
                      </span>
                      {percentOff !== null && (
                        <span className="text-sm font-medium text-muted-foreground">
                          −{percentOff} %
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
              {product.location && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {product.location}
                </div>
              )}
            </div>

            {/* 3-Spalten-Infozeile: Lieferung | Bewertung | Lager */}
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border">
              <div className="px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Lieferung
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {deliveryShort}
                </div>
              </div>
              <div className="border-l border-border px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Bewertung
                </div>
                <div className="mt-0.5 flex items-center gap-1 truncate text-sm font-medium text-foreground">
                  {product.review_count > 0 && product.avg_rating !== null ? (
                    <>
                      <Star className="h-3 w-3 fill-current" />
                      {product.avg_rating.toFixed(1)} ({product.review_count})
                    </>
                  ) : (
                    "Neu"
                  )}
                </div>
              </div>
              <div className="border-l border-border px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Lager
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {stockShort}
                </div>
              </div>
            </div>

            {/*
            Seller-Karte — bewusst FLACH, KEIN Nested-Link:
            (a) HTML erlaubt keine <a> in <a> (Browser-Verhalten undefined),
            (b) Server Components dürfen keine onClick-Handler als Props
                weiterreichen (→ "Event handlers cannot be passed to Client
                Component props" Build/RSC-Serialisierungsfehler). Früher hatten
                wir ein äußeres <Link> mit stopPropagation-Wrapper-<div>s für
                die inneren Interaktionen — das crasht die Detail-Seite beim
                SSR. Stattdessen: Container ist ein <div>, nur der Avatar-/Name-
                Block ist ein Link, Chat-Button und Shop-Link sind eigenständige
                Siblings daneben.
          */}
            {/* Seller-Karte (C5) — vorher harte border+card, jetzt weiches
              muted-Surface mit Hairline-Ring; Avatar bekommt Background-
              Ring (vgl. iOS Contact-Cards, Short-Video Seller-Chips). Der Hover
              auf Avatar-/Name-Link bleibt sichtbar via ring-accent-Switch. */}
            <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4 ring-1 ring-black/5 dark:ring-white/10">
              <Link
                href={`/u/${product.seller.username}` as Route}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none"
              >
                <div className="relative h-12 w-12 flex-none overflow-hidden rounded-full bg-muted ring-2 ring-background transition-shadow duration-base ease-out-expo group-hover:ring-primary/60 group-focus-visible:ring-primary">
                  {product.seller.avatar_url && (
                    <Image
                      src={product.seller.avatar_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground group-hover:underline underline-offset-4 decoration-foreground/40">
                      @{product.seller.username}
                    </span>
                    {product.seller.verified && (
                      <BadgeCheck className="h-4 w-4 text-sky-500" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Profil ansehen →
                  </div>
                </div>
              </Link>
              {user && user.id !== product.seller_id && (
                <SellerChatButton
                  sellerId={product.seller_id}
                  productId={product.id}
                />
              )}
              <Link
                href={`/u/${product.seller.username}/shop` as Route}
                className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-black/5 transition-colors duration-fast ease-out-expo hover:bg-background dark:bg-background/50 dark:ring-white/10 dark:hover:bg-background/80"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Shop
              </Link>
            </div>

            {/* Beschreibung (C6) — Gradient-Fade + animiertes Expand statt
              nativem <details>. Eigene Client-Komponente, weil die Animation
              eine gemessene Ziel-Höhe braucht. */}
            {product.description && (
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Beschreibung
                </div>
                <ProductDescription text={product.description} />
              </div>
            )}

            {/* Inline Buy-CTA (Desktop) — direkt in der Info-Column. Mobile
              nutzt weiter die Sticky-Variante am Seiten-Ende (siehe unten). */}
            <div className="hidden lg:block">
              <BuyBar
                product={product}
                viewerId={user?.id ?? null}
                coinBalance={balance}
                variant="inline"
              />
            </div>
          </div>
        </div>

        {/* Reviews */}
        <section id="reviews" className="mt-16 border-t pt-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Bewertungen</h2>
              {product.review_count > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <StarDisplay
                    rating={product.avg_rating}
                    count={product.review_count}
                    size={16}
                    showCount={false}
                  />
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {product.avg_rating?.toFixed(1) ?? "–"} ·{" "}
                    {product.review_count} Bewertungen
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
            <ReviewList productId={id} initialData={reviews} />
            {user && eligibleOrderId && (
              <ReviewForm productId={id} initialReview={myReview} />
            )}
          </div>
        </section>

        {/* Mehr vom Seller */}
        {others.length > 0 && (
          <section className="mt-16 border-t pt-12">
            <h2 className="mb-6 text-xl font-semibold">
              Mehr von @{product.seller.username}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {others.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Sticky BuyBar — nur Mobile. Desktop rendert die Inline-Variante
          oben in der Info-Column (siehe `variant="inline"` weiter oben). */}
        <div className="mt-10 lg:hidden" />
        <div className="lg:hidden">
          <BuyBar
            product={product}
            viewerId={user?.id ?? null}
            coinBalance={balance}
            variant="sticky"
          />
        </div>
      </div>
    </>
  );
}
