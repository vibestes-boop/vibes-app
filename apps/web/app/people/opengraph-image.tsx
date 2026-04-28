import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// /people/opengraph-image — statisches OG-Bild für die User-Discovery-Seite.
//
// v1.w.UI.131 — OG-Image-Abdeckung für öffentliche Hub-Seiten.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo — Menschen entdecken';
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
          background: 'linear-gradient(135deg, #0f0a1e 0%, #1e1035 50%, #0f0a1e 100%)',
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
            top: '-80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '700px',
            height: '600px',
            borderRadius: '999px',
            background: 'radial-gradient(ellipse, rgba(236,72,153,0.10) 0%, transparent 70%)',
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
            color: '#f472b6',
            fontSize: '22px',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '999px',
              background: '#f472b6',
              display: 'inline-block',
            }}
          />
          Serlo
        </div>

        {/* Avatar circles decorative */}
        {[
          { top: 80, left: 80, size: 80, opacity: 0.3 },
          { top: 120, left: 200, size: 56, opacity: 0.2 },
          { top: 420, left: 60, size: 68, opacity: 0.25 },
          { top: 460, right: 80, size: 72, opacity: 0.2 },
          { top: 90, right: 180, size: 60, opacity: 0.2 },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${c.top}px`,
              left: c.left !== undefined ? `${c.left}px` : undefined,
              right: (c as { right?: number }).right !== undefined ? `${(c as { right?: number }).right}px` : undefined,
              width: `${c.size}px`,
              height: `${c.size}px`,
              borderRadius: '999px',
              background: `rgba(236,72,153,${c.opacity})`,
              border: '1px solid rgba(236,72,153,0.25)',
            }}
          />
        ))}

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
            👥
          </div>

          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 1.1,
              marginBottom: '14px',
              display: 'flex',
            }}
          >
            Menschen entdecken
          </div>

          <div
            style={{
              fontSize: '28px',
              color: '#fbcfe8',
              textAlign: 'center',
              display: 'flex',
            }}
          >
            Finde Creator und Freunde auf Serlo
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
