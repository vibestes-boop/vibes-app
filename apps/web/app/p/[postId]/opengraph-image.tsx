import { ImageResponse } from 'next/og';
import { getPost } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// Dynamic OG-Image für /p/[postId].
// Zeigt das Post-Thumbnail links (9:16 crop) + Caption/Author rechts.
// Fallback: generisches Serlo-Cover wenn Post nicht existiert.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Video';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { postId: string } }) {
  const post = await getPost(params.postId);

  if (!post) {
    return fallback();
  }

  const authorName = post.author.display_name ?? `@${post.author.username}`;
  const caption = post.caption?.slice(0, 180) ?? '';

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
        {/* Thumbnail left — 9:16 portrait, cover-cropped */}
        <div
          style={{
            width: '380px',
            height: '100%',
            display: 'flex',
            background: '#1a1a24',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {post.thumbnail_url ? (

            <img
              src={post.thumbnail_url}
              alt=""
              width={380}
              height={630}
              style={{ width: '380px', height: '630px', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #1a0a2e, #050508)',
              }}
            />
          )}
          {/* Play-Icon overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
              }}
            >
              <svg width={42} height={42} viewBox="0 0 24 24" fill="#050508">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right column — Branding, Caption, Author */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '72px',
            position: 'relative',
          }}
        >
          {/* Top: Serlo brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#d4af37',
              fontSize: '24px',
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
            Serlo
          </div>

          {/* Caption (large) */}
          <div
            style={{
              marginTop: '60px',
              fontSize: caption.length > 80 ? '42px' : '52px',
              fontWeight: 600,
              lineHeight: 1.2,
              display: '-webkit-box',
              overflow: 'hidden',
              color: '#ffffff',
            }}
          >
            {caption || `Video von ${authorName}`}
          </div>

          {/* Bottom: Author */}
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
            {post.author.avatar_url ? (

              <img
                src={post.author.avatar_url}
                alt=""
                width={72}
                height={72}
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '999px',
                  border: '3px solid rgba(255,255,255,0.15)',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #d4af37, #f4d47a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#050508',
                }}
              >
                {authorName.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '28px', fontWeight: 600 }}>{authorName}</div>
              <div style={{ fontSize: '20px', color: '#a7a3b1' }}>
                @{post.author.username} · {formatCount(post.view_count)} Aufrufe
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
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #050508, #1a0a2e)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '64px',
          fontWeight: 700,
        }}
      >
        Serlo
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}
