import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// /coin-shop/opengraph-image — statisches OG-Bild für die Coin-Shop-Seite.
//
// Layout (1200×630):
//   Dunkler Gradient-Hintergrund, zentriertes Coin-Icon, Headline + Subtext,
//   Zahlungsarten-Hinweis als Trust-Signal.
//
// Statisch (kein params) weil /coin-shop kein dynamisches Segment hat.
//
// v1.w.UI.127 — fehlende OG-Image-Abdeckung für Coin-Shop + Merchant-Storefront.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Coin-Shop';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 86400;

const TIERS = [
  { label: '100 Coins', price: '0,99 €' },
  { label: '550 Coins', price: '4,99 €' },
  { label: '1.200 Coins', price: '9,99 €' },
  { label: '2.800 Coins', price: '19,99 €' },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0a0810 0%, #1a1030 50%, #0d0a18 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '700px',
            height: '700px',
            borderRadius: '999px',
            background: 'radial-gradient(ellipse, rgba(212,175,55,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            padding: '64px',
            position: 'relative',
            gap: '0px',
          }}
        >
          {/* Serlo branding top-right */}
          <div
            style={{
              position: 'absolute',
              top: '52px',
              right: '64px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#d4af37',
              fontSize: '22px',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '999px',
                background: '#d4af37',
                display: 'inline-block',
              }}
            />
            Serlo
          </div>

          {/* Coin icon */}
          <div
            style={{
              fontSize: '96px',
              lineHeight: 1,
              marginBottom: '28px',
              display: 'flex',
            }}
          >
            🪙
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 1.1,
              marginBottom: '16px',
              display: 'flex',
            }}
          >
            Serlo Coin-Shop
          </div>

          {/* Bonus badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(212,175,55,0.15)',
              border: '1px solid rgba(212,175,55,0.35)',
              color: '#f4d47a',
              fontSize: '22px',
              fontWeight: 600,
              padding: '8px 22px',
              borderRadius: '999px',
              marginBottom: '40px',
            }}
          >
            ✨ Web-Bonus: bis zu +33 % mehr Coins
          </div>

          {/* Tier pills row */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '48px',
            }}
          >
            {TIERS.map((t) => (
              <div
                key={t.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '16px',
                  padding: '16px 24px',
                }}
              >
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#d4af37', display: 'flex' }}>
                  {t.label}
                </span>
                <span style={{ fontSize: '16px', color: '#9ca3af', display: 'flex' }}>{t.price}</span>
              </div>
            ))}
          </div>

          {/* Trust line */}
          <div
            style={{
              fontSize: '20px',
              color: '#6b7280',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <span>🔒 Sicher bezahlen</span>
            <span style={{ color: '#374151' }}>·</span>
            <span>Apple Pay</span>
            <span style={{ color: '#374151' }}>·</span>
            <span>Google Pay</span>
            <span style={{ color: '#374151' }}>·</span>
            <span>Kreditkarte</span>
            <span style={{ color: '#374151' }}>·</span>
            <span>Klarna</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
