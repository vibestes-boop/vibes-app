import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// /guilds/opengraph-image — statisches OG-Bild für die Pod-Discovery-Seite.
//
// Layout (1200×630):
//   Lila/Indigo Gradient, Shield-Symbol, Pod-Kacheln, Headline.
//
// v1.w.UI.131 — OG-Image-Abdeckung für öffentliche Hub-Seiten.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Pods';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 86400;

const PODS = [
  { name: 'Alpha Pod', emoji: '🔴' },
  { name: 'Beta Pod', emoji: '🔵' },
  { name: 'Gamma Pod', emoji: '🟢' },
  { name: 'Delta Pod', emoji: '🟡' },
  { name: 'Omega Pod', emoji: '🟣' },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0c0820 0%, #1e1145 50%, #0d0920 100%)',
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
            top: '-100px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '700px',
            height: '600px',
            borderRadius: '999px',
            background: 'radial-gradient(ellipse, rgba(167,139,250,0.12) 0%, transparent 70%)',
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
            color: '#a78bfa',
            fontSize: '22px',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '999px',
              background: '#a78bfa',
              display: 'inline-block',
            }}
          />
          Serlo
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
            🛡️
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
            Serlo Pods
          </div>

          <div
            style={{
              fontSize: '28px',
              color: '#c4b5fd',
              textAlign: 'center',
              marginBottom: '44px',
              display: 'flex',
            }}
          >
            Finde deine Community und zeig was du drauf hast
          </div>

          {/* Pod pills */}
          <div style={{ display: 'flex', gap: '14px' }}>
            {PODS.map((pod) => (
              <div
                key={pod.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(167,139,250,0.12)',
                  border: '1px solid rgba(167,139,250,0.25)',
                  color: '#ddd6fe',
                  fontSize: '18px',
                  fontWeight: 600,
                  padding: '10px 20px',
                  borderRadius: '14px',
                }}
              >
                <span style={{ display: 'flex' }}>{pod.emoji}</span>
                <span style={{ display: 'flex' }}>{pod.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
