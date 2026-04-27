import { ImageResponse } from 'next/og';
import { getLiveSession } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// Dynamic OG-Image für /live/[id].
//
// Layout: Stream-Thumbnail links (16:9) + LIVE-Badge + Titel + Host + Viewer
//         rechts auf dunklem Hintergrund.
//
// Ziel: Wenn ein User einen Stream-Link teilt (WhatsApp, Telegram, Discord,
// Twitter) erscheint die richtige Vorschau statt der generischen Root-Karte.
// Das verbessert Click-Through-Rate signifikant (Stream-Thumbnail > "Serlo").
//
// Edge-Runtime — kein `createClient()` (Edge braucht fetch, kein pg).
// getLiveSession nutzt intern server-seitigen Supabase-Client via fetch API.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Live Stream';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
  const session = await getLiveSession(params.id).catch(() => null);

  if (!session) return fallback();

  const hostName = session.host?.display_name ?? `@${session.host?.username ?? 'Host'}`;
  const title = session.title ?? 'Live Stream';
  const viewerCount = session.viewer_count ?? 0;
  const isLive = session.status === 'active';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#050508',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Left — thumbnail / stream preview, 16:9-ish crop */}
        <div
          style={{
            width: '560px',
            height: '100%',
            display: 'flex',
            background: '#14111e',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {session.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.thumbnail_url}
              alt=""
              width={560}
              height={630}
              style={{ width: '560px', height: '630px', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(160deg, #3a0f2a 0%, #1a0a2e 50%, #050508 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '96px',
              }}
            >
              🎥
            </div>
          )}

          {/* LIVE badge */}
          {isLive && (
            <div
              style={{
                position: 'absolute',
                top: '24px',
                left: '24px',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 800,
                letterSpacing: '2px',
                padding: '6px 16px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textTransform: 'uppercase',
                boxShadow: '0 2px 12px rgba(220,38,38,0.5)',
              }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '999px',
                  background: '#ffffff',
                  display: 'inline-block',
                }}
              />
              LIVE
            </div>
          )}

          {/* Viewer count overlay */}
          {viewerCount > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                right: '20px',
                background: 'rgba(0,0,0,0.72)',
                color: '#ffffff',
                fontSize: '18px',
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backdropFilter: 'blur(4px)',
              }}
            >
              👁 {viewerCount.toLocaleString('de-DE')}
            </div>
          )}
        </div>

        {/* Right column — meta */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '64px 56px',
          }}
        >
          {/* Brand */}
          <div
            style={{
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
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                background: '#d4af37',
                display: 'inline-block',
              }}
            />
            Serlo Live
          </div>

          {/* Stream title */}
          <div
            style={{
              marginTop: '48px',
              fontSize: title.length > 60 ? '38px' : title.length > 40 ? '44px' : '52px',
              fontWeight: 700,
              lineHeight: 1.25,
              color: '#ffffff',
              display: '-webkit-box',
              overflow: 'hidden',
            }}
          >
            {title}
          </div>

          {/* Host info */}
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
            }}
          >
            {session.host?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.host.avatar_url}
                alt=""
                width={64}
                height={64}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '999px',
                  border: '3px solid rgba(255,255,255,0.15)',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #d4af37, #f4d47a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '26px',
                  fontWeight: 700,
                  color: '#050508',
                }}
              >
                {hostName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{hostName}</div>
              <div style={{ fontSize: '18px', color: '#8d8a99' }}>
                @{session.host?.username}
                {isLive && viewerCount > 0 ? ` · ${viewerCount.toLocaleString('de-DE')} Zuschauer` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function fallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #050508, #3a0f2a)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '72px' }}>📡</div>
        <div style={{ fontSize: '48px', fontWeight: 700 }}>Serlo Live</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
