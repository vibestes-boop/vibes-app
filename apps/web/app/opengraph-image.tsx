import { ImageResponse } from 'next/og';

// -----------------------------------------------------------------------------
// Default-OG-Image für die Root-Domain.
//
// Next.js 15 emittiert daraus automatisch `/opengraph-image` und hängt es als
// `og:image`-Default an jede Seite, die keine eigene Version setzt. Pages
// mit eigenem `generateMetadata().openGraph.images` ODER eigener
// `opengraph-image.tsx` im selben Segment überschreiben diesen Fallback.
//
// Rendert 1200×630 PNG via Satori (Edge-Runtime). Keine externen Assets —
// alles inline damit der Edge-Render schnell bleibt und nicht an Asset-Fetches
// scheitert, wenn das R2/Storage mal kurz hängt.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo — Live, Feed, Shop';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background:
            'linear-gradient(135deg, #050508 0%, #1a0a2e 45%, #3a0f2a 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header: Brand-Mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background:
                'linear-gradient(135deg, #F59E0B 0%, #F43F5E 50%, #D946EF 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              fontWeight: 800,
              color: '#050508',
            }}
          >
            S
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#e5e3ec',
              letterSpacing: '-0.5px',
            }}
          >
            Serlo
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              fontSize: '84px',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-2px',
              maxWidth: '960px',
            }}
          >
            Live. Feed. Shop.
          </div>
          <div
            style={{
              fontSize: '32px',
              color: '#c7c3d0',
              lineHeight: 1.35,
              maxWidth: '860px',
            }}
          >
            Die Social-Video-Plattform für Creator, Händler und Community.
          </div>
        </div>

        {/* Footer: URL */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '22px',
            color: '#8d8a99',
          }}
        >
          <div style={{ display: 'flex', gap: '32px' }}>
            <span>Live-Streaming</span>
            <span>·</span>
            <span>Marktplatz</span>
            <span>·</span>
            <span>Community</span>
          </div>
          <div style={{ fontWeight: 500 }}>serlo.app</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
