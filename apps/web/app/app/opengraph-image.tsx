import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// /app/opengraph-image — Marken-Unfurl für den teilbaren App-Store-Link.
//
// Layout (1200×630): dunkler Lila-Gradient (Marken-Lila), 🌸 + Wortmarke,
// Feature-Zeile, App-Store-Pill. Satori-Regeln beachtet (jedes Element mit
// >1 Kind display:flex, keine undefined-Styles, kein WebP-<img>).
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo — Jetzt im App Store';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 86400;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #12041f 0%, #2D0050 55%, #1a0533 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '900px',
            height: '650px',
            borderRadius: '999px',
            background: 'radial-gradient(ellipse, rgba(167,139,250,0.16) 0%, transparent 70%)',
          }}
        />

        {/* Main */}
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
          }}
        >
          <div style={{ fontSize: '84px', lineHeight: 1, marginBottom: '18px', display: 'flex' }}>
            🌸
          </div>

          <div
            style={{
              fontSize: '96px',
              fontWeight: 800,
              letterSpacing: '-3px',
              color: '#ffffff',
              display: 'flex',
              marginBottom: '10px',
            }}
          >
            Serlo
          </div>

          <div
            style={{
              fontSize: '30px',
              color: '#c4b5fd',
              display: 'flex',
              marginBottom: '48px',
            }}
          >
            Videos · Live · Marktplatz
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: '#ffffff',
              color: '#12041f',
              fontSize: '26px',
              fontWeight: 700,
              padding: '16px 36px',
              borderRadius: '999px',
            }}
          >
             Jetzt im App Store laden
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
