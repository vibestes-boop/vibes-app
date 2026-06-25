import { ImageResponse } from "next/og";

// -----------------------------------------------------------------------------
// /shop/opengraph-image — statisches OG-Bild für die Shop-Katalog-Seite.
//
// Layout (1200×630):
//   Ruhiger dunkler Hintergrund, Feature-Pills, Headline.
//
// v1.w.UI.131 — OG-Image-Abdeckung für öffentliche Hub-Seiten.
// -----------------------------------------------------------------------------

export const runtime = "edge";
export const alt = "Serlo Marketplace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

const FEATURES = [
  { label: "Mit Coins bezahlen" },
  { label: "Creator-Produkte" },
  { label: "Digitale & physische Artikel" },
  { label: "Exklusive Angebote" },
];

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#0d0d12",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "600px",
          borderRadius: "999px",
          background:
            "radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Serlo branding */}
      <div
        style={{
          position: "absolute",
          top: "52px",
          right: "64px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "#f9fafb",
          fontSize: "22px",
          fontWeight: 600,
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
        Serlo
      </div>

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "64px",
          position: "relative",
          gap: "0px",
        }}
      >
        <div
          style={{
            fontSize: "30px",
            lineHeight: 1,
            marginBottom: "24px",
            display: "flex",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#9ca3af",
            fontWeight: 700,
          }}
        >
          Shop
        </div>

        <div
          style={{
            fontSize: "74px",
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: "14px",
            display: "flex",
          }}
        >
          Serlo Marketplace
        </div>

        <div
          style={{
            fontSize: "28px",
            color: "#9ca3af",
            textAlign: "center",
            marginBottom: "44px",
            display: "flex",
          }}
        >
          Kaufe direkt von deinen Lieblings-Creatorn
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#e5e7eb",
                fontSize: "19px",
                fontWeight: 600,
                padding: "10px 20px",
                borderRadius: "999px",
              }}
            >
              <span style={{ display: "flex" }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
