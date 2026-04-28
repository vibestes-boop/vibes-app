import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// /signup/opengraph-image — statisches OG-Bild für die Registrierungs-Seite.
//
// v1.w.UI.131 — OG-Image-Abdeckung für öffentliche Hub-Seiten.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo — Kostenlos registrieren';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 86400;

const PERKS = ['📹 Videos', '🎁 Geschenke', '📡 Live', '🛍️ Shop', '🛡️ Pods'];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #090912 0%, #13132a 50%, #0a0a18 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '700px',
            height: '500px',
            borderRadius: '999px',
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            gap: '0px',
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '28px',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
              }}
            >
              S
            </div>
            <span style={{ fontSize: '48px', fontWeight: 800, display: 'flex' }}>Serlo</span>
          </div>

          <div
            style={{
              fontSize: '62px',
              fontWeight: 800,
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 1.1,
              marginBottom: '14px',
              display: 'flex',
            }}
          >
            Kostenlos mitmachen
          </div>

          <div
            style={{
              fontSize: '26px',
              color: '#94a3b8',
              textAlign: 'center',
              marginBottom: '44px',
              display: 'flex',
            }}
          >
            Die Community-Plattform für dich
          </div>

          {/* Perks */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {PERKS.map((p) => (
              <div
                key={p}
                style={{
                  display: 'flex',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.22)',
                  color: '#c7d2fe',
                  fontSize: '20px',
                  fontWeight: 600,
                  padding: '10px 22px',
                  borderRadius: '999px',
                }}
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
