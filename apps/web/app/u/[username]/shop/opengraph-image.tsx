import { ImageResponse } from 'next/og';
import { getPublicProfile } from '@/lib/data/public';
import { getMerchantProducts } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// /u/[username]/shop/opengraph-image — dynamisches OG-Bild für Merchant-Storefronts.
//
// Layout (1200×630):
//   Links (420px): Seller-Avatar (groß) auf dunklem Gradient-Grund, Store-Label.
//   Rechts: Seller-Name + @username, Bio (gekürzt), Produkt-Anzahl, Serlo-Branding.
//
// Fallback: generisches Store-Cover wenn Profil nicht existiert.
//
// v1.w.UI.127 — fehlende OG-Image-Abdeckung für Coin-Shop + Merchant-Storefront.
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'Serlo Shop';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function Image({ params }: { params: { username: string } }) {
  const profile = await getPublicProfile(params.username).catch(() => null);
  if (!profile) return fallback(params.username);

  const products = await getMerchantProducts(profile.id, 60).catch(() => []);
  const productCount = products.length;
  const displayName = profile.display_name ?? `@${profile.username}`;
  const bio = profile.bio?.slice(0, 120) ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#0d0d12',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Left — seller avatar panel */}
        <div
          style={{
            width: '420px',
            height: '630px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(160deg, #1a1030 0%, #0d0d12 100%)',
            position: 'relative',
            gap: '0px',
          }}
        >
          {/* Gold glow behind avatar */}
          <div
            style={{
              position: 'absolute',
              width: '300px',
              height: '300px',
              borderRadius: '999px',
              background: 'radial-gradient(ellipse, rgba(212,175,55,0.18) 0%, transparent 70%)',
            }}
          />

          {/* Avatar */}
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              width={200}
              height={200}
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '999px',
                objectFit: 'cover',
                border: '4px solid rgba(212,175,55,0.35)',
                position: 'relative',
              }}
            />
          ) : (
            <div
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #d4af37, #f4d47a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '80px',
                fontWeight: 700,
                color: '#0d0d12',
                border: '4px solid rgba(212,175,55,0.35)',
                position: 'relative',
              }}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* Store label */}
          <div
            style={{
              marginTop: '28px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(212,175,55,0.12)',
              border: '1px solid rgba(212,175,55,0.25)',
              borderRadius: '999px',
              padding: '6px 18px',
              color: '#d4af37',
              fontSize: '20px',
              fontWeight: 600,
            }}
          >
            🛍️ Shop
          </div>

          {/* Product count */}
          <div
            style={{
              marginTop: '12px',
              fontSize: '18px',
              color: '#6b7280',
              display: 'flex',
            }}
          >
            {productCount} Produkt{productCount === 1 ? '' : 'e'}
          </div>
        </div>

        {/* Right — seller info */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '64px 64px 60px',
          }}
        >
          {/* Serlo branding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#d4af37',
              fontSize: '22px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '999px',
                background: '#d4af37',
                display: 'inline-block',
              }}
            />
            Serlo Shop
          </div>

          {/* Verified badge row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '28px',
            }}
          >
            {profile.verified && (
              <span
                style={{
                  background: 'rgba(56,189,248,0.12)',
                  border: '1px solid rgba(56,189,248,0.3)',
                  color: '#38bdf8',
                  fontSize: '16px',
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                }}
              >
                ✓ Verifiziert
              </span>
            )}
          </div>

          {/* Display name */}
          <div
            style={{
              fontSize: displayName.length > 24 ? '48px' : '62px',
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#ffffff',
              marginBottom: '12px',
              display: 'flex',
            }}
          >
            {displayName}
          </div>

          {/* Username */}
          <div
            style={{
              fontSize: '26px',
              color: '#9ca3af',
              marginBottom: bio ? '28px' : '0px',
              display: 'flex',
            }}
          >
            @{profile.username}
          </div>

          {/* Bio */}
          {bio && (
            <div
              style={{
                fontSize: '24px',
                lineHeight: 1.45,
                color: '#d1d5db',
                display: '-webkit-box',
                overflow: 'hidden',
              }}
            >
              {bio}
            </div>
          )}

          {/* Bottom — URL */}
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                fontSize: '20px',
                color: '#6b7280',
                display: 'flex',
              }}
            >
              serlo.app/u/{profile.username}/shop
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function fallback(username: string) {
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
          background: 'linear-gradient(135deg, #0d0d12, #1a1228)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '80px', display: 'flex' }}>🛍️</div>
        <div style={{ fontSize: '48px', fontWeight: 700, color: '#d4af37', display: 'flex' }}>
          @{username}
        </div>
        <div style={{ fontSize: '28px', color: '#6b7280', display: 'flex' }}>
          Serlo Shop
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
