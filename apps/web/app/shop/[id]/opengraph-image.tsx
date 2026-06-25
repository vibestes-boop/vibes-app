import { ImageResponse } from "next/og";
import { getProduct } from "@/lib/data/shop";
import { formatEur } from "@/lib/utils";
import { loadImageDataUri } from "@/lib/og-image";

// -----------------------------------------------------------------------------
// /shop/[id]/opengraph-image — dynamisches OG-Bild für Produkt-Detail-Seiten.
//
// Layout (1200×630):
//   Links (420px): Produkt-Cover-Bild, square-cropped auf schwarzem Grund.
//   Rechts: Titel, Kategorie-Badge, Preis in Coins, Verkäufer-Info.
//
// Fallback: generisches Serlo-Shop-Cover wenn Produkt nicht existiert.
//
// v1.w.UI.122 — fehlende OG-Image-Abdeckung für Produkte.
// -----------------------------------------------------------------------------

export const runtime = "edge";
export const alt = "Serlo Shop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const CATEGORY_LABELS: Record<string, string> = {
  physical: "Physisch",
  digital: "Digital",
  service: "Service",
  collectible: "Sammlerstück",
};

export default async function Image({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id).catch(() => null);

  if (!product) return fallback();

  const isPreorder = product.sale_mode === "preorder";
  const effectivePrice = product.sale_price_coins ?? product.price_coins;
  const eurLabel = formatEur(product.price_eur);
  // Vorbestellung zeigt € (zahlbar bei Lieferung), sonst Coins.
  const priceLabel = isPreorder
    ? eurLabel ?? "Vorbestellung"
    : `${effectivePrice.toLocaleString("de-DE")} Coins`;
  const categoryLabel = CATEGORY_LABELS[product.category] ?? product.category;
  const sellerLabel = `@${product.seller.username}`;
  // Cover + Avatar VORAB als JPEG-data-URI laden (Satori-sicher, auch für WebP).
  // null → Karte rendert OHNE Foto statt zu crashen (Details: lib/og-image).
  const [cover, avatar] = await Promise.all([
    loadImageDataUri(product.cover_url, 600, 900),
    loadImageDataUri(product.seller.avatar_url, 120, 120),
  ]);
  const titleFontSize =
    product.title.length > 60
      ? "40px"
      : product.title.length > 30
        ? "50px"
        : "60px";

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#0d0d12",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Left — product image */}
      <div
        style={{
          width: "420px",
          height: "630px",
          flexShrink: 0,
          display: "flex",
          background: "#18181f",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            width={420}
            height={630}
            style={{ width: "420px", height: "630px", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#18181f",
              color: "#6b7280",
              fontSize: "44px",
              fontWeight: 700,
            }}
          >
            Shop
          </div>
        )}

        {/* Status badge — Vorbestellung (höchste Priorität) oder Angebot */}
        {(isPreorder || product.sale_price_coins) && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "20px",
              background: isPreorder ? "#b45309" : "#111827",
              color: "#fff",
              fontSize: "22px",
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.18)",
              padding: "6px 14px",
              borderRadius: "999px",
              display: "flex",
            }}
          >
            {isPreorder ? "Vorbestellung" : "Angebot"}
          </div>
        )}
      </div>

      {/* Right — product info */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "64px",
        }}
      >
        {/* Serlo branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#f9fafb",
            fontSize: "22px",
            fontWeight: 600,
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "999px",
              background: "#f9fafb",
              display: "flex",
            }}
          />
          Serlo Shop
        </div>

        {/* Category badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "#f3f4f6",
              fontSize: "18px",
              fontWeight: 600,
              padding: "4px 14px",
              borderRadius: "999px",
              display: "flex",
            }}
          >
            {categoryLabel}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: titleFontSize,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#ffffff",
            marginBottom: "32px",
            overflow: "hidden",
            display: "-webkit-box",
          }}
        >
          {product.title}
        </div>

        {/* Price */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "14px",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              fontSize: "52px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1,
            }}
          >
            {priceLabel}
          </span>
          {!isPreorder && product.sale_price_coins && (
            <span
              style={{
                fontSize: "28px",
                color: "#6b7280",
                textDecoration: "line-through",
              }}
            >
              {product.price_coins.toLocaleString("de-DE")} Coins
            </span>
          )}
        </div>

        {/* Sold count */}
        {product.sold_count > 0 && (
          <div
            style={{
              fontSize: "20px",
              color: "#9ca3af",
              marginBottom: "4px",
              display: "flex",
            }}
          >
            {product.sold_count.toLocaleString("de-DE")}× gekauft
          </div>
        )}

        {/* Seller — bottom */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt=""
              width={56}
              height={56}
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "999px",
                objectFit: "cover",
                border: "2px solid rgba(255,255,255,0.12)",
              }}
            />
          ) : (
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "999px",
                background: "#e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 700,
                color: "#0d0d12",
              }}
            >
              {product.seller.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              style={{ fontSize: "20px", fontWeight: 600, color: "#e5e7eb" }}
            >
              {sellerLabel}
            </span>
            <span style={{ fontSize: "16px", color: "#6b7280" }}>
              Verkäufer auf Serlo
            </span>
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}

function fallback() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d0d12",
        color: "#f9fafb",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "64px",
        fontWeight: 700,
        gap: "20px",
      }}
    >
      Serlo Shop
    </div>,
    { width: 1200, height: 630 },
  );
}
