import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// /explore/opengraph-image — statisches OG-Bild für die Explore-Discovery-Seite.
//
// Layout (1200×630):
//   Blau-cyan Gradient, zentriertes Kompass-Symbol, Trending-Hashtag-Pills,
//   Headline + Subtext.
//
// v1.w.UI.131 — OG-Image-Abdeckung für öffentliche Hub-Seiten.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Entdecken';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 86400;

const SAMPLE_TAGS = ['#tschetschenien', '#viral', '#musik', '#live', '#sport', '#comedy'];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #050d1a 0%, #0c1e3d 50%, #071428 100%)',
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
            top: '-80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '800px',
            height: '600px',
            borderRadius: '999px',
            background: 'radial-gradient(ellipse, rgba(56,189,248,0.10) 0%, transparent 70%)',
          }}
        />

        {/* Serlo branding top-right */}
        <div
          style={{
            position: 'absolute',
            top: '52px',
            right: '64px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#38bdf8',
            fontSize: '22px',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '999px',
              background: '#38bdf8',
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
          {/* Compass emoji */}
          <div style={{ fontSize: '88px', lineHeight: 1, marginBottom: '24px', display: 'flex' }}>
            🧭
          </div>

          {/* Headline */}
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
            Entdecken
          </div>

          {/* Sub */}
          <div
            style={{
              fontSize: '28px',
              color: '#93c5fd',
              textAlign: 'center',
              marginBottom: '44px',
              display: 'flex',
            }}
          >
            Trending Videos, Hashtags & Creator
          </div>

          {/* Hashtag pills */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {SAMPLE_TAGS.map((tag) => (
              <div
                key={tag}
                style={{
                  display: 'flex',
                  background: 'rgba(56,189,248,0.12)',
                  border: '1px solid rgba(56,189,248,0.25)',
                  color: '#7dd3fc',
                  fontSize: '20px',
                  fontWeight: 600,
                  padding: '8px 20px',
                  borderRadius: '999px',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
