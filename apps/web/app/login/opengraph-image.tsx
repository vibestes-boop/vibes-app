import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// /login/opengraph-image — statisches OG-Bild für die Login-Seite.
//
// Minimal-Design: dunkles Brand-Card, kein noisy Inhalt.
// robots: noindex ist auf der page.tsx gesetzt — OG-Image trotzdem sinnvoll
// für Social-Previews wenn jemand den Link direkt teilt.
//
// v1.w.UI.131 — OG-Image-Abdeckung für öffentliche Hub-Seiten.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo — Anmelden';
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

        {/* Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '32px',
            padding: '64px 100px',
            position: 'relative',
          }}
        >
          {/* Logo dot + wordmark */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '32px',
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
              fontSize: '34px',
              fontWeight: 600,
              color: '#e2e8f0',
              marginBottom: '12px',
              display: 'flex',
            }}
          >
            Willkommen zurück
          </div>

          <div
            style={{
              fontSize: '22px',
              color: '#64748b',
              textAlign: 'center',
              display: 'flex',
            }}
          >
            Melde dich an und tauche in den Feed ein
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
