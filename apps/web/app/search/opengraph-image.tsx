import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// /search/opengraph-image — statisches OG-Bild für die Suche.
//
// v1.w.UI.131 — OG-Image-Abdeckung für öffentliche Hub-Seiten.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Suche';
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
          background: 'linear-gradient(135deg, #080c10 0%, #111827 50%, #080c10 100%)',
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
            background: 'radial-gradient(ellipse, rgba(148,163,184,0.08) 0%, transparent 70%)',
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
            color: '#94a3b8',
            fontSize: '22px',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '999px',
              background: '#94a3b8',
              display: 'inline-block',
            }}
          />
          Serlo
        </div>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            gap: '0px',
          }}
        >
          <div style={{ fontSize: '88px', lineHeight: 1, marginBottom: '24px', display: 'flex' }}>
            🔍
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
            Serlo durchsuchen
          </div>

          <div
            style={{
              fontSize: '26px',
              color: '#64748b',
              textAlign: 'center',
              display: 'flex',
            }}
          >
            Videos · Creator · Hashtags · Produkte
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
