import { ImageResponse } from 'next/og';
import { getPublicProfile } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// Dynamic OG-Image für /u/[username].
// Next.js 15 Convention: opengraph-image.tsx neben page.tsx → automatische
// /u/[username]/opengraph-image Route + Wiring in <meta og:image>.
//
// Rendert im Edge-Runtime als 1200×630 JPG via ImageResponse (satori-based).
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Profil';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { username: string } }) {
  const profile = await getPublicProfile(params.username);

  // 404-Profil → generisches Serlo-Cover, damit der Link trotzdem hübsch aussieht.
  const displayName = profile?.display_name ?? `@${params.username}`;
  const username = profile?.username ?? params.username;
  const bio = profile?.bio?.slice(0, 140) ?? 'Serlo — Live, Feed, Shop.';
  const followers = profile?.follower_count ?? 0;
  const posts = profile?.post_count ?? 0;
  const avatarUrl = profile?.avatar_url;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #050508 0%, #1a0a2e 50%, #050508 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '72px',
          position: 'relative',
        }}
      >
        {/* Decorative gold corner */}
        <div
          style={{
            position: 'absolute',
            top: '72px',
            right: '72px',
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

        {/* Avatar + Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginTop: '120px' }}>
          {avatarUrl ? (
            // Wichtig: IMG-Tag, nicht next/image — satori kennt kein Next-Image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              width={180}
              height={180}
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '999px',
                border: '4px solid rgba(255,255,255,0.15)',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #d4af37, #f4d47a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '72px',
                fontWeight: 700,
                color: '#050508',
              }}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '56px', fontWeight: 700, lineHeight: 1.1 }}>
              {displayName}
            </div>
            <div style={{ fontSize: '28px', color: '#a7a3b1' }}>@{username}</div>
          </div>
        </div>

        {/* Bio */}
        <div
          style={{
            marginTop: '48px',
            fontSize: '26px',
            lineHeight: 1.4,
            color: '#e5e3ec',
            maxWidth: '920px',
            display: '-webkit-box',
            overflow: 'hidden',
          }}
        >
          {bio}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '48px', marginTop: 'auto', alignItems: 'baseline' }}>
          <Stat label="Follower" value={formatCount(followers)} />
          <Stat label="Posts"    value={formatCount(posts)} />
          <div style={{ marginLeft: 'auto', fontSize: '22px', color: '#a7a3b1' }}>
            serlo.app/u/{username}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontSize: '44px', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '20px', color: '#a7a3b1', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {label}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}
