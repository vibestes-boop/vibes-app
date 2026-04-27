import { ImageResponse } from 'next/og';
import { getLiveSession } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// Dynamic OG-Image für /live/replay/[id] — VOD-Replay-Seite.
//
// Layout: identisch mit /live/[id]/opengraph-image, aber:
//  • "REPLAY"-Badge statt "LIVE"
//  • Peak-Viewer statt aktueller Viewer-Count
//  • Keine roten Puls-Ring-Effekte
//
// Teilen-Flow: Wenn ein Stream endet, teilen Host + Viewer häufig den
// Replay-Link. Ohne OG-Image erscheint eine leere Vorschau — schlechte CTR.
//
// Edge-Runtime — getLiveSession nutzt Supabase-REST via fetch.
//
// v1.w.UI.132 — Replay-OG-Image-Gap geschlossen.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Live Replay';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getLiveSession(id).catch(() => null);

  if (!session) return fallback();

  const hostName = session.host?.display_name ?? `@${session.host?.username ?? 'Host'}`;
  const title = session.title ?? 'Live-Aufnahme';
  const peakViewers = session.peak_viewer_count ?? 0;

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
        {/* Left — thumbnail / stream preview */}
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
                background: 'linear-gradient(160deg, #1a1230 0%, #0d0a20 50%, #050508 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '96px',
              }}
            >
              🎬
            </div>
          )}

          {/* REPLAY badge */}
          <div
            style={{
              position: 'absolute',
              top: '24px',
              left: '24px',
              background: '#1e1e2e',
              border: '1.5px solid rgba(255,255,255,0.18)',
              color: '#e2e8f0',
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '2px',
              padding: '6px 16px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textTransform: 'uppercase',
            }}
          >
            <div style={{ fontSize: '16px', display: 'flex' }}>▶</div>
            REPLAY
          </div>

          {/* Peak viewers overlay */}
          {peakViewers > 0 && (
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
              }}
            >
              👑 {peakViewers.toLocaleString('de-DE')} Peak
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
              color: '#94a3b8',
              fontSize: '22px',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                background: '#94a3b8',
                display: 'inline-block',
              }}
            />
            Serlo Replay
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

          {/* Ended at */}
          {session.ended_at && (
            <div
              style={{
                marginTop: '20px',
                fontSize: '20px',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ display: 'flex' }}>📅</span>
              <span style={{ display: 'flex' }}>
                {new Date(session.ended_at).toLocaleDateString('de-DE', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}

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
                  border: '3px solid rgba(255,255,255,0.12)',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #475569, #94a3b8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '26px',
                  fontWeight: 700,
                  color: '#ffffff',
                }}
              >
                {hostName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{hostName}</div>
              <div style={{ fontSize: '18px', color: '#64748b', display: 'flex', gap: '8px' }}>
                <span style={{ display: 'flex' }}>@{session.host?.username ?? 'host'}</span>
                {peakViewers > 0 && (
                  <>
                    <span style={{ display: 'flex', color: '#374151' }}>·</span>
                    <span style={{ display: 'flex' }}>
                      {peakViewers.toLocaleString('de-DE')} Peak-Zuschauer
                    </span>
                  </>
                )}
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
          background: 'linear-gradient(135deg, #050508, #1a1230)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '72px', display: 'flex' }}>🎬</div>
        <div style={{ fontSize: '48px', fontWeight: 700, display: 'flex' }}>Serlo Replay</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
