import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// /live/opengraph-image — statisches OG-Bild für die Live-Discovery-Seite.
//
// Layout (1200×630):
//   Rot/Orange Gradient, Radio-Symbol, Live-Puls-Ring, Headline.
//
// v1.w.UI.131 — OG-Image-Abdeckung für öffentliche Hub-Seiten.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Live';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1a0505 0%, #3d0c0c 50%, #1a0505 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated-feel glow rings */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '900px',
            height: '900px',
            borderRadius: '999px',
            background: 'radial-gradient(ellipse, rgba(239,68,68,0.08) 0%, transparent 60%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            height: '500px',
            borderRadius: '999px',
            border: '1px solid rgba(239,68,68,0.12)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '700px',
            height: '700px',
            borderRadius: '999px',
            border: '1px solid rgba(239,68,68,0.07)',
          }}
        />

        {/* Serlo branding */}
        <div
          style={{
            position: 'absolute',
            top: '52px',
            right: '64px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#f87171',
            fontSize: '22px',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '999px',
              background: '#f87171',
              display: 'inline-block',
            }}
          />
          Serlo
        </div>

        {/* LIVE badge top-left */}
        <div
          style={{
            position: 'absolute',
            top: '52px',
            left: '64px',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            background: '#ef4444',
            color: '#ffffff',
            fontSize: '20px',
            fontWeight: 700,
            padding: '7px 18px',
            borderRadius: '8px',
            letterSpacing: '0.05em',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '999px',
              background: '#ffffff',
              display: 'inline-block',
            }}
          />
          LIVE
        </div>

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
          <div style={{ fontSize: '88px', lineHeight: 1, marginBottom: '24px', display: 'flex' }}>
            📡
          </div>

          <div
            style={{
              fontSize: '74px',
              fontWeight: 800,
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 1.1,
              marginBottom: '14px',
              display: 'flex',
            }}
          >
            Jetzt live auf Serlo
          </div>

          <div
            style={{
              fontSize: '28px',
              color: '#fca5a5',
              textAlign: 'center',
              marginBottom: '44px',
              display: 'flex',
            }}
          >
            Streame live oder schau deinen Lieblings-Creatorn zu
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: '14px' }}>
            {['🎁 Geschenke', '💬 Live-Chat', '⚔️ Battles', '🎤 Co-Host'].map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.22)',
                  color: '#fca5a5',
                  fontSize: '19px',
                  fontWeight: 600,
                  padding: '10px 22px',
                  borderRadius: '999px',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
