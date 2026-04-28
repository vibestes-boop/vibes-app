import { ImageResponse } from 'next/og';
import { getPostsByTag, getTrendingHashtags } from '@/lib/data/feed';

// OG-Image für /t/[tag] — zeigt #tag + Post-Count + Trending-Rank auf
// einem dunklen Hintergrund. Kein Thumbnail-Grid (Edge-Render zu teuer).

export const runtime = 'edge';
export const alt = 'Serlo Hashtag';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { tag: string } }) {
  const rawTag = decodeURIComponent(params.tag)
    .toLowerCase()
    .replace(/^#/, '')
    .trim();

  if (!rawTag || rawTag.length > 100) return fallback(rawTag);

  const [posts, trending] = await Promise.all([
    getPostsByTag(rawTag, 1).catch(() => []),
    getTrendingHashtags(10).catch(() => []),
  ]);

  const postCount = posts.length; // proxy — just signals "has posts"
  const rank = trending.findIndex((h) => h.tag === rawTag);

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
          background: 'linear-gradient(150deg, #0a0f1e 0%, #1a0a2e 60%, #050508 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Brand */}
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

        {/* Hashtag + rank */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              fontSize: rawTag.length > 20 ? '72px' : '96px',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-2px',
              color: '#d4af37',
            }}
          >
            #{rawTag}
          </div>
          {rank >= 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '28px',
                color: '#c7c3d0',
              }}
            >
              <span style={{ fontSize: '28px' }}>📈</span>
              <span>#{rank + 1} Trending auf Serlo</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            fontSize: '22px',
            color: '#5a5670',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Entdecke alle Videos mit diesem Hashtag</span>
          <span style={{ fontWeight: 500, color: '#8d8a99' }}>serlo.app</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

function fallback(tag: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050508',
          color: '#d4af37',
          fontFamily: 'system-ui',
          fontSize: '72px',
          fontWeight: 800,
        }}
      >
        #{tag}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
